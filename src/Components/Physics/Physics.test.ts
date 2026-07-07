import { PhysicsEvents, PhysicsInputEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsComponent, PhysicsSystem } from './Physics';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('PhysicsComponent', () => {
  it('applies defaults', () => {
    const comp = new PhysicsComponent();
    expect(comp.shapeType).toBe('sphere');
    expect(comp.motionType).toBe('dynamic');
    expect(comp.mass).toBe(1);
    expect(comp.friction).toBe(0.5);
    expect(comp.restitution).toBe(0.5);
    expect(comp.lockRotation).toBe(false);
    expect(comp.autoCreate).toBe(true);
    expect(comp.isCreated).toBe(false);
  });

  it('defaults to static when mass is zero', () => {
    const comp = new PhysicsComponent({ mass: 0 });
    expect(comp.motionType).toBe('static');
  });

  it('respects explicit motionType override even when mass is zero', () => {
    const comp = new PhysicsComponent({ mass: 0, motionType: 'kinematic' });
    expect(comp.motionType).toBe('kinematic');
  });

  it('serialize round-trips', () => {
    const original = new PhysicsComponent({
      shapeType: 'capsule',
      motionType: 'kinematic',
      mass: 5,
      friction: 0.9,
      restitution: 0.2,
      lockRotation: true,
      autoCreate: false,
    });
    const copy = new PhysicsComponent(original.serialize());
    expect(copy.shapeType).toBe('capsule');
    expect(copy.motionType).toBe('kinematic');
    expect(copy.mass).toBe(5);
    expect(copy.lockRotation).toBe(true);
    expect(copy.autoCreate).toBe(false);
  });

  it('toBodyOpts shape matches the adapter PhysicsBodyOpts fields', () => {
    const comp = new PhysicsComponent({ shapeType: 'box', mass: 2, friction: 0.3 });
    const opts = comp.toBodyOpts();
    expect(opts.shapeType).toBe('box');
    expect(opts.mass).toBe(2);
    expect(opts.friction).toBe(0.3);
    expect(opts.motionType).toBe('dynamic');
  });
});

