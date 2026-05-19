import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MeshComponent,
  MeshSystem,
  MeshEvents,
  MeshInputEvents,
} from './Mesh';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('MeshComponent', () => {
  it('applies defaults', () => {
    const c = new MeshComponent();
    expect(c.params.src).toBe('');
    expect(c.params.autoLoad).toBe(true);
    expect(c.params.scale).toBe(1);
    expect(c.params.position).toEqual([0, 0, 0]);
    expect(c.instance).toBeNull();
    expect(c.handle).toBeNull();
  });

  it('accepts position/rotation as arrays or {x,y,z} objects', () => {
    const a = new MeshComponent({
      src: '/x.glb',
      position: [1, 2, 3],
      rotation: { x: 0, y: Math.PI, z: 0 },
    });
    expect(a.params.position).toEqual([1, 2, 3]);
    expect(a.params.rotation).toEqual([0, Math.PI, 0]);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new MeshComponent({
      src: '/x.glb',
      scale: 2,
      autoLoad: false,
      position: [1, 2, 3],
    });
    const copy = new MeshComponent(original.serialize());
    expect(copy.params).toEqual(original.params);
  });
});

describe('MeshSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: MeshSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new MeshSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a core instance when an entity with MeshComponent is added', () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    const comp = entity.get(MeshComponent);
    expect(comp?.instance).not.toBeNull();
    expect(comp?.instance?.getParams().src).toBe('/a.glb');
  });

  it('calls adapter.loadMesh once per entity when autoLoad is true', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    // Allow the promise to resolve.
    await Promise.resolve();
    await Promise.resolve();
    const loadCalls = renderer.calls.filter((c) => c.method === 'loadMesh');
    expect(loadCalls).toHaveLength(1);
    expect(loadCalls[0].args[0]).toBe(entity.id);
  });

  it('does not call loadMesh a second time on subsequent updates', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    const first = renderer.calls.filter((c) => c.method === 'loadMesh').length;
    world.update(1 / 60);
    world.update(1 / 60);
    const later = renderer.calls.filter((c) => c.method === 'loadMesh').length;
    expect(later).toBe(first);
  });

  it('does not call loadMesh when autoLoad is false', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb', autoLoad: false }));
    world.update(1 / 60);
    await Promise.resolve();
    expect(renderer.calls.some((c) => c.method === 'loadMesh')).toBe(false);
  });

  it('emits LOADING then LOADED events with the meshId', async () => {
    const loadingSpy = vi.fn();
    const loadedSpy = vi.fn();
    eventBus.on(MeshEvents.LOADING, loadingSpy);
    eventBus.on(MeshEvents.LOADED, loadedSpy);

    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();

    expect(loadingSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, src: '/a.glb' }),
    );
    expect(loadedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, meshId: entity.id }),
    );
  });

  it('marks the component loaded after the adapter resolves', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    const comp = entity.get(MeshComponent)!;
    expect(comp.instance?.getState().state).toBe('loaded');
    expect(comp.handle).not.toBeNull();
  });

  it('LOAD input event triggers a load when autoLoad is false', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb', autoLoad: false }));
    world.update(1 / 60);
    eventBus.emit(MeshInputEvents.LOAD, { entityId: entity.id });
    await Promise.resolve();
    await Promise.resolve();
    const loadCalls = renderer.calls.filter((c) => c.method === 'loadMesh');
    expect(loadCalls).toHaveLength(1);
  });

  it('emits ERROR and transitions to error state when the adapter rejects', async () => {
    // Override loadMesh for this test to simulate failure.
    const fail = vi.spyOn(renderer, 'loadMesh').mockRejectedValueOnce(
      new Error('not found'),
    );
    const errorSpy = vi.fn();
    eventBus.on(MeshEvents.ERROR, errorSpy);

    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/missing.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();

    expect(fail).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, error: 'not found' }),
    );
    const comp = entity.get(MeshComponent)!;
    expect(comp.instance?.getState().state).toBe('error');
  });

  it('disposes the mesh handle when the entity is removed', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    renderer.calls.length = 0;
    world.removeEntity(entity.id);
    const disposeCalls = renderer.calls.filter((c) => c.method === 'disposeMesh');
    expect(disposeCalls).toHaveLength(1);
  });
});
