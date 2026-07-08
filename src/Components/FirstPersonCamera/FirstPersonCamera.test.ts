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

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new FirstPersonCameraSystem(eventBus));
    world.initialize();
  });

  it('applies defaults', () => {
    const c = new FirstPersonCameraComponent();
    expect(c.eyeHeight).toBe(1.7);
    expect(c.startX).toBe(0);
    expect(c.startZ).toBe(0);
    expect(c.moveSpeed).toBe(3);
    expect(c.turnSpeed).toBe(1.8);
  });

  it('round-trips through serialize', () => {
    const c = new FirstPersonCameraComponent({
      eyeHeight: 2,
      position: [1, -2],
      yaw: 0.5,
      moveSpeed: 4,
      bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    });
    const c2 = new FirstPersonCameraComponent(c.serialize());
    expect(c2.eyeHeight).toBe(2);
    expect(c2.startX).toBe(1);
    expect(c2.startZ).toBe(-2);
    expect(c2.yaw).toBe(0.5);
    expect(c2.bounds).toEqual({ minX: -5, maxX: 5, minZ: -6, maxZ: 6 });
  });

  it('creates a perspective camera at the start pose (eye height)', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ eyeHeight: 2, position: [3, 4] }));
    const call = lastCall(renderer, 'createPerspectiveCamera');
    expect(call).toBeDefined();
    // args: (id, spec)
    const spec = call!.args[1] as { position: number[] };
    expect(spec.position).toEqual([3, 2, 4]); // [startX, eyeHeight, startZ]
  });

  it('walks forward (+Z at yaw 0) when W is held', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10, eyeHeight: 1.7 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    world.update(0.1);

    const call = lastCall(renderer, 'setCameraPose');
    expect(call).toBeDefined();
    const pos = call!.args[1] as number[];
    expect(pos[2]).toBeCloseTo(1.0, 5); // 10 u/s * 0.1 s along +Z
    expect(pos[0]).toBeCloseTo(0, 5);
    expect(pos[1]).toBeCloseTo(1.7, 5); // pinned at eye height
  });

  it('turns with A / D (changes the pose orientation)', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ turnSpeed: 1 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyD' });
    world.update(0.5); // yaw += 0.5 rad

    const call = lastCall(renderer, 'setCameraPose');
    const q = call!.args[2] as { y: number; w: number };
    // yaw 0.5 -> quaternion about +Y: y = sin(0.25), w = cos(0.25)
    expect(q.y).toBeCloseTo(Math.sin(0.25), 5);
    expect(q.w).toBeCloseTo(Math.cos(0.25), 5);
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
    expect(pos[2]).toBeLessThanOrEqual(5);
  });
});
