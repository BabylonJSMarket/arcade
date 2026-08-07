import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { PointLightEvents } from '../../events';
import { PointLightComponent, PointLightSystem } from './PointLight';

describe('PointLightComponent', () => {
  it('defaults to a bounded, non-specular white lamp at eye-ish height', () => {
    const c = new PointLightComponent();
    expect(c.position).toEqual([0, 2, 0]);
    expect(c.intensity).toBe(1);
    expect(c.diffuse).toEqual([1, 1, 1]);
    // Stylized rooms want colour bounce, not glints.
    expect(c.specular).toEqual([0, 0, 0]);
    // Bounded by default so a roomful of lamps stays affordable.
    expect(c.range).toBe(10);
  });

  it('copies input arrays rather than aliasing the caller’s', () => {
    const position: [number, number, number] = [1, 2, 3];
    const c = new PointLightComponent({ position });
    position[0] = 99;
    expect(c.position).toEqual([1, 2, 3]);
  });

  it('serialize round-trips through the constructor', () => {
    const c = new PointLightComponent({
      position: [-3, 2.4, 1],
      intensity: 2.5,
      diffuse: [1, 0.15, 0.55],
      specular: [0.1, 0.1, 0.1],
      range: 6,
    });
    expect(new PointLightComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });

  it('toSpec hands the adapter a detached copy', () => {
    const c = new PointLightComponent({ position: [1, 2, 3] });
    const spec = c.toSpec();
    spec.position[0] = 99;
    expect(c.position[0]).toBe(1);
  });
});

describe('PointLightSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new PointLightSystem(eventBus));
    world.initialize();
  });

  const add = (input = {}) => {
    const e = world.createEntity();
    e.add(new PointLightComponent(input));
    world.update(1 / 60);
    return e;
  };

  it('creates one adapter light per entity and emits CREATED', () => {
    const spy = vi.fn();
    eventBus.on(PointLightEvents.CREATED, spy);
    const e = add({ position: [2, 1, -3], intensity: 3 });
    const calls = renderer.calls.filter((c) => c.method === 'createPointLight');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(e.id);
    expect((calls[0].args[1] as { position: number[] }).position).toEqual([2, 1, -3]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not recreate the light on later frames', () => {
    add();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(renderer.calls.filter((c) => c.method === 'createPointLight')).toHaveLength(1);
  });

  it('pushes an intensity change made from outside', () => {
    const e = add({ intensity: 1 });
    const spy = vi.fn();
    eventBus.on(PointLightEvents.INTENSITY_CHANGED, spy);
    e.get(PointLightComponent)!.intensity = 4;
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'updateLightIntensity');
    expect(calls.at(-1)!.args[1]).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('pushes a position change and emits MOVED', () => {
    const e = add({ position: [0, 2, 0] });
    const spy = vi.fn();
    eventBus.on(PointLightEvents.MOVED, spy);
    e.get(PointLightComponent)!.position = [5, 1, -2];
    world.update(1 / 60);
    const calls = renderer.calls.filter((c) => c.method === 'setLightPosition');
    expect(calls.at(-1)!.args.slice(1)).toEqual([5, 1, -2]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stays quiet while nothing changes', () => {
    add({ intensity: 2, position: [1, 1, 1] });
    renderer.calls.length = 0;
    world.update(1 / 60);
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'updateLightIntensity')).toBe(false);
    expect(renderer.calls.some((c) => c.method === 'setLightPosition')).toBe(false);
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
    e.add(new PointLightComponent({ position: [1, 2, 3] }));
    w.addSystem(new PointLightSystem(bus));
    w.initialize();
    const created = r.calls.filter((c) => c.method === 'createPointLight');
    expect(created).toHaveLength(1);
    expect(created[0].args[0]).toBe(e.id);
  });

  it('stays inert when the world has no renderer', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new PointLightSystem(bus));
    w.initialize();
    const e = w.createEntity();
    e.add(new PointLightComponent());
    expect(() => {
      w.update(1 / 60);
      w.update(1 / 60);
    }).not.toThrow();
  });

  it('many lamps each get their own handle', () => {
    const a = add({ position: [-3, 2, 0] });
    const b = add({ position: [3, 2, 0] });
    const created = renderer.calls.filter((c) => c.method === 'createPointLight');
    expect(created).toHaveLength(2);
    expect(created.map((c) => c.args[0])).toEqual([a.id, b.id]);
  });
});
