import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DirectionalLightComponent,
  DirectionalLightSystem,
  DirectionalLightEvents,
} from './DirectionalLight';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('DirectionalLightComponent (core)', () => {
  it('defaults to downward-ish normalized direction and position [15, 30, 15]', () => {
    const c = new DirectionalLightComponent();
    const len = Math.hypot(c.direction[0], c.direction[1], c.direction[2]);
    expect(len).toBeCloseTo(1);
    expect(c.position).toEqual([15, 30, 15]);
    expect(c.intensity).toBe(0.8);
    expect(c.diffuse).toEqual([1, 1, 1]);
    expect(c.specular).toEqual([1, 1, 1]);
    expect(c.shadowEnabled).toBe(true);
    expect(c.shadowMapSize).toBe(1024);
    expect(c.autoCreate).toBe(true);
    expect(c.initialized).toBe(false);
    expect(c.handle).toBeUndefined();
  });

  it('normalizes direction when provided', () => {
    const c = new DirectionalLightComponent({ direction: [2, 0, 0] });
    expect(c.direction[0]).toBeCloseTo(1);
    expect(c.direction[1]).toBeCloseTo(0);
    expect(c.direction[2]).toBeCloseTo(0);
  });

  it('accepts full configuration', () => {
    const c = new DirectionalLightComponent({
      direction: [-1, -3, -1],
      position: [10, 20, 10],
      intensity: 1.2,
      diffuse: [0.9, 0.9, 1],
      specular: [0.3, 0.3, 0.3],
      shadowEnabled: false,
      shadowMinZ: 1,
      shadowMaxZ: 200,
      shadowMapSize: 2048,
      autoCreate: false,
    });
    expect(c.intensity).toBe(1.2);
    expect(c.shadowEnabled).toBe(false);
    expect(c.shadowMapSize).toBe(2048);
    expect(c.autoCreate).toBe(false);
    expect(c.position).toEqual([10, 20, 10]);
  });

  it('toSpec produces a DirectionalLightSpec with the shadow sub-spec', () => {
    const c = new DirectionalLightComponent({ shadowMapSize: 512, shadowMaxZ: 300 });
    const spec = c.toSpec();
    expect(spec.shadow?.mapSize).toBe(512);
    expect(spec.shadow?.maxZ).toBe(300);
    expect(spec.shadow?.enabled).toBe(true);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new DirectionalLightComponent({
      direction: [-1, -3, -1],
      position: [10, 20, 10],
      intensity: 0.6,
      diffuse: [1, 1, 0.9],
      shadowEnabled: false,
      autoCreate: false,
    });
    const copy = new DirectionalLightComponent(original.serialize());
    expect(copy.intensity).toBe(0.6);
    expect(copy.shadowEnabled).toBe(false);
    expect(copy.autoCreate).toBe(false);
    expect(copy.position).toEqual([10, 20, 10]);
  });
});

describe('DirectionalLight event names', () => {
  it('defines all standard events', () => {
    expect(DirectionalLightEvents.CREATED).toBe('directionallight.created');
    expect(DirectionalLightEvents.DIRECTION_CHANGED).toBe('directionallight.direction.changed');
    expect(DirectionalLightEvents.INTENSITY_CHANGED).toBe('directionallight.intensity.changed');
    expect(DirectionalLightEvents.COLOR_CHANGED).toBe('directionallight.color.changed');
    expect(DirectionalLightEvents.SHADOW_CREATED).toBe('directionallight.shadow.created');
  });
});

describe('DirectionalLightSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: DirectionalLightSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new DirectionalLightSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a light through the adapter on entity add', () => {
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent({ intensity: 0.5 }));
    const call = renderer.calls.find((c) => c.method === 'createDirectionalLight');
    expect(call).toBeDefined();
    expect((call?.args[1] as { intensity: number }).intensity).toBe(0.5);
  });

  it('does not auto-create when autoCreate is false', () => {
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent({ autoCreate: false }));
    expect(renderer.calls.find((c) => c.method === 'createDirectionalLight')).toBeUndefined();
  });

  it('emits CREATED event', () => {
    const spy = vi.fn();
    eventBus.on(DirectionalLightEvents.CREATED, spy);
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: entity.id,
        intensity: 0.8,
      }),
    );
  });

  it('emits SHADOW_CREATED when shadows are enabled', () => {
    const spy = vi.fn();
    eventBus.on(DirectionalLightEvents.SHADOW_CREATED, spy);
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent({ shadowMapSize: 512 }));
    expect(spy).toHaveBeenCalledWith({ entityId: entity.id, shadowMapSize: 512 });
  });

  it('does not emit SHADOW_CREATED when shadows are disabled', () => {
    const spy = vi.fn();
    eventBus.on(DirectionalLightEvents.SHADOW_CREATED, spy);
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent({ shadowEnabled: false }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards intensity changes through the adapter', () => {
    const entity = world.createEntity();
    const comp = new DirectionalLightComponent({ intensity: 0.5 });
    entity.add(comp);
    renderer.calls.length = 0;
    comp.intensity = 1.0;
    world.update(0.016);
    expect(renderer.calls.find((c) => c.method === 'updateLightIntensity')?.args[1]).toBe(1.0);
  });

  it('emits DIRECTION_CHANGED when the direction mutates', () => {
    const spy = vi.fn();
    eventBus.on(DirectionalLightEvents.DIRECTION_CHANGED, spy);
    const entity = world.createEntity();
    const comp = new DirectionalLightComponent();
    entity.add(comp);
    comp.direction[0] = 1;
    comp.direction[1] = 0;
    comp.direction[2] = 0;
    world.update(0.016);
    expect(spy).toHaveBeenCalled();
  });

  it('emits COLOR_CHANGED when diffuse or specular mutates', () => {
    const spy = vi.fn();
    eventBus.on(DirectionalLightEvents.COLOR_CHANGED, spy);
    const entity = world.createEntity();
    const comp = new DirectionalLightComponent();
    entity.add(comp);
    comp.diffuse[0] = 0.5;
    world.update(0.016);
    expect(spy).toHaveBeenCalled();
  });

  it('disposes the light on entity removal', () => {
    const entity = world.createEntity();
    entity.add(new DirectionalLightComponent());
    renderer.calls.length = 0;
    world.removeEntity(entity);
    expect(renderer.calls.some((c) => c.method === 'disposeLight')).toBe(true);
  });
});
