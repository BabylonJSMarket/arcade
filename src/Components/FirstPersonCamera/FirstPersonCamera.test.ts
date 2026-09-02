// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstPersonCameraComponent, FirstPersonCameraSystem } from './FirstPersonCamera';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { FirstPersonCameraEvents } from '../../events';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import { ObstacleComponent } from '../Obstacle/Obstacle.defs';

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

  it('emits CREATED with the camera handle once the camera exists', () => {
    const seen: { entityId: string; handle?: unknown }[] = [];
    eventBus.on(FirstPersonCameraEvents.CREATED, (e: { entityId: string; handle?: unknown }) => seen.push(e));
    const entity = world.createEntity();
    entity.add(new FirstPersonCameraComponent());
    expect(seen).toHaveLength(1);
    expect(seen[0].entityId).toBe(entity.id);
    expect(seen[0].handle).toBeDefined();
    // The handle is the one the adapter handed back for the perspective camera.
    world.update(1 / 60);
    expect(seen).toHaveLength(1);
  });

  it('applies defaults', () => {
    const c = new FirstPersonCameraComponent();
    expect(c.eyeHeight).toBe(1.7);
    expect(c.startX).toBe(0);
    expect(c.startZ).toBe(0);
    expect(c.moveSpeed).toBe(3);
    expect(c.turnSpeed).toBe(1.8);
    expect(c.bounds).toBeUndefined();
    // Collision is on by default, at a shoulder's half-width.
    expect(c.collide).toBe(true);
    expect(c.radius).toBe(0.45);
    expect(c.persistKey).toBeUndefined();
  });

  it('round-trips collide / radius / persistKey, omitting an unset persistKey', () => {
    const c = new FirstPersonCameraComponent({ collide: false, radius: 0.3, persistKey: 'room.pose' });
    const out = c.serialize();
    expect(out).toMatchObject({ collide: false, radius: 0.3, persistKey: 'room.pose' });
    expect(new FirstPersonCameraComponent(out).serialize()).toEqual(out);
    expect('persistKey' in new FirstPersonCameraComponent().serialize()).toBe(false);
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

  // The canonical frame: yaw 0 looks +Z, +Y is up, and the renderer is
  // right-handed. Your right hand is forward x up, so at yaw 0 it points at -X
  // — which is also why the adapter contract puts +X on the screen's LEFT for
  // an identity camera. Turn to face -Z (yaw π, the arcade room's spawn) and
  // your right becomes +X, on the screen's right, as it should be.
  it('strafes toward the hand you would actually raise: -X at yaw 0, +X at yaw π', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ moveSpeed: 10 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyE' });
    world.update(0.1);

    const pos = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos[0]).toBeCloseTo(-1.0, 5); // right = -X while facing +Z
    expect(pos[2]).toBeCloseTo(0, 5);

    // Release E, hold Q → strafe back toward the origin.
    eventBus.emit('keyboard.keyup', { code: 'KeyE' });
    eventBus.emit('keyboard.keydown', { code: 'KeyQ' });
    world.update(0.1);
    const pos2 = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos2[0]).toBeCloseTo(0, 5);

    // Same key, turned around: facing -Z, strafing right now carries you +X.
    eventBus.emit('keyboard.keyup', { code: 'KeyQ' });
    const spun = world.createEntity('CameraSpun');
    spun.add(new FirstPersonCameraComponent({ moveSpeed: 10, yaw: Math.PI }));
    eventBus.emit('keyboard.keydown', { code: 'KeyE' });
    world.update(0.1);
    const pos3 = lastCall(renderer, 'setCameraPose')!.args[1] as number[];
    expect(pos3[0]).toBeCloseTo(1.0, 5);
    eventBus.emit('keyboard.keyup', { code: 'KeyE' });
  });

  // D must turn the VIEW to the right, which means yaw goes DOWN: forward is
  // (sin yaw, 0, cos yaw), so raising yaw swings the view toward -X and the
  // right-handed renderer draws that on the left. Getting this backwards is
  // exactly what shipped on 2026-09-02 and felt like inverted steering.
  it('turns the view right on D, which decreases yaw', () => {
    const e = world.createEntity('Camera');
    e.add(new FirstPersonCameraComponent({ turnSpeed: 1 }));

    eventBus.emit('keyboard.keydown', { code: 'KeyD' });
    world.update(0.5); // yaw -= 0.5 rad
    const q = lastCall(renderer, 'setCameraPose')!.args[2] as { y: number; w: number };
    expect(q.y).toBeCloseTo(Math.sin(-0.25), 5);
    expect(q.w).toBeCloseTo(Math.cos(-0.25), 5);

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

  describe('GOTO — walking itself to a spot', () => {
    /** Run `frames` updates and read the final camera position. */
    const settle = (frames: number) => {
      for (let i = 0; i < frames; i++) world.update(1 / 60);
      const call = lastCall(renderer, 'setCameraPose');
      return (call!.args[1] as number[]);
    };

    it('walks to the requested spot and settles on the requested facing', () => {
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 6, turnSpeed: 8 }));
      world.update(1 / 60);
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 0, z: 4, yaw: Math.PI });
      const pos = settle(180);
      expect(pos[0]).toBeCloseTo(0, 1);
      expect(pos[2]).toBeCloseTo(4, 1);
    });

    it('emits ARRIVED once it gets there', () => {
      const arrived: unknown[] = [];
      eventBus.on(FirstPersonCameraEvents.ARRIVED, (p) => arrived.push(p));
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 6, turnSpeed: 8 }));
      world.update(1 / 60);
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 0, z: 2 });
      settle(180);
      expect(arrived).toHaveLength(1);
      expect((arrived[0] as { cancelled: boolean }).cancelled).toBe(false);
    });

    it('a movement key CANCELS the walk — the player always wins', () => {
      const arrived: unknown[] = [];
      eventBus.on(FirstPersonCameraEvents.ARRIVED, (p) => arrived.push(p));
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 2, turnSpeed: 8 }));
      world.update(1 / 60);
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 0, z: 20 });
      settle(5);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
      const posAtCancel = settle(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
      const after = settle(60);

      expect(arrived).toHaveLength(1);
      expect((arrived[0] as { cancelled: boolean }).cancelled).toBe(true);
      // It is no longer driving itself toward z = 20 — S walked it back instead.
      expect(after[2]).toBeLessThan(posAtCancel[2] + 0.5);
    });

    it('stays inside its bounds while auto-walking', () => {
      const e = world.createEntity('Camera');
      e.add(
        new FirstPersonCameraComponent({
          position: [0, 0],
          moveSpeed: 8,
          turnSpeed: 8,
          bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
        }),
      );
      world.update(1 / 60);
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 50, z: 50 });
      const pos = settle(120);
      expect(pos[0]).toBeLessThanOrEqual(1.0001);
      expect(pos[2]).toBeLessThanOrEqual(1.0001);
    });
  });

  describe('collision — Obstacles are solid', () => {
    /** A solid box footprint at `center` with the given half-extents. */
    const obstacle = (center: [number, number], halfWidth: number, halfDepth: number) => {
      const e = world.createEntity();
      e.add(new ObstacleComponent({ center, halfWidth, halfDepth }));
      return e;
    };
    const pose = () => lastCall(renderer, 'setCameraPose')!.args[1] as number[];

    it('stops one radius short of a cabinet it walks straight into', () => {
      // Cabinet centred 3 m ahead, 1 m deep: its near face is at z = 2.5.
      obstacle([0, 3], 0.5, 0.5);
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ moveSpeed: 10, radius: 0.45 }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      world.update(1); // would reach z = 10 unopposed
      expect(pose()[2]).toBeCloseTo(2.5 - 0.45, 5);
      // Holding the key keeps pressing, never tunnels.
      world.update(1);
      expect(pose()[2]).toBeCloseTo(2.05, 5);
    });

    it('slides along a face when it approaches at an angle', () => {
      // A long wall ahead; strafing right while walking forward carries on
      // along the wall once the forward part is stopped.
      obstacle([0, 3], 10, 0.5);
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ moveSpeed: 4 }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      eventBus.emit('keyboard.keydown', { code: 'KeyE' });
      world.update(1);
      const p = pose();
      expect(p[2]).toBeCloseTo(2.5 - 0.45, 5); // stopped at the wall
      expect(p[0]).toBeCloseTo(-4, 5); // the strafe went through in full (-X: facing +Z)
    });

    it('collide: false walks straight through', () => {
      obstacle([0, 3], 0.5, 0.5);
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ moveSpeed: 10, collide: false }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      world.update(1);
      expect(pose()[2]).toBeCloseTo(10, 5);
    });

    it('bounds still clamp on top of the sweep', () => {
      obstacle([0, 30], 0.5, 0.5); // far beyond the room; the wall belt should win
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ moveSpeed: 100, bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      world.update(1);
      expect(pose()[2]).toBeCloseTo(5, 5);
    });

    it('an approach glides over obstacles and lands on the spot', () => {
      // Deliberate: the approach is on rails. A glide that snagged on a cabinet
      // corner would stop in open floor with no way to explain itself, and the
      // destination is always a clear spot in front of a machine. Walking under
      // your own keys still collides — that is the test above.
      const arrived: { cancelled: boolean; x: number; z: number }[] = [];
      eventBus.on(FirstPersonCameraEvents.ARRIVED, (p: { cancelled: boolean; x: number; z: number }) =>
        arrived.push(p),
      );
      obstacle([0, 2], 2, 0.5); // a bar straight across the way
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], approachDuration: 0.5 }));
      world.update(1 / 60);
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 0, z: 5, yaw: Math.PI });
      for (let i = 0; i < 60; i++) world.update(1 / 60);
      expect(arrived).toHaveLength(1);
      expect(arrived[0].cancelled).toBe(false);
      expect(pose()[2]).toBeCloseTo(5, 5);
      // Settled: more frames, no more events, no drift.
      for (let i = 0; i < 30; i++) world.update(1 / 60);
      expect(arrived).toHaveLength(1);
      expect(pose()[2]).toBeCloseTo(5, 5);
    });

    it('moves and turns at the same time, easing out', () => {
      // The whole point of the change. Turning to face the target, then
      // walking, then turning again to face the machine reads as three robotic
      // moves and takes as long as the room is wide; the hand-written room
      // eased position and facing together over a fixed 0.7 s, and that is what
      // made clicking a cabinet feel like walking up to one.
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], yaw: 0, approachDuration: 1 }));
      world.update(1 / 60);
      // Target dead behind and to the side, so a turn-then-walk would show up
      // as a long spell of turning with no movement at all.
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 4, z: -4, yaw: Math.PI });

      for (let i = 0; i < 30; i++) world.update(1 / 60); // half way through
      const half = pose();
      const q = lastCall(renderer, 'setCameraPose')!.args[2] as { y: number };
      // Ease-out 1-(1-u)^2 at u = 0.5 is 0.75 of the way there, on both axes...
      expect(half[0]).toBeCloseTo(3, 1);
      expect(half[2]).toBeCloseTo(-3, 1);
      // ...and the facing has come along with it, not waited its turn.
      expect(Math.abs(q.y)).toBeGreaterThan(0.5);

      for (let i = 0; i < 35; i++) world.update(1 / 60);
      const end = pose();
      expect(end[0]).toBeCloseTo(4, 5);
      expect(end[2]).toBeCloseTo(-4, 5);
    });

    it('a GOTO that can slide round a box still arrives', () => {
      // The target is off to the right of a box that sits on the diagonal:
      // the forward part of each step is stopped at the box's front, the
      // sideways part carries the player along it and past — the slide —
      // and the walk goes on to the target rather than giving up.
      obstacle([0.9, 2.2], 0.3, 0.3);
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 6, turnSpeed: 8 }));
      world.update(1 / 60);
      const arrived: { cancelled: boolean }[] = [];
      eventBus.on(FirstPersonCameraEvents.ARRIVED, (p: { cancelled: boolean }) => arrived.push(p));
      eventBus.emit(FirstPersonCameraEvents.GOTO, { x: 2, z: 5 });
      for (let i = 0; i < 300; i++) world.update(1 / 60);
      expect(arrived).toHaveLength(1);
      expect(arrived[0].cancelled).toBe(false);
      expect(pose()[0]).toBeCloseTo(2, 1);
      expect(pose()[2]).toBeCloseTo(5, 1);
    });
  });

  describe('pose persistence (persistKey)', () => {
    const KEY = 'test.room.pose';
    // Node 25 puts its own `localStorage` on the global — a stub with no
    // getItem/setItem unless `--localstorage-file` is set — and it shadows
    // jsdom's. Install a real in-memory Storage for these tests and put the
    // original back after, so what the System sees is what a browser gives it.
    let store: Storage;
    let original: PropertyDescriptor | undefined;
    beforeEach(() => {
      const data = new Map<string, string>();
      store = {
        get length() {
          return data.size;
        },
        clear: () => data.clear(),
        getItem: (k: string) => data.get(k) ?? null,
        key: (i: number) => [...data.keys()][i] ?? null,
        removeItem: (k: string) => void data.delete(k),
        setItem: (k: string, v: string) => void data.set(k, String(v)),
      };
      original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', { value: store, configurable: true, writable: true });
    });
    afterEach(() => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    });

    it('restores the remembered pose on attach instead of the start pose', () => {
      window.localStorage.setItem(KEY, JSON.stringify({ x: 3, z: -2, yaw: 1.25 }));
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], yaw: 0, eyeHeight: 1.6, persistKey: KEY }));
      const spec = lastCall(renderer, 'createPerspectiveCamera')!.args[1] as { position: number[]; orientation: { y: number } };
      expect(spec.position).toEqual([3, 1.6, -2]);
      expect(spec.orientation.y).toBeCloseTo(Math.sin(1.25 / 2), 5);
    });

    it('ignores a malformed entry and starts at the start pose', () => {
      window.localStorage.setItem(KEY, '{"x": "nope"}');
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [1, 2], persistKey: KEY }));
      const spec = lastCall(renderer, 'createPerspectiveCamera')!.args[1] as { position: number[] };
      expect(spec.position).toEqual([1, 1.7, 2]);
    });

    it('writes the live pose about once a second while it changes, not every frame', () => {
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 1, persistKey: KEY }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      const setItem = vi.spyOn(store, 'setItem');
      world.update(0.5);
      expect(setItem).not.toHaveBeenCalled(); // half a second in: not yet
      world.update(0.6);
      expect(setItem).toHaveBeenCalledTimes(1); // past the interval: written
      const saved = JSON.parse(window.localStorage.getItem(KEY)!);
      expect(saved.z).toBeCloseTo(1.1, 5);
      // Idle now: the next interval has nothing new to say.
      eventBus.emit('keyboard.keyup', { code: 'KeyW' });
      world.update(1.5);
      expect(setItem).toHaveBeenCalledTimes(1);
      setItem.mockRestore();
    });

    it('writes on shutdown so the last steps are not lost', () => {
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 2, persistKey: KEY }));
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      world.update(0.25); // 0.5 m, well inside the throttle window
      expect(window.localStorage.getItem(KEY)).toBeNull();
      world.removeSystem(system);
      expect(JSON.parse(window.localStorage.getItem(KEY)!).z).toBeCloseTo(0.5, 5);
    });

    it('writes when the camera entity is removed (a scene swap)', () => {
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [4, 4], persistKey: KEY }));
      world.update(1 / 60);
      world.removeEntity(e.id);
      expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({ x: 4, z: 4 });
    });

    it('without a persistKey nothing is ever stored', () => {
      const e = world.createEntity('Camera');
      e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 1 }));
      const setItem = vi.spyOn(store, 'setItem');
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      world.update(2);
      world.removeSystem(system);
      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });

    it('a storage that throws is shrugged off', () => {
      const getItem = vi.spyOn(store, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const setItem = vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const e = world.createEntity('Camera');
      expect(() => e.add(new FirstPersonCameraComponent({ position: [0, 0], moveSpeed: 1, persistKey: KEY }))).not.toThrow();
      eventBus.emit('keyboard.keydown', { code: 'KeyW' });
      expect(() => world.update(2)).not.toThrow();
      expect(() => world.removeSystem(system)).not.toThrow();
      getItem.mockRestore();
      setItem.mockRestore();
    });

    it('a window whose localStorage getter throws is treated as no storage', () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError');
        },
      });
      const e = world.createEntity('Camera');
      expect(() => e.add(new FirstPersonCameraComponent({ persistKey: KEY }))).not.toThrow();
      expect(() => world.removeSystem(system)).not.toThrow();
    });

    it('a window with no localStorage at all is treated as no storage', () => {
      Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true, writable: true });
      const e = world.createEntity('Camera');
      expect(() => e.add(new FirstPersonCameraComponent({ persistKey: KEY }))).not.toThrow();
      expect(() => world.removeSystem(system)).not.toThrow();
    });
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
