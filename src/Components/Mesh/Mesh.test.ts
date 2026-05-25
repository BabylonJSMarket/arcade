import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MeshComponent,
  MeshSystem,
  MeshEvents,
  MeshInputEvents,
} from './Mesh';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';

describe('MeshComponent', () => {
  it('applies defaults', () => {
    const c = new MeshComponent();
    expect(c.params.src).toBe('');
    expect(c.params.autoLoad).toBe(true);
    expect(c.params.scale).toBe(1);
    expect(c.params.position).toEqual([0, 0, 0]);
    expect(c.params.instanced).toBe(false);
    expect(c.params.follow).toBe(false);
    expect(c.params.yawOffset).toBe(0);
    expect(c.instance).toBeNull();
  });

  it('round-trips the instanced/follow/yawOffset fields through serialize', () => {
    const original = new MeshComponent({
      src: '/enemy.glb',
      instanced: true,
      follow: true,
      yawOffset: Math.PI / 2,
    });
    const copy = new MeshComponent(original.serialize());
    expect(copy.params.instanced).toBe(true);
    expect(copy.params.follow).toBe(true);
    expect(copy.params.yawOffset).toBe(Math.PI / 2);
    expect(copy.params).toEqual(original.params);
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
    const loadedSpy = vi.fn();
    eventBus.on(MeshEvents.LOADED, loadedSpy);
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    const comp = entity.get(MeshComponent)!;
    expect(comp.instance?.getState().state).toBe('loaded');
    // The renderer handle now lives in System runtime state; LOADED firing
    // proves the adapter resolved and the handle was recorded.
    expect(loadedSpy).toHaveBeenCalled();
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

describe('MeshSystem — instanced clone + follow', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: MeshSystem;

  const callsOf = (method: string) => renderer.calls.filter((c) => c.method === method);

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    renderer.modelTemplateAnimationNames = ['Walking', 'Idle'];
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new MeshSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('loads the template once, instantiates a visible clone, and emits LOADED with the entityId + animationNames', async () => {
    const loadedSpy = vi.fn();
    eventBus.on(MeshEvents.LOADED, loadedSpy);

    const entity = world.createEntity('Enemy');
    entity.add(new MeshComponent({ src: 'enemy.glb', instanced: true, scale: 0.5 }));

    // First tick kicks off loadModelTemplate; template not ready → no clone yet.
    world.update(1 / 60);
    expect(callsOf('loadModelTemplate')).toHaveLength(1);
    expect(callsOf('instantiateModel')).toHaveLength(0);
    // No loadMesh in the instanced path.
    expect(callsOf('loadMesh')).toHaveLength(0);

    // Flush the template-load microtask so templateReady gets the url.
    await Promise.resolve();
    await Promise.resolve();

    // Second tick now instantiates the clone and reveals it.
    world.update(1 / 60);
    expect(callsOf('instantiateModel')).toHaveLength(1);
    expect(callsOf('instantiateModel')[0].args[0]).toBe(entity.id);
    expect(callsOf('setModelVisible').some((c) => c.args[1] === true)).toBe(true);

    // The Animation/SkeletonAnimator pipeline depends on LOADED carrying entityId.
    expect(loadedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: entity.id,
        meshId: entity.id,
        animationNames: ['Walking', 'Idle'],
      }),
    );
  });

  it('only calls loadModelTemplate once for a pool sharing the same url, instantiating N clones', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 24; i++) {
      const e = world.createEntity(`Enemy${i}`);
      e.add(new MeshComponent({ src: 'enemy.glb', instanced: true }));
      ids.push(e.id);
    }

    world.update(1 / 60);
    expect(callsOf('loadModelTemplate')).toHaveLength(1);
    expect(callsOf('instantiateModel')).toHaveLength(0);

    await Promise.resolve();
    await Promise.resolve();

    world.update(1 / 60);
    // One template, one clone per entity.
    expect(callsOf('loadModelTemplate')).toHaveLength(1);
    expect(callsOf('instantiateModel')).toHaveLength(24);
  });

  it('follows the sibling MeshPrimitive: moving the proxy drives setMeshPosition/setMeshRotation on the clone', async () => {
    const entity = world.createEntity('Enemy');
    entity.add(new MeshComponent({ src: 'enemy.glb', instanced: true, follow: true, position: [0, 0.5, 0] }));
    const mp = new MeshPrimitiveComponent({ primitive: 'sphere', position: [0, 1, 0] });
    entity.add(mp);

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // instantiate the clone

    const posBefore = callsOf('setMeshPosition').length;
    const rotBefore = callsOf('setMeshRotation').length;

    // Move the proxy and tick again — the clone tracks XZ; Y stays the feet offset.
    mp.position[0] = 5;
    mp.position[2] = 3;
    world.update(1 / 60);

    const moves = callsOf('setMeshPosition');
    const rots = callsOf('setMeshRotation');
    expect(moves.length).toBeGreaterThan(posBefore);
    expect(rots.length).toBeGreaterThan(rotBefore);
    // XZ from the proxy, Y from the mesh's own position[1] (0.5).
    const placed = moves.some((c) => c.args[1] === 5 && c.args[2] === 0.5 && c.args[3] === 3);
    expect(placed).toBe(true);
    // Yaw from atan2(dx, dz) = atan2(5, 3) about the Y axis only.
    const expectedYaw = Math.atan2(5, 3);
    const yawed = rots.some(
      (c) => c.args[1] === 0 && c.args[2] === expectedYaw && c.args[3] === 0,
    );
    expect(yawed).toBe(true);
  });

  it('parked (active=false) entity hides the clone but keeps it; true destroy disposes it', async () => {
    const parked = world.createEntity('ParkedEnemy');
    parked.add(new MeshComponent({ src: 'enemy.glb', instanced: true }));
    const destroyed = world.createEntity('DestroyedEnemy');
    destroyed.add(new MeshComponent({ src: 'enemy.glb', instanced: true }));

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // both clones instantiated

    expect(callsOf('instantiateModel')).toHaveLength(2);
    renderer.calls.length = 0;

    // Park: deactivating the entity removes it from the system with active=false
    // (the pooling path). The clone is hidden and kept for reuse.
    parked.active = false;
    expect(callsOf('disposeModel')).toHaveLength(0);
    expect(callsOf('setModelVisible').some((c) => c.args[1] === false)).toBe(true);

    // True destroy: removeEntity on a non-pooled entity runs onEntityRemoved
    // with active still true → dispose the clone.
    world.removeEntity(destroyed.id);
    expect(callsOf('disposeModel')).toHaveLength(1);
    expect(callsOf('disposeModel')[0].args[0]).toBe(destroyed.id);
  });

  it('re-acquiring a parked instanced entity reveals the kept clone without re-instantiating', async () => {
    const entity = world.createEntity('Enemy');
    entity.add(new MeshComponent({ src: 'enemy.glb', instanced: true, follow: true }));
    entity.add(new MeshPrimitiveComponent({ primitive: 'sphere', position: [0, 1, 0] }));

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // instantiate

    // Park it (keeps the clone, hidden).
    entity.active = false;
    renderer.calls.length = 0;

    // Re-acquire: reactivating re-adds the entity to the system.
    entity.active = true;
    expect(callsOf('setModelVisible').some((c) => c.args[1] === true)).toBe(true);
    // No new clone was created on re-acquire.
    expect(callsOf('instantiateModel')).toHaveLength(0);
  });
});
