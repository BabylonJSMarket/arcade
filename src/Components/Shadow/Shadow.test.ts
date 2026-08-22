import { ShadowEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShadowComponent, ShadowSystem } from './Shadow';
import { DirectionalLightComponent } from '../DirectionalLight/DirectionalLight.defs';
import { DirectionalLightSystem } from '../DirectionalLight/DirectionalLight';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { MeshPrimitiveSystem } from '../MeshPrimitive/MeshPrimitive';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('ShadowComponent (core)', () => {
  it('defaults to cast and receive shadows', () => {
    const c = new ShadowComponent();
    expect(c.castShadow).toBe(true);
    expect(c.receiveShadow).toBe(true);
  });

  it('accepts overrides', () => {
    const c = new ShadowComponent({ castShadow: false, receiveShadow: false });
    expect(c.castShadow).toBe(false);
    expect(c.receiveShadow).toBe(false);
  });

  it('serialize round-trips', () => {
    const a = new ShadowComponent({ castShadow: true, receiveShadow: false });
    const b = new ShadowComponent(a.serialize());
    expect(b.castShadow).toBe(true);
    expect(b.receiveShadow).toBe(false);
  });
});

describe('ShadowEvents', () => {
  it('defines event names', () => {
    expect(ShadowEvents.SHADOW_ENABLED).toBe('shadow.enabled');
    expect(ShadowEvents.SHADOW_DISABLED).toBe('shadow.disabled');
    expect(ShadowEvents.SHADOW_CASTER_ADDED).toBe('shadow.caster.added');
  });
});

describe('ShadowSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new DirectionalLightSystem(eventBus));
    world.addSystem(new ShadowSystem(eventBus));
    world.addSystem(new MeshPrimitiveSystem(eventBus));
    world.initialize();
  });

  it('attaches a shadow caster when a mesh appears for an entity with cast+receive', () => {
    // Light must exist so ShadowSystem can find it.
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());

    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent({ castShadow: true, receiveShadow: true }));

    expect(renderer.calls.some((c) => c.method === 'attachShadowCaster')).toBe(true);
    expect(renderer.calls.some((c) => c.method === 'setMeshReceiveShadows' && c.args[1] === true)).toBe(true);
  });

  it('does not attach caster when castShadow is false', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());

    const floor = world.createEntity();
    floor.add(new MeshPrimitiveComponent());
    floor.add(new ShadowComponent({ castShadow: false, receiveShadow: true }));

    expect(renderer.calls.some((c) => c.method === 'attachShadowCaster')).toBe(false);
    expect(renderer.calls.some((c) => c.method === 'setMeshReceiveShadows' && c.args[1] === true)).toBe(true);
  });

  it('emits SHADOW_ENABLED with castShadow/receiveShadow flags', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());

    const spy = vi.fn();
    eventBus.on(ShadowEvents.SHADOW_ENABLED, spy);

    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent({ castShadow: true, receiveShadow: true }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: box.id, castShadow: true, receiveShadow: true }),
    );
  });

  it('emits SHADOW_CASTER_ADDED when a caster is attached', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());

    const spy = vi.fn();
    eventBus.on(ShadowEvents.SHADOW_CASTER_ADDED, spy);

    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent());

    expect(spy).toHaveBeenCalled();
  });

  it('detaches the caster on entity removal', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());

    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent());

    renderer.calls.length = 0;
    world.removeEntity(box);
    expect(renderer.calls.some((c) => c.method === 'detachShadowCaster')).toBe(true);
  });

  it('ignores meshprimitive.created / directionallight.created events with no handle', () => {
    // The listeners early-return when the payload carries no handle.
    eventBus.emit('meshprimitive.created', { entityId: 'x' });
    eventBus.emit('directionallight.created', { entityId: 'y' });
    expect(renderer.calls.some((c) => c.method === 'attachShadowCaster')).toBe(false);
  });

  it('does not attach a caster while no directional light exists yet', () => {
    // Mesh + shadow but NO light → findDirectionalLightHandle returns undefined.
    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent({ castShadow: true, receiveShadow: false }));
    expect(renderer.calls.some((c) => c.method === 'attachShadowCaster')).toBe(false);
  });

  it('re-applies across entities when a light comes up after a shadow caster mesh', () => {
    // A light created AFTER a shadow-casting mesh fires DirectionalLight CREATED,
    // which makes ShadowSystem re-scan its entities. With a light present at the
    // time the mesh's apply first runs, the caster attaches.
    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent({ castShadow: true, receiveShadow: true }));
    // No light yet → apply ran on the mesh-created event and the caster could
    // not attach (no target), but the mesh now receives shadows.
    expect(renderer.calls.some((c) => c.method === 'setMeshReceiveShadows' && c.args[1] === true)).toBe(true);

    // Bringing up a light fires CREATED → the listener re-runs apply over all
    // entities (the loop at the heart of the second listener).
    const lightEntity = world.createEntity();
    expect(() => lightEntity.add(new DirectionalLightComponent())).not.toThrow();
  });

  it('picks up meshes created before the system initializes (mesh-handle scan)', () => {
    // Fresh world: a light AND a shadow-casting mesh exist BEFORE ShadowSystem
    // is added, so onInitialize must pull the mesh handle straight off the
    // MeshPrimitiveComponent and apply it.
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    w.addSystem(new DirectionalLightSystem(bus));
    w.addSystem(new MeshPrimitiveSystem(bus));

    const lightEntity = w.createEntity();
    lightEntity.add(new DirectionalLightComponent());
    const box = w.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent({ castShadow: true, receiveShadow: true }));

    // ShadowSystem added LAST → its scan catches the already-built mesh handle
    // and applies the receive-shadows setting during onInitialize.
    w.addSystem(new ShadowSystem(bus));
    w.initialize();
    expect(r.calls.some((c) => c.method === 'setMeshReceiveShadows' && c.args[1] === true)).toBe(true);
  });

  it('keeps the caster attached when a parked (pooled) entity is removed', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent());
    const box = world.createEntity();
    box.add(new MeshPrimitiveComponent());
    box.add(new ShadowComponent());

    renderer.calls.length = 0;
    // Simulate parking: deactivating fires onEntityRemoved while inactive, so
    // the system keeps the caster attached (no detach for a parked entity).
    box.active = false;
    expect(renderer.calls.some((c) => c.method === 'detachShadowCaster')).toBe(false);
  });
});

