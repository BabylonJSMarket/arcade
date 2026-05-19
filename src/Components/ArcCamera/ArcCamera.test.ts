import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ArcCameraComponent,
  ArcCameraSystem,
  ArcCameraEvents,
} from './ArcCamera';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

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
    expect(c.initialized).toBe(false);
    expect(c.handle).toBeUndefined();
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
    const comp = new ArcCameraComponent();
    entity.add(comp);
    const angles = renderer.cameraAngles.get(comp.handle!);
    if (angles) angles.alpha += 0.5;
    world.update(0.016);
    expect(spy).toHaveBeenCalled();
  });

  it('emits ZOOMED event when the adapter reports a radius change', () => {
    const spy = vi.fn();
    eventBus.on(ArcCameraEvents.ZOOMED, spy);
    const entity = world.createEntity();
    const comp = new ArcCameraComponent();
    entity.add(comp);
    const angles = renderer.cameraAngles.get(comp.handle!);
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
});
