import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { AmbientOcclusionEvents } from '../../events';
import {
  AMBIENT_OCCLUSION_EXTENSION,
  AmbientOcclusionComponent,
  AmbientOcclusionSystem,
  type AmbientOcclusionExtension,
  type AmbientOcclusionSettings,
} from './AmbientOcclusion';

const ROOM = { radius: 0.8, strength: 1.0, samples: 8, maxZ: 40, base: 0.1, blurRatio: 1.0, ssaoRatio: 0.5 };

describe('AmbientOcclusionComponent', () => {
  it('defaults to the arcade-room SSAO2 settings, enabled', () => {
    const c = new AmbientOcclusionComponent();
    expect(c.settings()).toEqual(ROOM);
    expect(c.enabled).toBe(true);
  });

  it('accepts overrides', () => {
    const c = new AmbientOcclusionComponent({ radius: 2, samples: 16, enabled: false });
    expect(c.radius).toBe(2);
    expect(c.samples).toBe(16);
    expect(c.enabled).toBe(false);
  });

  it('serialize round-trips through the constructor', () => {
    const c = new AmbientOcclusionComponent({ ...ROOM, strength: 1.5, ssaoRatio: 1, enabled: false });
    expect(new AmbientOcclusionComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });
});

describe('AmbientOcclusionSystem — applies through the adapter plugin', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let applied: AmbientOcclusionSettings[];
  let cleared: number;
  let supported: boolean;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    applied = [];
    cleared = 0;
    supported = true;
    const ext: AmbientOcclusionExtension = {
      apply: (s) => {
        applied.push(s);
        return supported;
      },
      clear: () => {
        cleared += 1;
      },
    };
    renderer.registerExtension(AMBIENT_OCCLUSION_EXTENSION, ext);
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new AmbientOcclusionSystem(eventBus));
    world.initialize();
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('applies the pass on entity add and emits APPLIED', () => {
    const spy = vi.fn();
    eventBus.on(AmbientOcclusionEvents.APPLIED, spy);
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent(ROOM));
    expect(applied).toEqual([ROOM]);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id });
  });

  it('applies only once while nothing changes', () => {
    world.createEntity().add(new AmbientOcclusionComponent());
    world.update(1 / 60);
    world.update(1 / 60);
    expect(applied).toHaveLength(1);
  });

  it('retunes live when a field changes', () => {
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent());
    e.get(AmbientOcclusionComponent)!.strength = 1.5;
    world.update(1 / 60);
    expect(applied).toHaveLength(2);
    expect(applied[1].strength).toBe(1.5);
  });

  it('enabled=false clears, enabled=true re-applies', () => {
    const clearedSpy = vi.fn();
    eventBus.on(AmbientOcclusionEvents.CLEARED, clearedSpy);
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent());
    e.get(AmbientOcclusionComponent)!.enabled = false;
    world.update(1 / 60);
    expect(cleared).toBe(1);
    expect(clearedSpy).toHaveBeenCalledWith({ entityId: e.id });
    world.update(1 / 60);
    expect(cleared).toBe(1);
    e.get(AmbientOcclusionComponent)!.enabled = true;
    world.update(1 / 60);
    expect(applied).toHaveLength(2);
  });

  it('a component that starts disabled never applies, and removing it never clears', () => {
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent({ enabled: false }));
    world.update(1 / 60);
    world.removeEntity(e);
    expect(applied).toHaveLength(0);
    expect(cleared).toBe(0);
  });

  it('clears on entity removal', () => {
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent());
    world.removeEntity(e);
    expect(cleared).toBe(1);
  });

  it('reports UNSUPPORTED once when the plugin says the engine cannot run it', () => {
    supported = false;
    const spy = vi.fn();
    eventBus.on(AmbientOcclusionEvents.UNSUPPORTED, spy);
    const e = world.createEntity();
    e.add(new AmbientOcclusionComponent());
    world.update(1 / 60);
    e.get(AmbientOcclusionComponent)!.radius = 2;
    world.update(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, reason: 'the engine cannot run SSAO2' });
    expect(warn).toHaveBeenCalledTimes(1);
    // Never applied, so removal has nothing to clear.
    world.removeEntity(e);
    expect(cleared).toBe(0);
  });

  it('applies to entities that already exist when the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const seen: AmbientOcclusionSettings[] = [];
    r.registerExtension(AMBIENT_OCCLUSION_EXTENSION, { apply: (s: AmbientOcclusionSettings) => (seen.push(s), true), clear: () => {} });
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    w.createEntity().add(new AmbientOcclusionComponent({ radius: 2 }));
    w.addSystem(new AmbientOcclusionSystem(bus));
    w.initialize();
    expect(seen).toHaveLength(1);
    expect(seen[0].radius).toBe(2);
  });
});

describe('AmbientOcclusionSystem — degrades without a plugin', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('warns once, emits UNSUPPORTED once, and stays quiet after', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, renderer: new MockRendererAdapter(), detectRaces: false });
    w.addSystem(new AmbientOcclusionSystem(bus));
    w.initialize();
    const spy = vi.fn();
    bus.on(AmbientOcclusionEvents.UNSUPPORTED, spy);
    const e = w.createEntity();
    e.add(new AmbientOcclusionComponent());
    for (let i = 0; i < 5; i++) w.update(1 / 60);
    e.get(AmbientOcclusionComponent)!.radius = 3;
    w.update(1 / 60);
    w.createEntity().add(new AmbientOcclusionComponent());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, reason: 'no adapter plugin registered' });
    expect(() => w.removeEntity(e)).not.toThrow();
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new AmbientOcclusionSystem(bus));
    w.initialize();
    expect(() => {
      w.createEntity().add(new AmbientOcclusionComponent());
      w.update(1 / 60);
    }).not.toThrow();
  });
});
