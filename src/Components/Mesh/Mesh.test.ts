import { MeshEvents, MeshInputEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MeshComponent, MeshSystem } from './Mesh';
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

  it('falls back to the default for a malformed position object', () => {
    const c = new MeshComponent({
      position: { x: 1, y: 2 } as unknown as { x: number; y: number; z: number },
    });
    expect(c.params.position).toEqual([0, 0, 0]);
  });

  it('falls back to the default for a wrong-length position array', () => {
    const c = new MeshComponent({
      position: [1, 2] as unknown as [number, number, number],
    });
    expect(c.params.position).toEqual([0, 0, 0]);
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

  it('creates core instances for entities that existed before the system mounted', () => {
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r, detectRaces: false });
    const entity = w.createEntity();
    const comp = new MeshComponent({ src: '/pre.glb' });
    entity.add(comp);
    // No system yet — instance not created.
    expect(comp.instance).toBeNull();
    w.addSystem(new MeshSystem(eb));
    w.initialize(); // onInitialize walks pre-existing entities → ensureInstance
    expect(comp.instance).not.toBeNull();
    expect(comp.instance?.getParams().src).toBe('/pre.glb');
  });

  it('leaves the core in "loading" when no renderer is attached (unit-test path)', () => {
    const eb = new EventBus();
    const w = new World({ eventBus: eb }); // no renderer
    w.addSystem(new MeshSystem(eb));
    w.initialize();
    const entity = w.createEntity();
    const comp = new MeshComponent({ src: '/a.glb' });
    entity.add(comp);
    w.update(1 / 60);
    // beginLoad ran + LOADING emitted, but with no renderer the load can't
    // complete, so state stays loading and no loadMesh was recorded.
    expect(comp.instance?.getState().state).toBe('loading');
  });

  it('LOAD event finds the entity via the world even before the query indexes it', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/a.glb', autoLoad: false }));
    // findEntityById falls through to world.getEntity for this id.
    eventBus.emit(MeshInputEvents.LOAD, { entityId: entity.id, src: '/override.glb' });
    await Promise.resolve();
    await Promise.resolve();
    const loadCalls = renderer.calls.filter((c) => c.method === 'loadMesh');
    expect(loadCalls).toHaveLength(1);
    // The src override flowed through to the resolved url.
    expect(String(loadCalls[0].args[1] && (loadCalls[0].args[1] as { url: string }).url)).toContain(
      '/override.glb',
    );
  });

  it('LOAD event for an unknown entity id is a no-op', () => {
    expect(() =>
      eventBus.emit(MeshInputEvents.LOAD, { entityId: 'ghost' }),
    ).not.toThrow();
    expect(renderer.calls.some((c) => c.method === 'loadMesh')).toBe(false);
  });

  it('stringifies a non-Error rejection into the ERROR event message', async () => {
    vi.spyOn(renderer, 'loadMesh').mockRejectedValueOnce('plain string failure');
    const errorSpy = vi.fn();
    eventBus.on(MeshEvents.ERROR, errorSpy);
    const entity = world.createEntity();
    entity.add(new MeshComponent({ src: '/x.glb' }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, error: 'plain string failure' }),
    );
  });

  it('does not dispatch a load while the component has no src yet', async () => {
    const entity = world.createEntity();
    entity.add(new MeshComponent()); // autoLoad true, but src === ''
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    // dispatchLoad bails at the empty-src guard → no loadMesh, still unloaded.
    expect(renderer.calls.some((c) => c.method === 'loadMesh')).toBe(false);
    expect(entity.get(MeshComponent)!.instance?.getState().state).toBe('idle');

    // Once a src arrives via LOAD, the load goes through.
    eventBus.emit(MeshInputEvents.LOAD, { entityId: entity.id, src: '/late.glb' });
    await Promise.resolve();
    await Promise.resolve();
    expect(renderer.calls.some((c) => c.method === 'loadMesh')).toBe(true);
  });

  it('follow with no sibling MeshPrimitive is a no-op (does not throw)', async () => {
    const entity = world.createEntity();
    // follow:true but NOT instanced and NO MeshPrimitive sibling.
    entity.add(new MeshComponent({ src: '/a.glb', follow: true }));
    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    renderer.calls.length = 0;
    expect(() => world.update(1 / 60)).not.toThrow();
    // updateFollow returns early at the missing-sibling guard → no follow writes.
    expect(renderer.calls.some((c) => c.method === 'setMeshRotation')).toBe(false);
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

  it('re-acquiring a non-following instanced entity reveals the clone without touching follow state', async () => {
    const entity = world.createEntity('Enemy');
    // instanced but follow:false → no followState is ever created.
    entity.add(new MeshComponent({ src: 'enemy.glb', instanced: true }));
    entity.add(new MeshPrimitiveComponent({ primitive: 'sphere', position: [0, 1, 0] }));

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // instantiate

    entity.active = false;
    renderer.calls.length = 0;
    // Re-acquire: fs is undefined so the prevX/prevZ reseed is skipped (295 false).
    entity.active = true;
    // Reveal is queued and flushed from our own update — see the park test.
    world.update(1 / 60);
    expect(callsOf('setModelVisible').some((c) => c.args[1] === true)).toBe(true);
    expect(callsOf('instantiateModel')).toHaveLength(0);
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
    // Visibility transitions are queued and flushed from our own update: a
    // pooled entity parked and reacquired in ONE frame would otherwise get a
    // hide and a show from two different systems' windows — a last-wins race.
    expect(callsOf('setModelVisible').some((c) => c.args[1] === false)).toBe(false);
    world.update(1 / 60);
    expect(callsOf('setModelVisible').some((c) => c.args[1] === false)).toBe(true);

    // True destroy: removeEntity on a non-pooled entity runs onEntityRemoved
    // with active still true → dispose the clone.
    world.removeEntity(destroyed.id);
    expect(callsOf('disposeModel')).toHaveLength(1);
    expect(callsOf('disposeModel')[0].args[0]).toBe(destroyed.id);
  });

  it('faceMode "proxy" copies the proxy yaw (+yawOffset) instead of inferring from movement', async () => {
    const entity = world.createEntity('Player');
    entity.add(
      new MeshComponent({
        src: 'player.glb',
        instanced: true,
        follow: true,
        faceMode: 'proxy',
        yawOffset: Math.PI / 4,
        position: [0, 0.5, 0],
      }),
    );
    const mp = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 1, 0] });
    entity.add(mp);

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // instantiate

    // Aim the proxy without moving it — proxy faceMode reads rotation[1] directly.
    mp.rotation[1] = Math.PI / 2;
    world.update(1 / 60);

    const rots = callsOf('setMeshRotation');
    const expectedYaw = Math.PI / 2 + Math.PI / 4;
    expect(rots.some((c) => c.args[1] === 0 && c.args[2] === expectedYaw && c.args[3] === 0)).toBe(
      true,
    );
  });

  it('face lock freezes the follow yaw until released', async () => {
    const entity = world.createEntity('Player');
    entity.add(
      new MeshComponent({ src: 'player.glb', instanced: true, follow: true, position: [0, 0.5, 0] }),
    );
    const mp = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 1, 0] });
    entity.add(mp);

    world.update(1 / 60);
    await Promise.resolve();
    await Promise.resolve();
    world.update(1 / 60); // instantiate

    // Travel +Z → the follow yaw settles toward that heading.
    mp.position[2] = 1;
    world.update(1 / 60);
    const beforeLock = callsOf('setMeshRotation').at(-1)!.args[2];

    // Lock facing, then travel +X. The yaw must hold, not turn toward +X.
    world.getEventBus().emitImmediate(MeshInputEvents.FACE_LOCK, { entityId: 'Player', locked: true });
    mp.position[0] = 5;
    world.update(1 / 60);
    expect(callsOf('setMeshRotation').at(-1)!.args[2]).toBe(beforeLock);

    // Release, travel +X again → the yaw resumes turning.
    world.getEventBus().emitImmediate(MeshInputEvents.FACE_LOCK, { entityId: 'Player', locked: false });
    mp.position[0] = 10;
    world.update(1 / 60);
    expect(callsOf('setMeshRotation').at(-1)!.args[2]).not.toBe(beforeLock);
  });

  it('instanced load leaves the core in "loading" when no renderer is attached', () => {
    const eb = new EventBus();
    const w = new World({ eventBus: eb }); // no renderer
    w.addSystem(new MeshSystem(eb));
    w.initialize();
    const entity = w.createEntity('Enemy');
    const comp = new MeshComponent({ src: 'enemy.glb', instanced: true });
    entity.add(comp);
    w.update(1 / 60);
    // beginLoad ran (LOADING fired) but dispatchInstancedLoad returns at the
    // no-renderer guard before requesting any template.
    expect(comp.instance?.getState().state).toBe('loading');
  });

  it('retries the template load on a later frame after the first attempt rejects', async () => {
    const fail = vi
      .spyOn(renderer, 'loadModelTemplate')
      .mockRejectedValueOnce(new Error('404'));

    const entity = world.createEntity('Enemy');
    entity.add(new MeshComponent({ src: 'enemy.glb', instanced: true }));

    // First tick requests the template; the promise rejects → templateRequested
    // is rolled back so a retry can happen.
    world.update(1 / 60);
    // Flush the rejected microtask so the .catch rolls back templateRequested.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fail).toHaveBeenCalledTimes(1);
    expect(callsOf('instantiateModel')).toHaveLength(0);

    // Next frame: the template load is attempted again (the spy counts every
    // invocation, including the once-rejected one and the retry).
    world.update(1 / 60);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fail.mock.calls.length).toBeGreaterThanOrEqual(2);

    // And now it can instantiate.
    world.update(1 / 60);
    expect(callsOf('instantiateModel')).toHaveLength(1);
    expect(entity.get(MeshComponent)!.instance?.getState().state).toBe('loaded');
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

    // Re-acquire: reactivating re-adds the entity to the system. The reveal is
    // queued with the rest of the visibility transitions and flushed from our
    // own update — park-then-reacquire inside one frame then resolves to a
    // single write with the correct net value.
    entity.active = true;
    expect(callsOf('setModelVisible').some((c) => c.args[1] === true)).toBe(false);
    world.update(1 / 60);
    expect(callsOf('setModelVisible').some((c) => c.args[1] === true)).toBe(true);
    // No new clone was created on re-acquire.
    expect(callsOf('instantiateModel')).toHaveLength(0);
  });
});
