import { ArcCameraEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArcCameraComponent, ArcCameraSystem } from './ArcCamera';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { MeshPrimitiveSystem } from '../MeshPrimitive/MeshPrimitive';
import { getArcCameraRuntime } from './ArcCamera.defs';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';

describe('ArcCameraComponent (core)', () => {
  it('applies sensible defaults', () => {
    const c = new ArcCameraComponent();
    expect(c.distance).toBe(15);
    expect(c.minDistance).toBe(5);
    expect(c.maxDistance).toBe(50);
    expect(c.alpha).toBeCloseTo(Math.PI / 2);
    expect(c.beta).toBeCloseTo(Math.PI / 3);
    expect(c.inertia).toBe(0.9);
    expect(c.wheelPrecision).toBe(50);
    expect(c.targetOffset).toEqual([0, 0, 0]);
    expect(c.autoRotate).toBe(false);
  });

  it('derives maxBeta from allowBelowGround', () => {
    const normal = new ArcCameraComponent();
    expect(normal.maxBeta).toBeCloseTo(Math.PI / 2 - 0.1);
    const below = new ArcCameraComponent({ allowBelowGround: true });
    expect(below.maxBeta).toBeCloseTo(Math.PI - 0.1);
  });

  it('accepts full configuration', () => {
    const c = new ArcCameraComponent({
      target: 'player',
      distance: 20,
      minDistance: 10,
      maxDistance: 60,
      alpha: Math.PI / 4,
      beta: Math.PI / 6,
      inertia: 0.8,
      targetOffset: [1, 2, 3],
      autoRotate: true,
      autoRotateSpeed: 1.5,
    });
    expect(c.target).toBe('player');
    expect(c.distance).toBe(20);
    expect(c.targetOffset).toEqual([1, 2, 3]);
    expect(c.autoRotate).toBe(true);
  });

  it('toSpec returns an ArcCameraSpec', () => {
    const c = new ArcCameraComponent({ distance: 12, alpha: 0.5 });
    const spec = c.toSpec();
    expect(spec.radius).toBe(12);
    expect(spec.alpha).toBe(0.5);
    expect(spec.minRadius).toBe(5);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new ArcCameraComponent({
      target: 'enemy',
      distance: 25,
      alpha: Math.PI / 4,
      targetOffset: [0, 5, 0],
      autoRotate: true,
    });
    const copy = new ArcCameraComponent(original.serialize());
    expect(copy.target).toBe('enemy');
    expect(copy.distance).toBe(25);
    expect(copy.alpha).toBeCloseTo(Math.PI / 4);
    expect(copy.targetOffset).toEqual([0, 5, 0]);
    expect(copy.autoRotate).toBe(true);
  });
});

describe('ArcCameraEvents', () => {
  it('defines all standard event names', () => {
    expect(ArcCameraEvents.CREATED).toBe('arccamera.created');
    expect(ArcCameraEvents.MOVED).toBe('arccamera.moved');
    expect(ArcCameraEvents.ROTATED).toBe('arccamera.rotated');
    expect(ArcCameraEvents.ZOOMED).toBe('arccamera.zoomed');
    expect(ArcCameraEvents.TARGET_CHANGED).toBe('arccamera.target.changed');
  });
});