describe('ShadowSystem — model takes the caster from the proxy', () => {
  // A vehicle keeps its MeshPrimitive as a hidden gameplay proxy and rides a
  // GLB on top. The renderer skips invisible meshes when drawing the shadow
  // map, so the caster has to move from the proxy to the loaded model or the
  // shadow disappears entirely.
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new DirectionalLightSystem(eventBus));
    world.addSystem(new ShadowSystem(eventBus));
    world.addSystem(new MeshPrimitiveSystem(eventBus));
    world.initialize();
    world.createEntity().add(new DirectionalLightComponent());
  });

  it('re-attaches the caster to the GLB handle when mesh.loaded arrives', () => {
    const car = world.createEntity();
    car.add(new MeshPrimitiveComponent({ visible: false }));
    car.add(new ShadowComponent({ castShadow: true, receiveShadow: false }));

    const before = renderer.calls.filter((c) => c.method === 'attachShadowCaster');
    expect(before).toHaveLength(1);

    eventBus.emit('mesh.loaded', {
      entityId: car.id,
      meshId: 'car-glb',
      animationNames: [],
      handle: 'model-handle',
    });

    expect(renderer.calls.some((c) => c.method === 'detachShadowCaster')).toBe(true);
    const after = renderer.calls.filter((c) => c.method === 'attachShadowCaster');
    expect(after).toHaveLength(2);
    expect(after[1].args[1]).toBe('model-handle');
  });

  it('ignores a mesh.loaded that carries no handle', () => {
    const car = world.createEntity();
    car.add(new MeshPrimitiveComponent());
    car.add(new ShadowComponent());

    eventBus.emit('mesh.loaded', { entityId: car.id, meshId: 'x', animationNames: [] });

    expect(renderer.calls.filter((c) => c.method === 'attachShadowCaster')).toHaveLength(1);
    expect(renderer.calls.some((c) => c.method === 'detachShadowCaster')).toBe(false);
  });

  it('does not let a late primitive steal the caster back from the model', () => {
    const car = world.createEntity();
    car.add(new ShadowComponent());

    eventBus.emit('mesh.loaded', {
      entityId: car.id,
      meshId: 'car-glb',
      animationNames: [],
      handle: 'model-handle',
    });
    eventBus.emit('meshprimitive.created', { entityId: car.id, handle: 'proxy-handle' });

    const attaches = renderer.calls.filter((c) => c.method === 'attachShadowCaster');
    expect(attaches).toHaveLength(1);
    expect(attaches[0].args[1]).toBe('model-handle');
  });
});
