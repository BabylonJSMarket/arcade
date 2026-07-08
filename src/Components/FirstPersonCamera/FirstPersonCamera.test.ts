// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FirstPersonCameraComponent, FirstPersonCameraSystem } from './FirstPersonCamera';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

/** Last recorded call to a given adapter method, or undefined. */
function lastCall(renderer: MockRendererAdapter, method: string) {
  for (let i = renderer.calls.length - 1; i >= 0; i--) {
    if (renderer.calls[i].method === method) return renderer.calls[i];
  }
  return undefined;
}

describe('FirstPersonCamera', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: FirstPersonCameraSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new FirstPersonCameraSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('applies defaults', () => {
    const c = new FirstPersonCameraComponent();
    expect(c.eyeHeight).toBe(1.7);
    expect(c.startX).toBe(0);
    expect(c.startZ).toBe(0);
    expect(c.moveSpeed).toBe(3);
    expect(c.turnSpeed).toBe(1.8);
    expect(c.bounds).toBeUndefined();
  });

  it('round-trips through serialize (with and without bounds)', () => {
    const withBounds = new FirstPersonCameraComponent({
      eyeHeight: 2,
      position: [1, -2],
      yaw: 0.5,
      moveSpeed: 4,
      bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    });
    const rt = new FirstPersonCameraComponent(withBounds.serialize());
    expect(rt.eyeHeight).toBe(2);
    expect(rt.startX).toBe(1);
    expect(rt.startZ).toBe(-2);
    expect(rt.yaw).toBe(0.5);
    expect(rt.bounds).toEqual({ minX: -5, maxX: 5, minZ: -6, maxZ: 6 });

    // No bounds → serialize omits the bounds key.
    const noBounds = new FirstPersonCameraComponent({ position: [3, 4] });
    expect(noBounds.serialize().bounds).toBeUndefined();
    expect(new FirstPersonCameraComponent(noBounds.serialize()).bounds).toBeUndefined();
  });

  it('creates a perspective camera at the start pose (eye height)', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ eyeHeight: 2, position: [3, 4] }));
    const call = lastCall(renderer, 'createPerspectiveCamera');
    expect(call).toBeDefined();
    const spec = call!.args[1] as { position: number[] };
    expect(spec.position).toEqual([3, 2, 4]); // [startX, eyeHeight, startZ]
  });

  it('walks forward (+Z at yaw 0) when W is held', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10, eyeHeight: 1.7 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    world.update(0.1);

    const pos = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos[2]).toBeCloseTo(1.0, 5); // 10 u/s * 0.1 s along +Z
    expect(pos[0]).toBeCloseTo(0, 5);
    expect(pos[1]).toBeCloseTo(1.7, 5); // pinned at eye height
  });

  it('strafes right (+X at yaw 0) with E', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyE' });
    world.update(0.1);

    const pos = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos[0]).toBeCloseTo(1.0, 5); // right = +X at yaw 0
    expect(pos[2]).toBeCloseTo(0, 5);

    // Release E, hold Q → strafe back toward the origin.
    eventBus.emit('keyboard.keyup', { code: 'KeyE' });
    eventBus.emit('keyboard.keydown', { code: 'KeyQ' });
    world.update(0.1);
    const pos2 = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos2[0]).toBeCloseTo(0, 5);
  });

  it('turns with A / D (changes the pose orientation)', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ turnSpeed: 1 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyD' });
    world.update(0.5); // yaw += 0.5 rad
    const q = lastCall(renderer, 'setCameraPose')!.args[2] as { y: number; w: number };
    expect(q.y).toBeCloseTo(Math.sin(0.25), 5);
    expect(q.w).toBeCloseTo(Math.cos(0.25), 5);

    // A turns the other way (arrow keys too).
    eventBus.emit('keyboard.keyup', { code: 'KeyD' });
    eventBus.emit('keyboard.keydown', { code: 'ArrowLeft' });
    world.update(0.5); // yaw back to 0
    const q2 = lastCall(renderer, 'setCameraPose')!.args[2] as { y: number };
    expect(q2.y).toBeCloseTo(0, 5);
  });

  it('clamps to bounds so the player cannot leave the room', () => {
    const e = world.createEntity('Camera');
    e.add(
      new FirstPersonCameraComponent({
        moveSpeed: 100,
        position: [0, 0],
        bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
      }),
    );
    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    world.update(1); // would travel 100 u forward without clamping
    const pos = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos[2]).toBeCloseTo(5, 5);
  });

  it('bridges real DOM keyboard events to movement', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10 }));

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    world.update(0.1);
    const moved = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(moved[2]).toBeGreaterThan(0);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    const z = (lastCall(renderer, 'setCameraPose')!.args[1] as number[])[2];
    world.update(0.1); // key released → no further travel
    const z2 = (lastCall(renderer, 'setCameraPose')!.args[1] as number[])[2];
    expect(z2).toBeCloseTo(z, 5);
  });

  it('creates the camera for an entity that exists before initialize (SceneLoader order)', () => {
    // Live path: entities are created first, then systems are added + the world
    // initialized — so onInitialize must sweep the already-present entities.
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    const e = w.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ position: [2, 3], eyeHeight: 1.8 }));
    w.addSystem(new FirstPersonCameraSystem(eb));
    w.initialize();
    const call = lastCall(r, 'createPerspectiveCamera');
    expect(call).toBeDefined();
    expect((call!.args[1] as { position: number[] }).position).toEqual([2, 1.8, 3]);
  });

  it('removes its DOM listeners on shutdown', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10 }));
    world.removeSystem(system); // → onShutdown removes the window listeners

    const before = renderer.calls.length;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    // No system is listening anymore, so nothing new is driven.
    expect(renderer.calls.length).toBe(before);
  });
});