describe('ArcCameraSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: ArcCameraSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new ArcCameraSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('query requires ArcCameraComponent', () => {
    expect((system as unknown as { query: unknown }).query).toEqual({ required: [ArcCameraComponent] });
  });

  it('is non-pauseable', () => {
    expect((system as unknown as { _pauseable: boolean })._pauseable).toBe(false);
  });

  it('creates a camera through the adapter on entity add', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ alpha: 1, beta: 0.5, distance: 20 }));
    const call = renderer.calls.find((c) => c.method === 'createArcCamera');
    expect(call).toBeDefined();
    const spec = call?.args[1] as { alpha: number; beta: number; radius: number };
    expect(spec.alpha).toBe(1);
    expect(spec.beta).toBe(0.5);
    expect(spec.radius).toBe(20);
  });

  it('emits CREATED event', () => {
    const spy = vi.fn();
    eventBus.on(ArcCameraEvents.CREATED, spy);
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: entity.id,
        alpha: expect.any(Number),
        beta: expect.any(Number),
        radius: expect.any(Number),
        // The camera handle rides along so Sound can attach the audio listener.
        handle: expect.anything(),
      }),
    );
  });

  it('tracks mesh targets via meshprimitive.created events', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ target: 'hero' }));
    const fakeMeshHandle = { __mockHandle: 'mesh:hero' } as unknown as import('@babylonjsmarket/ecs/renderer-types').MeshHandle;
    renderer.meshWorldPositions.set(fakeMeshHandle, [10, 0, 10]);
    eventBus.emit('meshprimitive.created', { entityId: 'hero', handle: fakeMeshHandle });
    world.update(0.016);
    // Adapter should have been asked for the mesh world position.
    expect(renderer.calls.some((c) => c.method === 'getMeshWorldPosition')).toBe(true);
  });

  it('emits ROTATED event when the adapter reports an alpha change', () => {
    const spy = vi.fn();
    eventBus.on(ArcCameraEvents.ROTATED, spy);
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent());
    // The System created exactly one camera; mutate the angles the adapter
    // will report so onUpdate detects an alpha change.
    const angles = [...renderer.cameraAngles.values()][0];
    if (angles) angles.alpha += 0.5;
    world.update(0.016);
    expect(spy).toHaveBeenCalled();
  });

  it('emits ZOOMED event when the adapter reports a radius change', () => {
    const spy = vi.fn();
    eventBus.on(ArcCameraEvents.ZOOMED, spy);
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent());
    // The System created exactly one camera; mutate the radius the adapter
    // will report so onUpdate detects a zoom change.
    const angles = [...renderer.cameraAngles.values()][0];
    if (angles) angles.radius += 2;
    world.update(0.016);
    expect(spy).toHaveBeenCalled();
  });

  it('auto-rotates when idle if enabled', () => {
    const entity = world.createEntity();
    const comp = new ArcCameraComponent({ autoRotate: true, autoRotateSpeed: 1 });
    entity.add(comp);
    renderer.calls.length = 0;
    world.update(4); // exceed idle threshold (3s)
    expect(renderer.calls.some((c) => c.method === 'nudgeCameraAlpha')).toBe(true);
  });

  it('does not auto-rotate when disabled', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ autoRotate: false }));
    renderer.calls.length = 0;
    world.update(4);
    expect(renderer.calls.some((c) => c.method === 'nudgeCameraAlpha')).toBe(false);
  });

  it('locks radius each frame when controls are disabled', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ controlsEnabled: false, distance: 30 }));
    renderer.calls.length = 0;
    world.update(0.016);
    const radius = renderer.calls.find((c) => c.method === 'setCameraRadius');
    expect(radius).toBeDefined();
    expect(radius!.args[1]).toBe(30);
    const limits = renderer.calls.find((c) => c.method === 'setCameraRadiusLimits');
    expect(limits).toBeDefined();
    expect(limits!.args[1]).toBe(30);
    expect(limits!.args[2]).toBe(30);
  });

  it('does not lock the radius for a free-orbit camera (controls on)', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ controlsEnabled: true }));
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'setCameraRadius')).toBe(false);
  });

  it('tracks an active target by reading its mesh world position each frame', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ target: 'hero', follow: true }));
    const fakeMeshHandle = { __mockHandle: 'mesh:hero' } as unknown as MeshHandle;
    renderer.meshWorldPositions.set(fakeMeshHandle, [10, 2, 6]);
    eventBus.emit('meshprimitive.created', { entityId: 'hero', handle: fakeMeshHandle });
    renderer.calls.length = 0;
    world.update(0.016);
    const setTarget = renderer.calls.find((c) => c.method === 'setCameraTarget');
    expect(setTarget).toBeDefined();
    // base + targetOffset(0,0,0)
    expect(setTarget!.args[1]).toBeCloseTo(10);
    expect(setTarget!.args[2]).toBeCloseTo(2);
    expect(setTarget!.args[3]).toBeCloseTo(6);
  });

  it('holds a captured free base when a target is named but its mesh is not ready', () => {
    const entity = world.createEntity();
    // target is named but no meshprimitive.created ever fires for it, so the
    // System captures the current look point (origin, the seeded target) as the
    // free base and pans it by targetOffset.
    const comp = new ArcCameraComponent({ target: 'ghost', follow: true, targetOffset: [1, 0, 0] });
    entity.add(comp);
    renderer.calls.length = 0;
    world.update(0.016);
    const setTarget = renderer.calls.find((c) => c.method === 'setCameraTarget');
    expect(setTarget).toBeDefined();
    // base (captured origin) + offset [1,0,0].
    expect(setTarget!.args[1]).toBeCloseTo(1);
    expect(setTarget!.args[2]).toBeCloseTo(0);
    expect(setTarget!.args[3]).toBeCloseTo(0);

    // The free base is cached on the runtime so panning is relative to it.
    const rt = getArcCameraRuntime(comp);
    expect(rt.freeBase).toEqual([0, 0, 0]);

    // Second frame still drives the target from the same cached base.
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'setCameraTarget')).toBe(true);
  });

  it('resets the idle timer the frame the camera receives input while auto-rotating', () => {
    const entity = world.createEntity();
    const comp = new ArcCameraComponent({ autoRotate: true, autoRotateSpeed: 1 });
    entity.add(comp);
    // Let it idle past the threshold so it begins nudging.
    world.update(4);
    expect(renderer.calls.some((c) => c.method === 'nudgeCameraAlpha')).toBe(true);
    // Now simulate user input: bump the reported alpha so onUpdate detects
    // rotation, which must reset idleTime to 0 and suppress nudging this frame.
    const angles = [...renderer.cameraAngles.values()][0];
    if (angles) angles.alpha += 1;
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'nudgeCameraAlpha')).toBe(false);
  });

  it('seeds the camera target from a target mesh that already exists at creation', () => {
    // Build a fresh world where the target mesh is created BEFORE the
    // ArcCamera entity, so ensureCamera resolves the handle and seeds from it.
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    w.addSystem(new MeshPrimitiveSystem(bus));
    w.addSystem(new ArcCameraSystem(bus));
    w.initialize();

    const hero = w.createEntity('hero');
    hero.add(new MeshPrimitiveComponent());
    const mp = hero.get(MeshPrimitiveComponent)!;
    r.meshWorldPositions.set(mp.handle as MeshHandle, [5, 1, 3]);

    const cam = w.createEntity('Cam');
    cam.add(new ArcCameraComponent({ target: 'hero', follow: true, targetOffset: [0, 2, 0] }));

    const create = r.calls.find((c) => c.method === 'createArcCamera');
    expect(create).toBeDefined();
    const spec = create!.args[1] as { target: [number, number, number] };
    expect(spec.target[0]).toBeCloseTo(5);
    expect(spec.target[1]).toBeCloseTo(3); // 1 + offset 2
    expect(spec.target[2]).toBeCloseTo(3);
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus });
    w.addSystem(new ArcCameraSystem(bus));
    w.initialize();
    const e = w.createEntity();
    expect(() => e.add(new ArcCameraComponent())).not.toThrow();
    expect(() => w.update(0.016)).not.toThrow();
  });

  it('creates cameras for entities that exist before the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    const entity = w.createEntity();
    entity.add(new ArcCameraComponent({ distance: 22 }));
    // System added AFTER the entity → onInitialize scans and creates it.
    w.addSystem(new ArcCameraSystem(bus));
    w.initialize();
    const create = r.calls.find((c) => c.method === 'createArcCamera');
    expect(create).toBeDefined();
    expect((create!.args[1] as { radius: number }).radius).toBe(22);
  });

  it('centres restTarget when not following', () => {
    const entity = world.createEntity();
    entity.add(new ArcCameraComponent({ follow: false, restTarget: 'table' }));
    const fakeMeshHandle = { __mockHandle: 'mesh:table' } as unknown as MeshHandle;
    renderer.meshWorldPositions.set(fakeMeshHandle, [0, 0, 9]);
    eventBus.emit('meshprimitive.created', { entityId: 'table', handle: fakeMeshHandle });
    renderer.calls.length = 0;
    world.update(0.016);
    const setTarget = renderer.calls.find((c) => c.method === 'setCameraTarget');
    expect(setTarget).toBeDefined();
    expect(setTarget!.args[3]).toBeCloseTo(9);
  });

  it('seeds from `target` when not following and no restTarget is set', () => {
    // follow:false with no restTarget → seedName falls back to `target`.
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    w.addSystem(new MeshPrimitiveSystem(bus));
    w.addSystem(new ArcCameraSystem(bus));
    w.initialize();

    const hero = w.createEntity('hero');
    hero.add(new MeshPrimitiveComponent());
    const mp = hero.get(MeshPrimitiveComponent)!;
    r.meshWorldPositions.set(mp.handle as MeshHandle, [7, 0, 0]);

    const cam = w.createEntity('Cam');
    cam.add(new ArcCameraComponent({ target: 'hero', follow: false }));

    const create = r.calls.find((c) => c.method === 'createArcCamera');
    const spec = create!.args[1] as { target: [number, number, number] };
    expect(spec.target[0]).toBeCloseTo(7);
  });
});
