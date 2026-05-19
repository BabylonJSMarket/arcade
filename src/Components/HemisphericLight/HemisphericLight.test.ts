import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HemisphericLightComponent,
  HemisphericLightSystem,
  HemisphericLightEvents,
} from './HemisphericLight';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('HemisphericLightComponent (core)', () => {
  it('defaults to upward direction, 0.3 intensity, white diffuse', () => {
    const c = new HemisphericLightComponent();
    expect(c.direction).toEqual([0, 1, 0]);
    expect(c.intensity).toBe(0.3);
    expect(c.diffuse).toEqual([1, 1, 1]);
    expect(c.groundColor).toEqual([0.2, 0.2, 0.2]);
    expect(c.specular).toEqual([0, 0, 0]);
    expect(c.initialized).toBe(false);
    expect(c.handle).toBeUndefined();
  });

  it('normalizes direction when provided', () => {
    const c = new HemisphericLightComponent({ direction: [2, 0, 0] });
    expect(c.direction[0]).toBeCloseTo(1);
    expect(c.direction[1]).toBeCloseTo(0);
    expect(c.direction[2]).toBeCloseTo(0);
  });

  it('accepts full color config as tuples', () => {
    const c = new HemisphericLightComponent({
      direction: [0, 1, 0],
      intensity: 0.6,
      diffuse: [0.9, 0.9, 1],
      groundColor: [0.3, 0.2, 0.1],
      specular: [0.1, 0.1, 0.1],
    });
    expect(c.intensity).toBe(0.6);
    expect(c.diffuse).toEqual([0.9, 0.9, 1]);
    expect(c.groundColor).toEqual([0.3, 0.2, 0.1]);
    expect(c.specular).toEqual([0.1, 0.1, 0.1]);
  });

  it('toSpec returns a plain HemisphericLightSpec', () => {
    const c = new HemisphericLightComponent({ intensity: 0.5 });
    const spec = c.toSpec();
    expect(spec.intensity).toBe(0.5);
    expect(spec.direction).toEqual([0, 1, 0]);
    expect(spec.diffuse).toEqual([1, 1, 1]);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new HemisphericLightComponent({
      direction: [0, 1, 0],
      intensity: 0.7,
      diffuse: [0.8, 0.9, 1],
      groundColor: [0.3, 0.25, 0.2],
      specular: [0.05, 0.05, 0.05],
    });
    const copy = new HemisphericLightComponent(original.serialize());
    expect(copy.intensity).toBe(0.7);
    expect(copy.diffuse).toEqual([0.8, 0.9, 1]);
    expect(copy.groundColor).toEqual([0.3, 0.25, 0.2]);
  });
});

describe('HemisphericLight event names', () => {
  it('defines CREATED and INTENSITY_CHANGED', () => {
    expect(HemisphericLightEvents.CREATED).toBe('hemisphericlight.created');
    expect(HemisphericLightEvents.INTENSITY_CHANGED).toBe('hemisphericlight.intensity.changed');
  });
});

describe('HemisphericLightSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: HemisphericLightSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new HemisphericLightSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a light through the adapter on entity add', () => {
    const entity = world.createEntity();
    const comp = new HemisphericLightComponent({ intensity: 0.5 });
    entity.add(comp);
    expect(comp.initialized).toBe(true);
    expect(comp.handle).toBeDefined();
    const call = renderer.calls.find((c) => c.method === 'createHemisphericLight');
    expect(call).toBeDefined();
    expect((call?.args[1] as { intensity: number }).intensity).toBe(0.5);
  });

  it('emits CREATED with entity id and intensity', () => {
    const spy = vi.fn();
    eventBus.on(HemisphericLightEvents.CREATED, spy);
    const entity = world.createEntity();
    entity.add(new HemisphericLightComponent({ intensity: 0.4 }));
    expect(spy).toHaveBeenCalledWith({ entityId: entity.id, intensity: 0.4 });
  });

  it('forwards intensity changes through the adapter on update', () => {
    const entity = world.createEntity();
    const comp = new HemisphericLightComponent({ intensity: 0.3 });
    entity.add(comp);
    renderer.calls.length = 0;
    comp.intensity = 0.9;
    world.update(0.016);
    const call = renderer.calls.find((c) => c.method === 'updateLightIntensity');
    expect(call?.args[1]).toBe(0.9);
  });

  it('emits INTENSITY_CHANGED when intensity mutates after creation', () => {
    const spy = vi.fn();
    eventBus.on(HemisphericLightEvents.INTENSITY_CHANGED, spy);
    const entity = world.createEntity();
    const comp = new HemisphericLightComponent({ intensity: 0.3 });
    entity.add(comp);
    comp.intensity = 0.7;
    world.update(0.016);
    expect(spy).toHaveBeenCalledWith({ entityId: entity.id, intensity: 0.7 });
  });

  it('disposes the light when entity is removed', () => {
    const entity = world.createEntity();
    entity.add(new HemisphericLightComponent());
    renderer.calls.length = 0;
    world.removeEntity(entity);
    expect(renderer.calls.some((c) => c.method === 'disposeLight')).toBe(true);
  });
});
