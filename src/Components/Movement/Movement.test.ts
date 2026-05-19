import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MovementComponent,
  MovementSystem,
  MovementEvents,
  MovementInputEvents,
} from './Movement';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('MovementComponent', () => {
  it('applies defaults', () => {
    const c = new MovementComponent();
    expect(c.params.speed).toBe(5);
    expect(c.params.jumpForce).toBe(8);
    expect(c.params.gravity).toBe(20);
    expect(c.params.feetOffset).toBe(1);
    expect(c.params.faceMotion).toBe(true);
    expect(c.groundY).toBe(0);
    expect(c.instance).toBeNull();
  });

  it('merges params on top of defaults', () => {
    const c = new MovementComponent({ speed: 12, jumpForce: 15, groundY: null });
    expect(c.params.speed).toBe(12);
    expect(c.params.jumpForce).toBe(15);
    expect(c.params.gravity).toBe(20); // untouched
    expect(c.groundY).toBeNull();
  });

  it('serialize round-trips', () => {
    const a = new MovementComponent({ speed: 8, gravity: 25, position: [3, 2, 1] });
    const b = new MovementComponent(a.serialize());
    expect(b.params).toEqual(a.params);
    expect(b.groundY).toBe(a.groundY);
    expect(b.initialPosition).toEqual([3, 2, 1]);
  });
});

describe('MovementSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: MovementSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new MovementSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  function makePlayer(pos: [number, number, number] = [0, 1, 0]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    renderer.meshWorldPositions.set(mesh.handle, [...pos]);
    entity.add(mesh);
    entity.add(new MovementComponent({ speed: 10, jumpForce: 8, feetOffset: 1 }));
    return entity;
  }

  it('creates a core instance on entity add', () => {
    const entity = makePlayer();
    const comp = entity.get(MovementComponent);
    expect(comp?.instance).not.toBeNull();
  });

  it('seeds core position from renderer.getMeshWorldPosition', () => {
    const entity = makePlayer([3, 1, -2]);
    const comp = entity.get(MovementComponent)!;
    const s = comp.instance!.getState();
    expect(s.posX).toBe(3);
    expect(s.posY).toBe(1);
    expect(s.posZ).toBe(-2);
  });

  it('SET_MOVEMENT_VECTOR updates input intent and moves the mesh next frame', () => {
    const entity = makePlayer();
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, {
      entityId: entity.id,
      x: 1,
      z: 0,
    });
    renderer.calls.length = 0;
    world.update(0.1);
    const moves = renderer.calls.filter((c) => c.method === 'setMeshPosition');
    expect(moves.length).toBeGreaterThan(0);
    // speed(10) * dt(0.1) = 1 world unit in +X
    expect(moves[0].args[1]).toBeCloseTo(1, 5);
  });

  it('JUMP_REQUESTED emits JUMP_STARTED and GROUNDED_CHANGED', () => {
    const entity = makePlayer();
    const jumpSpy = vi.fn();
    const groundedSpy = vi.fn();
    eventBus.on(MovementEvents.JUMP_STARTED, jumpSpy);
    eventBus.on(MovementEvents.GROUNDED_CHANGED, groundedSpy);

    eventBus.emit(MovementInputEvents.JUMP_REQUESTED, { entityId: entity.id });
    world.update(0.016);

    expect(jumpSpy).toHaveBeenCalledWith(expect.objectContaining({ entityId: entity.id }));
    expect(groundedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, isGrounded: false }),
    );
  });

  it('STARTED_MOVING / STOPPED_MOVING fire on move-intent edges', () => {
    const entity = makePlayer();
    const started = vi.fn();
    const stopped = vi.fn();
    eventBus.on(MovementEvents.STARTED_MOVING, started);
    eventBus.on(MovementEvents.STOPPED_MOVING, stopped);

    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, {
      entityId: entity.id, x: 1, z: 0,
    });
    world.update(0.016);
    expect(started).toHaveBeenCalledTimes(1);

    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, {
      entityId: entity.id, x: 0, z: 0,
    });
    world.update(0.016);
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('faceMotion rotates the mesh toward movement direction', () => {
    const entity = makePlayer();
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, {
      entityId: entity.id, x: 1, z: 0,
    });
    renderer.calls.length = 0;
    world.update(1); // long step — rotationSpeed of 2*PI is plenty
    const rot = renderer.calls.find((c) => c.method === 'setMeshRotation');
    expect(rot).toBeDefined();
    // atan2(1, 0) = PI/2
    expect(rot!.args[2]).toBeCloseTo(Math.PI / 2, 3);
  });

  it('skips cleanly when no entities are present', () => {
    expect(() => world.update(1 / 60)).not.toThrow();
  });
});
