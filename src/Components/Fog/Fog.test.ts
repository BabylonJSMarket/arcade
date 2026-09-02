import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { FogEvents } from '../../events';
import { FogComponent, FogSystem } from './Fog';

describe('FogComponent', () => {
  it('defaults to thin black exp2 fog, enabled', () => {
    const c = new FogComponent();
    expect(c.mode).toBe('exp2');
    expect(c.color).toEqual([0, 0, 0]);
    expect(c.density).toBe(0.05);
    expect(c.start).toBe(10);
    expect(c.end).toBe(100);
    expect(c.enabled).toBe(true);
  });

  it('copies the colour rather than aliasing the caller’s', () => {
    const color: [number, number, number] = [0.1, 0.2, 0.3];
    const c = new FogComponent({ color });
    color[0] = 99;
    expect(c.color).toEqual([0.1, 0.2, 0.3]);
  });

  it('serialize round-trips through the constructor', () => {
    const c = new FogComponent({
      mode: 'linear',
      color: [0.01, 0.01, 0.02],
      density: 0.11,
      start: 4,
      end: 30,
      enabled: false,
    });
    expect(new FogComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });

  it('toSpec hands the adapter a detached copy without the enabled flag', () => {
    const c = new FogComponent({ color: [0.5, 0.5, 0.5] });
    const spec = c.toSpec();
    spec.color[0] = 99;
    expect(c.color[0]).toBe(0.5);
    expect(spec).toEqual({ mode: 'exp2', color: [99, 0.5, 0.5], density: 0.05, start: 10, end: 100 });
  });
});

describe('FogSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new FogSystem(eventBus));
    world.initialize();
  });

  const fogCalls = () => renderer.calls.filter((c) => c.method === 'setFog');

  it('applies the fog through the adapter when the component attaches', () => {
    const spy = vi.fn();
    eventBus.on(FogEvents.APPLIED, spy);
    const e = world.createEntity();
    e.add(new FogComponent({ mode: 'exp2', color: [0.01, 0.01, 0.02], density: 0.11 }));
    expect(fogCalls()).toHaveLength(1);
    expect(renderer.fog).toEqual({
      mode: 'exp2',
      color: [0.01, 0.01, 0.02],
      density: 0.11,
      start: 10,
      end: 100,
    });
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, mode: 'exp2', density: 0.11 });
  });

  it('stays quiet while nothing changes', () => {
    world.createEntity().add(new FogComponent());
    world.update(1 / 60);
    world.update(1 / 60);
    expect(fogCalls()).toHaveLength(1);
  });

  it('re-applies when a slider drives density live', () => {
    const e = world.createEntity();
    e.add(new FogComponent({ density: 0.05 }));
    e.get(FogComponent)!.density = 0.2;
    world.update(1 / 60);
    expect(fogCalls()).toHaveLength(2);
    expect(renderer.fog?.density).toBe(0.2);
  });

  it('re-applies on a colour, mode or range edit', () => {
    const e = world.createEntity();
    e.add(new FogComponent());
    const c = e.get(FogComponent)!;
    c.color[1] = 0.5;
    world.update(1 / 60);
    c.mode = 'linear';
    world.update(1 / 60);
    c.start = 2;
    world.update(1 / 60);
    c.end = 50;
    world.update(1 / 60);
    expect(fogCalls()).toHaveLength(5);
    expect(renderer.fog).toMatchObject({ mode: 'linear', color: [0, 0.5, 0], start: 2, end: 50 });
  });

  it('switches fog off when enabled flips false, and back on when it flips true', () => {
    const cleared = vi.fn();
    eventBus.on(FogEvents.CLEARED, cleared);
    const e = world.createEntity();
    e.add(new FogComponent());
    e.get(FogComponent)!.enabled = false;
    world.update(1 / 60);
    expect(renderer.fog).toBeNull();
    expect(cleared).toHaveBeenCalledWith({ entityId: e.id });
    // Off is off: nothing more to send while it stays disabled.
    world.update(1 / 60);
    expect(fogCalls()).toHaveLength(2);
    e.get(FogComponent)!.enabled = true;
    world.update(1 / 60);
    expect(renderer.fog).not.toBeNull();
    expect(fogCalls()).toHaveLength(3);
  });

  it('a component that starts disabled never touches the adapter', () => {
    world.createEntity().add(new FogComponent({ enabled: false }));
    world.update(1 / 60);
    expect(fogCalls()).toHaveLength(0);
  });

  it('clears the fog when the entity is removed', () => {
    const cleared = vi.fn();
    eventBus.on(FogEvents.CLEARED, cleared);
    const e = world.createEntity();
    e.add(new FogComponent());
    world.removeEntity(e);
    expect(renderer.fog).toBeNull();
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('removing a disabled component does not clear (nothing was applied)', () => {
    const cleared = vi.fn();
    eventBus.on(FogEvents.CLEARED, cleared);
    const e = world.createEntity();
    e.add(new FogComponent({ enabled: false }));
    world.removeEntity(e);
    expect(fogCalls()).toHaveLength(0);
    expect(cleared).not.toHaveBeenCalled();
  });

  it('applies to entities that already exist when the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    w.createEntity().add(new FogComponent({ density: 0.3 }));
    w.addSystem(new FogSystem(bus));
    w.initialize();
    expect(r.fog?.density).toBe(0.3);
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new FogSystem(bus));
    w.initialize();
    const e = w.createEntity();
    expect(() => {
      e.add(new FogComponent());
      w.update(1 / 60);
      w.removeEntity(e);
    }).not.toThrow();
  });
});
