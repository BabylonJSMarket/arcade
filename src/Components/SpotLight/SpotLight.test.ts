import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { SpotLightEvents } from '../../events';
import { SpotLightComponent, SpotLightSystem } from './SpotLight';

describe('SpotLightComponent', () => {
  it('defaults to a bounded, non-specular white can-light pointing down', () => {
    const c = new SpotLightComponent();
    expect(c.position).toEqual([0, 3, 0]);
    expect(c.direction).toEqual([0, -1, 0]);
    expect(c.angle).toBeCloseTo(Math.PI / 3);
    expect(c.exponent).toBe(2);
    expect(c.intensity).toBe(1);
    expect(c.diffuse).toEqual([1, 1, 1]);
    // Coloured pools, not glints.
    expect(c.specular).toEqual([0, 0, 0]);
    // A spot is a local accent; bounded so it never leaks down a corridor.
    expect(c.range).toBe(10);
  });

  it('copies input arrays rather than aliasing the caller’s', () => {
    const position: [number, number, number] = [1, 2, 3];
    const direction: [number, number, number] = [0, 0, 1];
    const c = new SpotLightComponent({ position, direction });
    position[0] = 99;
    direction[2] = 99;
    expect(c.position).toEqual([1, 2, 3]);
    expect(c.direction).toEqual([0, 0, 1]);
  });

  it('serialize round-trips through the constructor', () => {
    const c = new SpotLightComponent({
      position: [-5.5, 2.35, 0.4],
      direction: [1, -0.2, 0],
      angle: Math.PI * 0.95,
      exponent: 1,
      intensity: 3,
      diffuse: [1, 0.15, 0.55],
      specular: [0.1, 0.1, 0.1],
      range: 6,
    });
    expect(new SpotLightComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });

  it('toSpec hands the adapter a detached copy', () => {
    const c = new SpotLightComponent({ position: [1, 2, 3], direction: [0, -1, 0] });
    const spec = c.toSpec();
    spec.position[0] = 99;
    spec.direction[1] = 99;
    expect(c.position[0]).toBe(1);
    expect(c.direction[1]).toBe(-1);
    expect(spec.angle).toBeCloseTo(Math.PI / 3);
    expect(spec.exponent).toBe(2);
  });
});

describe('SpotLightSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new SpotLightSystem(eventBus));
    world.initialize();
  });

  const add = (input = {}) => {
    const e = world.createEntity();
    e.add(new SpotLightComponent(input));
    world.update(1 / 60);
    return e;
  };

  it('creates one adapter spot per entity and emits CREATED', () => {
    const spy = vi.fn();
    eventBus.on(SpotLightEvents.CREATED, spy);
    const e = add({ position: [2, 3, -3], direction: [0, -1, 1], intensity: 3 });
    const calls = renderer.calls.filter((c) => c.method === 'createSpotLight');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(e.id);
    const spec = calls[0].args[1] as { position: number[]; direction: number[] };
    expect(spec.position).toEqual([2, 3, -3]);
    expect(spec.direction).toEqual([0, -1, 1]);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, intensity: 3 });
  });

  it('does not recreate the light on later frames', () => {
    add();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(renderer.calls.filter((c) => c.method === 'createSpotLight')).toHaveLength(1);
  });

  it('pushes an intensity change made from outside', () => {
    const e = add({ intensity: 1 });
    const spy = vi.fn();
    eventBus.on(SpotLightEvents.INTENSITY_CHANGED, spy);
    e.get(SpotLightComponent)!.intensity = 4;
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'updateLightIntensity');
    expect(calls.at(-1)!.args[1]).toBe(4);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, intensity: 4 });
  });

  it('pushes a position change and emits MOVED', () => {
    const e = add({ position: [0, 3, 0] });
    const spy = vi.fn();
    eventBus.on(SpotLightEvents.MOVED, spy);
    e.get(SpotLightComponent)!.position = [5, 1, -2];
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'setLightPosition');
    expect(calls.at(-1)!.args.slice(1)).toEqual([5, 1, -2]);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, position: [5, 1, -2] });
  });

  it('re-aims the light when direction changes', () => {
    const e = add({ direction: [0, -1, 0] });
    e.get(SpotLightComponent)!.direction = [1, 0, 0];
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'setLightDirection');
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(1)).toEqual([1, 0, 0]);
  });

  it('recolours the light when diffuse changes', () => {
    const e = add({ diffuse: [1, 1, 1] });
    e.get(SpotLightComponent)!.diffuse = [1, 0.15, 0.55];
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'setLightColor');
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(1)).toEqual([1, 0.15, 0.55]);
  });

  it('stays quiet while nothing changes', () => {
    add({ intensity: 2, position: [1, 1, 1], direction: [0, -1, 0], diffuse: [0.2, 0.9, 1] });
    renderer.calls.length = 0;
    world.update(1 / 60);
    world.update(1 / 60);
    const touched = ['updateLightIntensity', 'setLightPosition', 'setLightDirection', 'setLightColor'];
    expect(renderer.calls.some((c) => touched.includes(c.method))).toBe(false);
  });

  it('disposes the adapter light when the entity goes away', () => {
    const e = add();
    world.removeEntity(e.id);
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'disposeLight')).toBe(true);
  });

  it('creates lights for entities that already existed before initialize', () => {
    // The scene-loader path: entities are built first, then the world starts.
    // onInitialize has to sweep them, not just react to later additions.
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    const e = w.createEntity();
    e.add(new SpotLightComponent({ position: [1, 2, 3] }));
    w.addSystem(new SpotLightSystem(bus));
    w.initialize();
    const created = r.calls.filter((c) => c.method === 'createSpotLight');
    expect(created).toHaveLength(1);
    expect(created[0].args[0]).toBe(e.id);
  });

  it('stays inert when the world has no renderer', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new SpotLightSystem(bus));
    w.initialize();
    const e = w.createEntity();
    e.add(new SpotLightComponent());
    expect(() => {
      w.update(1 / 60);
      w.update(1 / 60);
    }).not.toThrow();
  });

  it('nine signs each get their own spot', () => {
    const ids = Array.from({ length: 9 }, (_, i) => add({ position: [i, 2, 0] }).id);
    const created = renderer.calls.filter((c) => c.method === 'createSpotLight');
    expect(created.map((c) => c.args[0])).toEqual(ids);
  });
});
