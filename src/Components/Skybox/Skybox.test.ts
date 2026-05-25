import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkyboxComponent, SkyboxSystem, SkyboxEvents } from './Skybox';
import { DirectionalLightComponent, DirectionalLightSystem } from '../DirectionalLight/DirectionalLight';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('SkyboxComponent (core)', () => {
  it('has cinematic sunset defaults', () => {
    const c = new SkyboxComponent();
    expect(c.zenithColor).toEqual([0.08, 0.12, 0.28]);
    expect(c.horizonColor).toEqual([0.95, 0.55, 0.32]);
    expect(c.sunGlowSize).toBe(80);
  });

  it('accepts overrides', () => {
    const c = new SkyboxComponent({
      zenithColor: [0, 0, 0],
      sunSize: 0.999,
      followLight: 'sun',
    });
    expect(c.zenithColor).toEqual([0, 0, 0]);
    expect(c.sunSize).toBe(0.999);
    expect(c.followLight).toBe('sun');
  });

  it('serialize round-trips', () => {
    const a = new SkyboxComponent({ sunDirection: [1, 1, 0], followLight: 'auto' });
    const b = new SkyboxComponent(a.serialize());
    expect(b.sunDirection).toEqual([1, 1, 0]);
    expect(b.followLight).toBe('auto');
  });

  it('toSpec emits the renderer-shaped object', () => {
    const c = new SkyboxComponent();
    const spec = c.toSpec();
    expect(spec.zenithColor).toEqual(c.zenithColor);
    expect(spec.sunSize).toBe(c.sunSize);
    expect(spec.size).toBe(c.size);
  });
});

describe('SkyboxEvents', () => {
  it('defines event names', () => {
    expect(SkyboxEvents.CREATED).toBe('skybox.created');
    expect(SkyboxEvents.SUN_CHANGED).toBe('skybox.sun.changed');
  });
});

describe('SkyboxSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new DirectionalLightSystem(eventBus));
    world.addSystem(new SkyboxSystem(eventBus));
    world.initialize();
  });

  it('creates a skybox through the renderer when component is added', () => {
    const sky = world.createEntity();
    sky.add(new SkyboxComponent());
    expect(renderer.calls.some((c) => c.method === 'createSkybox')).toBe(true);
  });

  it('emits CREATED on construction', () => {
    const spy = vi.fn();
    eventBus.on(SkyboxEvents.CREATED, spy);
    const sky = world.createEntity();
    sky.add(new SkyboxComponent());
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ entityId: sky.id }));
  });

  it('disposes the skybox on entity removal', () => {
    const sky = world.createEntity();
    sky.add(new SkyboxComponent());
    renderer.calls.length = 0;
    world.removeEntity(sky);
    expect(renderer.calls.some((c) => c.method === 'disposeSkybox')).toBe(true);
  });

  it('with followLight="auto", primes sun direction off the first DirectionalLight', () => {
    const lightEntity = world.createEntity();
    // Light direction points -X-Y; sky should take the opposite as sun.
    lightEntity.add(new DirectionalLightComponent({ direction: [-1, -1, 0] }));

    const sky = world.createEntity();
    sky.add(new SkyboxComponent({ followLight: 'auto' }));

    const createCall = renderer.calls.find((c) => c.method === 'createSkybox');
    const spec = createCall?.args[1] as { sunDirection: [number, number, number] };
    expect(spec.sunDirection[0]).toBeGreaterThan(0);
    expect(spec.sunDirection[1]).toBeGreaterThan(0);
  });

  it('with followLight set, calls updateSkyboxSun when the light direction shifts', () => {
    const lightEntity = world.createEntity();
    const light = new DirectionalLightComponent({ direction: [-1, -1, 0] });
    lightEntity.add(light);
    const sky = world.createEntity();
    sky.add(new SkyboxComponent({ followLight: 'auto' }));

    renderer.calls.length = 0;
    light.direction = [0, -1, -1];
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'updateSkyboxSun')).toBe(true);
  });

  it('with followLight="sun" (tag), tracks the tagged entity', () => {
    const lightEntity = world.createEntity();
    lightEntity.addTag('sun');
    lightEntity.add(new DirectionalLightComponent({ direction: [-1, 0, 0] }));

    const otherLight = world.createEntity();
    otherLight.add(new DirectionalLightComponent({ direction: [0, 0, -1] }));

    const sky = world.createEntity();
    sky.add(new SkyboxComponent({ followLight: 'sun' }));

    const createCall = renderer.calls.find((c) => c.method === 'createSkybox');
    const spec = createCall?.args[1] as { sunDirection: [number, number, number] };
    // sun direction should be +X (negative of -X), not +Z.
    expect(spec.sunDirection[0]).toBeGreaterThan(0.9);
  });
});
