import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';
import { GlowLayerEvents, MeshEvents, MeshPrimitiveEvents } from '../../events';
import { GlowLayerComponent, GlowLayerSystem } from './GlowLayer';

const handle = (id: string) => ({ __mockHandle: `mesh:${id}` }) as unknown as MeshHandle;

describe('GlowLayerComponent', () => {
  it('defaults to a modest quarter-res bloom that enrols every mesh', () => {
    const c = new GlowLayerComponent();
    expect(c.intensity).toBe(0.45);
    expect(c.textureRatio).toBe(0.25);
    expect(c.samples).toBeUndefined();
    expect(c.enabled).toBe(true);
    expect(c.includeEmissive).toBe(true);
  });

  it('serialize round-trips through the constructor (samples only when set)', () => {
    const bare = new GlowLayerComponent({ intensity: 0.9, textureRatio: 0.5, enabled: false, includeEmissive: false });
    expect(new GlowLayerComponent(bare.serialize()).serialize()).toEqual(bare.serialize());
    expect('samples' in bare.serialize()).toBe(false);
    const sampled = new GlowLayerComponent({ samples: 4 });
    expect(sampled.serialize().samples).toBe(4);
    expect(new GlowLayerComponent(sampled.serialize()).samples).toBe(4);
  });

  it('toSpec carries samples only when set', () => {
    expect(new GlowLayerComponent().toSpec()).toEqual({ intensity: 0.45, textureRatio: 0.25 });
    expect(new GlowLayerComponent({ samples: 2 }).toSpec()).toEqual({ intensity: 0.45, textureRatio: 0.25, samples: 2 });
  });
});

describe('GlowLayerSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new GlowLayerSystem(eventBus));
    world.initialize();
  });

  const calls = (m: string) => renderer.calls.filter((c) => c.method === m);
  const addLayer = (input = {}) => {
    const e = world.createEntity();
    e.add(new GlowLayerComponent(input));
    return e;
  };

  it('brings the layer up through the adapter and emits APPLIED', () => {
    const spy = vi.fn();
    eventBus.on(GlowLayerEvents.APPLIED, spy);
    const e = addLayer({ intensity: 0.45, textureRatio: 0.25 });
    expect(calls('setGlowLayer')).toHaveLength(1);
    expect(calls('setGlowLayer')[0].args[0]).toEqual({ intensity: 0.45, textureRatio: 0.25 });
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, intensity: 0.45 });
  });

  it('enrols meshes that appear after the layer is up (the empty-whitelist rule)', () => {
    const enrolled = vi.fn();
    eventBus.on(GlowLayerEvents.MESH_ENROLLED, enrolled);
    const e = addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    eventBus.emit(MeshEvents.LOADED, { entityId: 'cabinet', meshId: 'cabinet', animationNames: [], handle: handle('cabinet') });
    expect(calls('addGlowMesh').map((c) => c.args[0])).toEqual([handle('wall'), handle('cabinet')]);
    expect(enrolled).toHaveBeenCalledTimes(2);
    expect(enrolled).toHaveBeenLastCalledWith({ entityId: e.id, meshEntityId: 'cabinet' });
  });

  it('enrols meshes that appeared BEFORE the layer, once it comes up', () => {
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'floor', primitive: 'ground', handle: handle('floor') });
    expect(calls('addGlowMesh')).toHaveLength(0);
    addLayer();
    expect(calls('addGlowMesh')).toHaveLength(1);
    expect(calls('addGlowMesh')[0].args[0]).toEqual(handle('floor'));
  });

  it('ignores mesh announcements with no handle (the Three adapter path)', () => {
    addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'ghost', primitive: 'box' });
    expect(calls('addGlowMesh')).toHaveLength(0);
  });

  it('never enrols twice for the same entity', () => {
    addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    expect(calls('addGlowMesh')).toHaveLength(1);
  });

  it('with includeEmissive false the layer is up but stays empty', () => {
    addLayer({ includeEmissive: false });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    expect(calls('setGlowLayer')).toHaveLength(1);
    expect(calls('addGlowMesh')).toHaveLength(0);
  });

  it('drops a disposed mesh from the whitelist', () => {
    addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    eventBus.emit(MeshPrimitiveEvents.DISPOSED, { entityId: 'wall' });
    expect(calls('removeGlowMesh')).toHaveLength(1);
    // Forgotten: a later layer does not resurrect it.
    eventBus.emit(MeshPrimitiveEvents.DISPOSED, { entityId: 'never-seen' });
    expect(calls('removeGlowMesh')).toHaveLength(1);
  });

  it('a disposed-but-never-enrolled mesh is just forgotten', () => {
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'early', primitive: 'box', handle: handle('early') });
    eventBus.emit(MeshPrimitiveEvents.DISPOSED, { entityId: 'early' });
    addLayer();
    expect(calls('removeGlowMesh')).toHaveLength(0);
    expect(calls('addGlowMesh')).toHaveLength(0);
  });

  it('pushes an intensity change live without rebuilding the whitelist', () => {
    const e = addLayer({ intensity: 0.45 });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    e.get(GlowLayerComponent)!.intensity = 0.9;
    world.update(1 / 60);
    expect(calls('setGlowLayer')).toHaveLength(2);
    expect((calls('setGlowLayer')[1].args[0] as { intensity: number }).intensity).toBe(0.9);
    expect(calls('addGlowMesh')).toHaveLength(1);
    world.update(1 / 60);
    expect(calls('setGlowLayer')).toHaveLength(2);
  });

  it('enabled=false takes the layer down (un-enrolling), true brings it back', () => {
    const cleared = vi.fn();
    eventBus.on(GlowLayerEvents.CLEARED, cleared);
    const e = addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    e.get(GlowLayerComponent)!.enabled = false;
    world.update(1 / 60);
    expect(calls('removeGlowMesh')).toHaveLength(1);
    expect(calls('setGlowLayer').at(-1)!.args[0]).toBeNull();
    expect(cleared).toHaveBeenCalledWith({ entityId: e.id });
    world.update(1 / 60);
    expect(calls('setGlowLayer')).toHaveLength(2);
    e.get(GlowLayerComponent)!.enabled = true;
    world.update(1 / 60);
    expect(calls('setGlowLayer')).toHaveLength(3);
    // The remembered mesh is enrolled again.
    expect(calls('addGlowMesh')).toHaveLength(2);
  });

  it('a component that starts disabled never touches the adapter', () => {
    addLayer({ enabled: false });
    world.update(1 / 60);
    expect(calls('setGlowLayer')).toHaveLength(0);
  });

  it('tears the layer down when the entity is removed', () => {
    const e = addLayer();
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
    world.removeEntity(e);
    expect(calls('removeGlowMesh')).toHaveLength(1);
    expect(calls('setGlowLayer').at(-1)!.args[0]).toBeNull();
    // Removing a component whose layer was already down is a no-op.
    const e2 = addLayer({ enabled: false });
    world.removeEntity(e2);
    expect(calls('setGlowLayer')).toHaveLength(2);
  });

  it('applies to entities that already exist when the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    w.createEntity().add(new GlowLayerComponent({ intensity: 0.7 }));
    w.addSystem(new GlowLayerSystem(bus));
    w.initialize();
    expect(r.calls.filter((c) => c.method === 'setGlowLayer')).toHaveLength(1);
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new GlowLayerSystem(bus));
    w.initialize();
    const e = w.createEntity();
    expect(() => {
      e.add(new GlowLayerComponent());
      bus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'wall', primitive: 'box', handle: handle('wall') });
      w.update(1 / 60);
      w.removeEntity(e);
    }).not.toThrow();
  });
});
