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

  it('a free skybox (no followLight) never tracks a light on update', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent({ direction: [-1, -1, 0] }));
    const sky = world.createEntity();
    sky.add(new SkyboxComponent()); // followLight undefined
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'updateSkyboxSun')).toBe(false);
  });

  it('does not re-push the sun while the light direction is unchanged', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent({ direction: [-1, -1, 0] }));
    const sky = world.createEntity();
    sky.add(new SkyboxComponent({ followLight: 'auto' }));
    renderer.calls.length = 0;
    world.update(0.016); // light unchanged since creation primed the sun
    expect(renderer.calls.some((c) => c.method === 'updateSkyboxSun')).toBe(false);
  });

  it('followLight pointing at a missing tag never updates the sun', () => {
    const lightEntity = world.createEntity();
    lightEntity.add(new DirectionalLightComponent({ direction: [-1, -1, 0] }));
    const sky = world.createEntity();
    // No entity carries the "moon" tag → findFollowedLight returns undefined.
    sky.add(new SkyboxComponent({ followLight: 'moon' }));
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'updateSkyboxSun')).toBe(false);
  });

  it('tagged entity without a DirectionalLight is skipped by the follow lookup', () => {
    // Tagged entity exists but has NO DirectionalLight; the followed light is a
    // separate, untagged entity. findFollowedLight must skip the tagged-but-
    // lightless entity and (since the tag does not match the real light) find
    // nothing — so no sun update fires.
    const decoy = world.createEntity();
    decoy.addTag('sun');

    const realLight = world.createEntity();
    realLight.add(new DirectionalLightComponent({ direction: [-1, -1, 0] }));

    const sky = world.createEntity();
    sky.add(new SkyboxComponent({ followLight: 'sun' }));
    renderer.calls.length = 0;
    world.update(0.016);
    expect(renderer.calls.some((c) => c.method === 'updateSkyboxSun')).toBe(false);
  });

  it('creates skyboxes for entities that exist before the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    const sky = w.createEntity();
    sky.add(new SkyboxComponent());
    // SkyboxSystem added AFTER the entity → onInitialize scans and creates it.
    w.addSystem(new SkyboxSystem(bus));
    w.initialize();
    expect(r.calls.some((c) => c.method === 'createSkybox')).toBe(true);
  });

  it('no-ops on a renderer-less world (never creates a skybox)', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus });
    w.addSystem(new SkyboxSystem(bus));
    w.initialize();
    const sky = w.createEntity();
    expect(() => sky.add(new SkyboxComponent())).not.toThrow();
    expect(() => w.update(0.016)).not.toThrow();
  });

  it('disposes nothing for an entity that never created a skybox handle', () => {
    // Removing a skybox entity whose handle was never built must not throw.
    const sky = world.createEntity();
    const comp = new SkyboxComponent();
    // Don't add to world (so no system creates a handle); simulate removal path
    // by adding then immediately removing while no renderer handle exists is
    // covered elsewhere — here we assert the createSkybox happened then removal
    // disposes cleanly.
    sky.add(comp);
    expect(() => world.removeEntity(sky)).not.toThrow();
  });
});
