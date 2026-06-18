import { describe, it, expect, beforeEach } from 'vitest';
import {
  EnvironmentTextureComponent,
  EnvironmentTextureSystem,
} from './EnvironmentTexture';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('EnvironmentTextureComponent (core)', () => {
  it('defaults to empty url and neutral level', () => {
    const c = new EnvironmentTextureComponent();
    expect(c.url).toBe('');
    expect(c.level).toBe(1.0);
  });

  it('accepts a url and level', () => {
    const c = new EnvironmentTextureComponent({ url: 'env.env', level: 0.7 });
    expect(c.url).toBe('env.env');
    expect(c.level).toBe(0.7);
  });

  it('defaults url to empty string when omitted from the input object', () => {
    // Input object present but without a `url` key → the `?? ''` fallback.
    const c = new EnvironmentTextureComponent({ level: 2 } as { url?: string; level: number } as never);
    expect(c.url).toBe('');
    expect(c.level).toBe(2);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new EnvironmentTextureComponent({ url: 'studio.env', level: 1.5 });
    const copy = new EnvironmentTextureComponent(original.serialize());
    expect(copy.url).toBe('studio.env');
    expect(copy.level).toBe(1.5);
  });
});

describe('EnvironmentTextureSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: EnvironmentTextureSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new EnvironmentTextureSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('applies the environment texture through the adapter on entity add', () => {
    const entity = world.createEntity();
    entity.add(new EnvironmentTextureComponent({ url: 'env.env', level: 0.8 }));
    const call = renderer.calls.find((c) => c.method === 'setEnvironmentTexture');
    expect(call).toBeDefined();
    expect(call?.args[0]).toBe('env.env');
    expect((call?.args[1] as { level: number }).level).toBe(0.8);
  });

  it('applies only once across multiple updates', () => {
    const entity = world.createEntity();
    entity.add(new EnvironmentTextureComponent({ url: 'env.env' }));
    world.update(0.016);
    world.update(0.016);
    const applied = renderer.calls.filter((c) => c.method === 'setEnvironmentTexture');
    expect(applied.length).toBe(1);
  });

  it('does not apply when url is empty', () => {
    const entity = world.createEntity();
    entity.add(new EnvironmentTextureComponent({ url: '' }));
    const call = renderer.calls.find((c) => c.method === 'setEnvironmentTexture');
    expect(call).toBeUndefined();
  });

  it('clears the environment texture when the entity is removed', () => {
    const entity = world.createEntity();
    entity.add(new EnvironmentTextureComponent({ url: 'env.env' }));
    renderer.calls.length = 0;
    world.removeEntity(entity);
    expect(renderer.calls.some((c) => c.method === 'clearEnvironmentTexture')).toBe(true);
  });

  it('no-ops on a renderer-less world (never applies a texture)', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus });
    w.addSystem(new EnvironmentTextureSystem(bus));
    w.initialize();
    const entity = w.createEntity();
    expect(() => entity.add(new EnvironmentTextureComponent({ url: 'env.env' }))).not.toThrow();
    expect(() => w.update(0.016)).not.toThrow();
  });

  it('applies to entities that already exist when the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    const entity = w.createEntity();
    entity.add(new EnvironmentTextureComponent({ url: 'studio.env', level: 0.5 }));
    // System added AFTER the entity → onInitialize applies it.
    w.addSystem(new EnvironmentTextureSystem(bus));
    w.initialize();
    const call = r.calls.find((c) => c.method === 'setEnvironmentTexture');
    expect(call).toBeDefined();
    expect(call!.args[0]).toBe('studio.env');
  });
});
