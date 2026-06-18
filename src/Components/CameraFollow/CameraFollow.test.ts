import { describe, it, expect, beforeEach } from 'vitest';
import { CameraFollowComponent, CameraFollowSystem } from './CameraFollow';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';
import { getArcCameraRuntime } from '../ArcCamera/ArcCamera.core';
import { MeshPrimitiveSystem, MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';

describe('CameraFollowComponent', () => {
  it('applies defaults when no params are supplied', () => {
    const comp = new CameraFollowComponent();
    expect(comp.target).toBe('');
    expect(comp.params.smoothing).toBe(6);
    expect(comp.params.offsetY).toBe(1.2);
    expect(comp.instance).toBeNull();
  });

  it('merges overrides on top of defaults and keeps target separate', () => {
    const comp = new CameraFollowComponent({ target: 'Player', smoothing: 12, offsetY: 2 });
    expect(comp.target).toBe('Player');
    expect(comp.params.smoothing).toBe(12);
    expect(comp.params.offsetY).toBe(2);
  });

  it('serialize round-trips', () => {
    const orig = new CameraFollowComponent({ target: 'Hero', smoothing: 8, offsetZ: -1 });
    const copy = new CameraFollowComponent(orig.serialize());
    expect(copy.target).toBe('Hero');
    expect(copy.params).toEqual(orig.params);
  });
});

describe('CameraFollowSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: CameraFollowSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new CameraFollowSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a core instance on entity add', () => {
    const entity = world.createEntity();
    const comp = new CameraFollowComponent({ target: 'Player', smoothing: 4 });
    entity.add(comp);
    expect(comp.instance).not.toBeNull();
    expect(comp.instance!.getParams().smoothing).toBe(4);
  });

  it('is non-pauseable', () => {
    expect((system as unknown as { _pauseable: boolean })._pauseable).toBe(false);
  });

  it('does nothing without a target mesh handle registered', () => {
    const arcEntity = world.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = renderer.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    const followEntity = world.createEntity('Follow');
    followEntity.add(new CameraFollowComponent({ target: 'Ghost' }));

    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'setCameraTarget')).toBe(false);
  });

  it('calls setCameraTarget once the target mesh is registered', () => {
    // Mimic a camera and an ArcCamera handle
    const arcEntity = world.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = renderer.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    // Fake a Player mesh and emit the creation event the system listens for.
    const fakeHandle = renderer.createMesh('Player', { kind: 'capsule' });
    renderer.meshWorldPositions.set(fakeHandle as MeshHandle, [3, 1, 0]);

    const followEntity = world.createEntity('Follow');
    followEntity.add(
      new CameraFollowComponent({ target: 'Player', smoothing: 1000, offsetX: 0, offsetY: 0, offsetZ: 0 }),
    );

    eventBus.emit('meshprimitive.created', { entityId: 'Player', handle: fakeHandle });

    renderer.calls.length = 0;
    world.update(1 / 60);

    const setCalls = renderer.calls.filter((c) => c.method === 'setCameraTarget');
    expect(setCalls.length).toBe(1);
    // First frame snaps the core to the target position; read the target we set.
    const target = renderer.cameraTargets.get(arcComp.handle!)!;
    expect(target[0]).toBeCloseTo(3, 3);
    expect(target[1]).toBeCloseTo(1, 3);
    expect(target[2]).toBeCloseTo(0, 3);
  });

  it('applies the configured offset on top of the target position', () => {
    const arcEntity = world.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = renderer.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    const fakeHandle = renderer.createMesh('Player', { kind: 'capsule' });
    renderer.meshWorldPositions.set(fakeHandle as MeshHandle, [0, 0, 0]);

    const followEntity = world.createEntity('Follow');
    followEntity.add(
      new CameraFollowComponent({ target: 'Player', smoothing: 1000, offsetY: 5 }),
    );

    eventBus.emit('meshprimitive.created', { entityId: 'Player', handle: fakeHandle });
    world.update(1 / 60);

    const target = renderer.cameraTargets.get(arcComp.handle!)!;
    expect(target[1]).toBeCloseTo(5, 2);
  });

  it('does nothing while no ArcCamera handle exists in the world', () => {
    // No ArcCamera at all → findArcCameraHandle returns undefined.
    const fakeHandle = renderer.createMesh('Player', { kind: 'capsule' });
    renderer.meshWorldPositions.set(fakeHandle as MeshHandle, [1, 1, 1]);
    const followEntity = world.createEntity('Follow');
    followEntity.add(new CameraFollowComponent({ target: 'Player' }));
    eventBus.emit('meshprimitive.created', { entityId: 'Player', handle: fakeHandle });

    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'setCameraTarget')).toBe(false);
  });

  it('skips entities whose component carries no follow target', () => {
    const arcEntity = world.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = renderer.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    const followEntity = world.createEntity('Follow');
    followEntity.add(new CameraFollowComponent()); // empty target ''

    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'setCameraTarget')).toBe(false);
  });

  it('picks up a mesh handle already created before the system initializes', () => {
    // Build a fresh world where the target mesh exists BEFORE CameraFollowSystem
    // is added — exercising the existing-entity scan in onInitialize.
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r });
    w.addSystem(new MeshPrimitiveSystem(bus));

    const arcEntity = w.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = r.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    const player = w.createEntity('Player');
    player.add(new MeshPrimitiveComponent());
    const mp = player.get(MeshPrimitiveComponent)!;
    r.meshWorldPositions.set(mp.handle as MeshHandle, [4, 0, 2]);

    const follow = w.createEntity('Follow');
    follow.add(new CameraFollowComponent({ target: 'Player', smoothing: 1000, offsetX: 0, offsetY: 0, offsetZ: 0 }));

    // System added AFTER the mesh handle already exists.
    w.addSystem(new CameraFollowSystem(bus));
    w.initialize();

    r.calls.length = 0;
    w.update(1 / 60);
    const setCalls = r.calls.filter((c) => c.method === 'setCameraTarget');
    expect(setCalls.length).toBe(1);
    const tgt = r.cameraTargets.get(arcComp.handle!)!;
    expect(tgt[0]).toBeCloseTo(4, 3);
    expect(tgt[2]).toBeCloseTo(2, 3);
  });

  it('no-ops on a renderer-less world', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus });
    w.addSystem(new CameraFollowSystem(bus));
    w.initialize();
    const e = w.createEntity('Follow');
    e.add(new CameraFollowComponent({ target: 'Player' }));
    expect(() => w.update(1 / 60)).not.toThrow();
  });

  it('clears its primed flag when an entity is removed', () => {
    const arcEntity = world.createEntity('Camera');
    const arcComp = new ArcCameraComponent();
    arcComp.handle = renderer.createArcCamera(arcEntity.id, arcComp.toSpec());
    getArcCameraRuntime(arcComp).initialized = true;
    arcEntity.add(arcComp);

    const fakeHandle = renderer.createMesh('Player', { kind: 'capsule' });
    renderer.meshWorldPositions.set(fakeHandle as MeshHandle, [0, 0, 0]);
    const followEntity = world.createEntity('Follow');
    followEntity.add(new CameraFollowComponent({ target: 'Player' }));
    eventBus.emit('meshprimitive.created', { entityId: 'Player', handle: fakeHandle });

    world.update(1 / 60);
    // Removing the follow entity must not throw and should clear primed state.
    expect(() => world.removeEntity(followEntity)).not.toThrow();
  });
});
