import { describe, it, expect, beforeEach } from 'vitest';
import { CameraFollowComponent, CameraFollowSystem } from './CameraFollow';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';
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
    arcComp.initialized = true;
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
    arcComp.initialized = true;
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
    arcComp.initialized = true;
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
});