describe('PhysicsSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: PhysicsSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new PhysicsSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  function makeBodyEntity(meshId = 'body-mesh') {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere' });
    mesh.handle = renderer.createMesh(meshId, mesh.toPrimitiveSpec()) as ReturnType<
      typeof renderer.createMesh
    >;
    entity.add(mesh);
    entity.add(new PhysicsComponent({ shapeType: 'sphere', mass: 2, friction: 0.4 }));
    return entity;
  }

  it('calls physicsCreateBody when a mesh-carrying entity is added', () => {
    renderer.calls.length = 0;
    const entity = makeBodyEntity();
    const creates = renderer.calls.filter((c) => c.method === 'physicsCreateBody');
    expect(creates.length).toBe(1);
    expect(creates[0].args[0]).toBe(entity.id);
    const opts = creates[0].args[1] as Record<string, unknown>;
    expect(opts.shapeType).toBe('sphere');
    expect(opts.mass).toBe(2);
  });

  it('emits BODY_CREATED when the body is registered', () => {
    const spy = vi.fn();
    eventBus.on(PhysicsEvents.BODY_CREATED, spy);
    const entity = makeBodyEntity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, shapeType: 'sphere', mass: 2 }),
    );
  });

  it('does not create a body if autoCreate is false', () => {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'box' });
    mesh.handle = renderer.createMesh('m', mesh.toPrimitiveSpec()) as ReturnType<
      typeof renderer.createMesh
    >;
    entity.add(mesh);
    entity.add(new PhysicsComponent({ autoCreate: false }));
    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'physicsCreateBody')).toBe(false);
  });

  it('SET_VELOCITY input event forwards to physicsSetBodyVelocity', () => {
    const entity = makeBodyEntity();
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_VELOCITY, {
      entityId: entity.id,
      vx: 1, vy: 2, vz: 3,
    });
    const setVel = renderer.calls.find((c) => c.method === 'physicsSetBodyVelocity');
    expect(setVel).toBeDefined();
    expect(setVel?.args).toEqual([entity.id, 1, 2, 3]);
  });

  it('onUpdate calls physicsStep with the frame dt when not paused', () => {
    makeBodyEntity();
    renderer.calls.length = 0;
    world.update(0.016);
    const steps = renderer.calls.filter((c) => c.method === 'physicsStep');
    expect(steps.length).toBe(1);
    expect(steps[0].args[0]).toBe(0.016);
  });

  it('PAUSE + RESUME events gate physicsStep on onUpdate', () => {
    makeBodyEntity();
    eventBus.emit(PhysicsInputEvents.PAUSE, {});
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.filter((c) => c.method === 'physicsStep').length).toBe(0);
    eventBus.emit(PhysicsInputEvents.RESUME, {});
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.filter((c) => c.method === 'physicsStep').length).toBe(1);
  });

  it('entity removal emits BODY_DISPOSED and calls physicsDestroyBody', () => {
    const spy = vi.fn();
    eventBus.on(PhysicsEvents.BODY_DISPOSED, spy);
    const entity = makeBodyEntity();
    renderer.calls.length = 0;
    world.removeEntity(entity.id);
    const disposes = renderer.calls.filter((c) => c.method === 'physicsDestroyBody');
    expect(disposes.length).toBe(1);
    expect(disposes[0].args[0]).toBe(entity.id);
    expect(spy).toHaveBeenCalledWith({ entityId: entity.id });
  });

  it('shutdown disposes every body created by the system', () => {
    const a = makeBodyEntity('a');
    const b = makeBodyEntity('b');
    renderer.calls.length = 0;
    world.destroy();
    const disposeIds = new Set(
      renderer.calls.filter((c) => c.method === 'physicsDestroyBody').map((c) => c.args[0]),
    );
    expect(disposeIds.has(a.id)).toBe(true);
    expect(disposeIds.has(b.id)).toBe(true);
  });

  it('SET_GRAVITY input event forwards to physicsSetGravity', () => {
    makeBodyEntity();
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_GRAVITY, { x: 0, y: -20, z: 0 });
    const grav = renderer.calls.find((c) => c.method === 'physicsSetGravity');
    expect(grav?.args).toEqual([0, -20, 0]);
  });

  it('SET_COLLIDERS_VISIBLE input event forwards to setCollidersVisible', () => {
    makeBodyEntity();
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_COLLIDERS_VISIBLE, { visible: true });
    const vis = renderer.calls.find((c) => c.method === 'setCollidersVisible');
    expect(vis?.args).toEqual([true]);
  });

  it('SET_RESTITUTION mirrors the value onto the component and forwards to the adapter', () => {
    const entity = makeBodyEntity();
    const comp = entity.get(PhysicsComponent)!;
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_RESTITUTION, {
      entityId: entity.id,
      restitution: 0.9,
    });
    // Mirrored so serialize() picks up the live value.
    expect(comp.restitution).toBe(0.9);
    const setR = renderer.calls.find((c) => c.method === 'physicsSetRestitution');
    expect(setR?.args).toEqual([entity.id, 0.9]);
  });

  it('SET_RESTITUTION for an unknown entity still forwards to the adapter without throwing', () => {
    makeBodyEntity();
    renderer.calls.length = 0;
    expect(() =>
      eventBus.emit(PhysicsInputEvents.SET_RESTITUTION, { entityId: 'ghost', restitution: 0.3 }),
    ).not.toThrow();
    const setR = renderer.calls.find((c) => c.method === 'physicsSetRestitution');
    expect(setR?.args).toEqual(['ghost', 0.3]);
  });

  it('SET_TIME_STEP mirrors hz onto the first PhysicsComponent and forwards to the adapter', () => {
    const entity = makeBodyEntity();
    const comp = entity.get(PhysicsComponent)!;
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_TIME_STEP, { hz: 240 });
    expect(comp.simulationHz).toBe(240);
    const setTs = renderer.calls.find((c) => c.method === 'physicsSetTimeStep');
    expect(setTs?.args).toEqual([240]);
  });

  it('SET_TIME_STEP ignores non-finite or non-positive hz', () => {
    const entity = makeBodyEntity();
    const comp = entity.get(PhysicsComponent)!;
    const before = comp.simulationHz;
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_TIME_STEP, { hz: 0 });
    eventBus.emit(PhysicsInputEvents.SET_TIME_STEP, { hz: -5 });
    eventBus.emit(PhysicsInputEvents.SET_TIME_STEP, { hz: Number.POSITIVE_INFINITY });
    eventBus.emit(PhysicsInputEvents.SET_TIME_STEP, { hz: Number.NaN });
    expect(comp.simulationHz).toBe(before);
    expect(renderer.calls.some((c) => c.method === 'physicsSetTimeStep')).toBe(false);
  });

  it('applies the first PhysicsComponent simulationHz once at init for pre-existing entities', () => {
    // Build a fresh world where the entity exists BEFORE the system mounts so
    // onInitialize walks `this.entities` (tryCreateBody + applyInitialTimeStep).
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    const entity = w.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere' });
    mesh.handle = r.createMesh('pre', mesh.toPrimitiveSpec()) as ReturnType<typeof r.createMesh>;
    entity.add(mesh);
    entity.add(new PhysicsComponent({ simulationHz: 120 }));

    w.addSystem(new PhysicsSystem(eb));
    w.initialize();

    const created = r.calls.filter((c) => c.method === 'physicsCreateBody');
    expect(created.length).toBe(1);
    const ts = r.calls.filter((c) => c.method === 'physicsSetTimeStep');
    expect(ts.length).toBe(1);
    expect(ts[0].args[0]).toBe(120);
  });

  it('SET_VELOCITY for an entity whose body was never created is a no-op', () => {
    // autoCreate:false body never enters `created`, so SET_VELOCITY short-circuits.
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere' });
    mesh.handle = renderer.createMesh('nv', mesh.toPrimitiveSpec()) as ReturnType<
      typeof renderer.createMesh
    >;
    entity.add(mesh);
    entity.add(new PhysicsComponent({ autoCreate: false }));
    renderer.calls.length = 0;
    eventBus.emit(PhysicsInputEvents.SET_VELOCITY, {
      entityId: entity.id, vx: 1, vy: 1, vz: 1,
    });
    expect(renderer.calls.some((c) => c.method === 'physicsSetBodyVelocity')).toBe(false);
  });

  it('defers body creation until a sibling MeshPrimitive handle is ready', () => {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere' });
    // No handle yet — mimics the interval between component attach and System mount.
    entity.add(mesh);
    entity.add(new PhysicsComponent());
    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'physicsCreateBody')).toBe(false);
    // Mesh handle lands; next tick the body comes online.
    mesh.handle = renderer.createMesh('late', mesh.toPrimitiveSpec()) as ReturnType<
      typeof renderer.createMesh
    >;
    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.filter((c) => c.method === 'physicsCreateBody').length).toBe(1);
  });
});
