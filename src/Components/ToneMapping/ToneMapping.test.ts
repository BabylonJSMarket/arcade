import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToneMappingComponent,
  ToneMappingSystem,
  registerBabylonToneMappingExtension,
  type ToneMappingSettings,
  type ToneMappingExtension,
} from './ToneMapping';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('ToneMappingComponent (core)', () => {
  it('defaults to the asset-pipeline grade (aces, exposure/contrast 1.05)', () => {
    const c = new ToneMappingComponent();
    expect(c.mode).toBe('aces');
    expect(c.exposure).toBe(1.05);
    expect(c.contrast).toBe(1.05);
  });

  it('accepts overrides', () => {
    const c = new ToneMappingComponent({ mode: 'standard', exposure: 1.2, contrast: 0.9 });
    expect(c.mode).toBe('standard');
    expect(c.exposure).toBe(1.2);
    expect(c.contrast).toBe(0.9);
  });

  it('settings() bundles the values the plugin consumes', () => {
    expect(new ToneMappingComponent().settings()).toEqual({
      mode: 'aces',
      exposure: 1.05,
      contrast: 1.05,
    });
  });

  it('serialize round-trips through the constructor', () => {
    const original = new ToneMappingComponent({ mode: 'none', exposure: 2, contrast: 1.3 });
    const copy = new ToneMappingComponent(original.serialize());
    expect(copy.settings()).toEqual(original.settings());
  });
});

describe('ToneMappingSystem — applies through the adapter plugin', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let applied: ToneMappingSettings[];
  let cleared: number;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    applied = [];
    cleared = 0;
    const ext: ToneMappingExtension = {
      apply: (s) => applied.push(s),
      clear: () => {
        cleared += 1;
      },
    };
    renderer.registerExtension('toneMapping', ext);
    world = new World({ eventBus, renderer });
    world.addSystem(new ToneMappingSystem(eventBus));
    world.initialize();
  });

  it('applies the grade on entity add', () => {
    world.createEntity().add(new ToneMappingComponent({ exposure: 1.1 }));
    expect(applied).toHaveLength(1);
    expect(applied[0]).toEqual({ mode: 'aces', exposure: 1.1, contrast: 1.05 });
  });

  it('applies only once across updates', () => {
    world.createEntity().add(new ToneMappingComponent());
    world.update(0.016);
    world.update(0.016);
    expect(applied).toHaveLength(1);
  });

  it('clears on entity removal', () => {
    const e = world.createEntity();
    e.add(new ToneMappingComponent());
    world.removeEntity(e);
    expect(cleared).toBe(1);
  });

  it('no-ops when no plugin is registered', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, renderer: new MockRendererAdapter() });
    w.addSystem(new ToneMappingSystem(bus));
    w.initialize();
    expect(() => w.createEntity().add(new ToneMappingComponent())).not.toThrow();
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus });
    w.addSystem(new ToneMappingSystem(bus));
    w.initialize();
    expect(() => {
      w.createEntity().add(new ToneMappingComponent());
      w.update(0.016);
    }).not.toThrow();
  });
});

describe('registerBabylonToneMappingExtension — drives scene image processing', () => {
  function fakeHost() {
    const scene = {
      imageProcessingConfiguration: {
        toneMappingEnabled: false,
        toneMappingType: -1,
        exposure: 1,
        contrast: 1,
      },
    };
    const captured: { impl?: ToneMappingExtension } = {};
    const host = {
      registerExtension: (_name: string, i: object) => {
        captured.impl = i as ToneMappingExtension;
      },
      getScene: () => scene,
    };
    return { host, scene, captured };
  }

  it('applies ACES (type 1) + exposure + contrast', () => {
    const { host, scene, captured } = fakeHost();
    registerBabylonToneMappingExtension(host);
    captured.impl!.apply({ mode: 'aces', exposure: 1.05, contrast: 1.05 });
    expect(scene.imageProcessingConfiguration.toneMappingEnabled).toBe(true);
    expect(scene.imageProcessingConfiguration.toneMappingType).toBe(1);
    expect(scene.imageProcessingConfiguration.exposure).toBe(1.05);
    expect(scene.imageProcessingConfiguration.contrast).toBe(1.05);
  });

  it("mode 'none' disables tone mapping", () => {
    const { host, scene, captured } = fakeHost();
    registerBabylonToneMappingExtension(host);
    captured.impl!.apply({ mode: 'none', exposure: 1, contrast: 1 });
    expect(scene.imageProcessingConfiguration.toneMappingEnabled).toBe(false);
  });

  it('clear() turns tone mapping off', () => {
    const { host, scene, captured } = fakeHost();
    registerBabylonToneMappingExtension(host);
    captured.impl!.apply({ mode: 'aces', exposure: 1.05, contrast: 1.05 });
    captured.impl!.clear();
    expect(scene.imageProcessingConfiguration.toneMappingEnabled).toBe(false);
  });
});
