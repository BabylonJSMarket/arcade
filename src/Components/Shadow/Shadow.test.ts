import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShadowComponent, ShadowSystem, ShadowEvents } from './Shadow';
import { DirectionalLightComponent, DirectionalLightSystem } from '../DirectionalLight/DirectionalLight';
import { MeshPrimitiveSystem, MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('ShadowComponent (core)', () => {
  it('defaults to cast and receive shadows', () => {
    const c = new ShadowComponent();
    expect(c.castShadow).toBe(true);
    expect(c.receiveShadow).toBe(true);
    expect(c.initialized).toBe(false);
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
});
