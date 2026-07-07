import { MovementEvents, MovementInputEvents, PhysicsInputEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementComponent, MovementSystem } from './Movement';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { PhysicsComponent, type PhysicsSetVelocityEvent } from '../Physics/Physics';
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

  it('seeds the core from initialPosition when the entity has no mesh', () => {
    const entity = world.createEntity();
    entity.add(new MovementComponent({ position: [4, 2, 6], feetOffset: 1 }));
    const s = entity.get(MovementComponent)!.instance!.getState();
    // No MeshPrimitive/handle, so the System falls back to the component's
    // initialPosition rather than the renderer world position.
    expect([s.posX, s.posY, s.posZ]).toEqual([4, 2, 6]);
  });

  it('ignores a SET_MOVEMENT_VECTOR for an unknown entity id', () => {
    makePlayer();
    expect(() =>
      eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, {
        entityId: 'no-such-entity',
        x: 1,
        z: 1,
      }),
    ).not.toThrow();
  });

  it('ignores a JUMP_REQUESTED for an unknown entity id', () => {
    const entity = makePlayer();
    const jumpSpy = vi.fn();
    eventBus.on(MovementEvents.JUMP_STARTED, jumpSpy);
    eventBus.emit(MovementInputEvents.JUMP_REQUESTED, { entityId: 'ghost' });
    world.update(0.016);
    // The real player never requested a jump, and the ghost id matched nothing.
    expect(jumpSpy).not.toHaveBeenCalled();
    expect(entity.get(MovementComponent)!.jumpPressed).toBe(false);
  });

  it('seeds instances already present at world.initialize() time', () => {
    // Build the world and entity BEFORE initialize so onInitialize's seeding
    // loop has a matching entity to walk.
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    const sys = new MovementSystem(eb);
    w.addSystem(sys);
    const entity = w.createEntity();
    entity.add(new MovementComponent({ position: [7, 1, 0], feetOffset: 1 }));
    w.initialize();
    expect(entity.get(MovementComponent)?.instance).not.toBeNull();
  });

  it('does not skip faceMotion rotation off — leaves rotation alone when faceMotion is false', () => {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 1, 0] });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    renderer.meshWorldPositions.set(mesh.handle, [0, 1, 0]);
    entity.add(mesh);
    entity.add(new MovementComponent({ speed: 10, faceMotion: false }));
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, { entityId: entity.id, x: 1, z: 0 });
    renderer.calls.length = 0;
    world.update(0.1);
    const rot = renderer.calls.find((c) => c.method === 'setMeshRotation');
    expect(rot).toBeUndefined();
  });

  it('updates mesh position data without renderer calls when the mesh has no handle', () => {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 1, 0] });
    // No handle set — the renderer write path is skipped, but mesh.position
    // data is still authored from the core tick.
    entity.add(mesh);
    entity.add(new MovementComponent({ speed: 10, feetOffset: 1 }));
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, { entityId: entity.id, x: 1, z: 0 });
    renderer.calls.length = 0;
    world.update(0.1);
    expect(renderer.calls.filter((c) => c.method === 'setMeshPosition')).toHaveLength(0);
    expect(mesh.position[0]).toBeCloseTo(1, 5);
  });

  // ── Physics-velocity mode ─────────────────────────────────────────────────
  // When the entity ALSO carries a non-static Physics body, the rigid body owns
  // the transform: Movement translates the core's horizontal velocity into a
  // `physics.setVelocity` (so the capsule collides) instead of writing the mesh.
  // These paths used to be covered only transitively by the soccer/wingman
  // components' tests; cover them directly here.

  function makePhysicsAgent(
    pos: [number, number, number] = [0, 1, 0],
    opts: { ai?: boolean } = {},
  ) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    renderer.meshWorldPositions.set(mesh.handle, [...pos]);
    entity.add(mesh);
    entity.add(new MovementComponent({ speed: 10, jumpForce: 8, feetOffset: 1 }));
    entity.add(new PhysicsComponent({ mass: 1 })); // mass>0 → 'dynamic' → physics mode
    // A live body so `physicsGetBodyState` returns kinematics (not null).
    renderer.physicsBodies.set(entity.id, {
      position: [...pos],
      rotation: [0, 0, 0],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
    });
    if (opts.ai) entity.addTag('ai');
    return entity;
  }

  it('physics-velocity mode emits physics.setVelocity instead of moving the mesh', () => {
    const entity = makePhysicsAgent();
    const velSpy = vi.fn();
    eventBus.on(PhysicsInputEvents.SET_VELOCITY, velSpy);

    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, { entityId: entity.id, x: 1, z: 0 });
    renderer.calls.length = 0;
    world.update(0.1);

    // The body owns the transform — Movement must NOT write the mesh here.
    expect(renderer.calls.filter((c) => c.method === 'setMeshPosition')).toHaveLength(0);
    // Horizontal intent becomes a body velocity in +X (speed 10).
    expect(velSpy).toHaveBeenCalledTimes(1);
    const e = velSpy.mock.calls[0][0] as PhysicsSetVelocityEvent;
    expect(e.entityId).toBe(entity.id);
    expect(e.vx).toBeCloseTo(10, 5);
    expect(e.vz).toBeCloseTo(0, 5);
  });

  it('physics-velocity mode injects jumpForce as vertical velocity on the jump frame', () => {
    const entity = makePhysicsAgent();
    const velSpy = vi.fn();
    eventBus.on(PhysicsInputEvents.SET_VELOCITY, velSpy);

    eventBus.emit(MovementInputEvents.JUMP_REQUESTED, { entityId: entity.id });
    world.update(0.016);

    const e = velSpy.mock.calls.at(-1)![0] as PhysicsSetVelocityEvent;
    expect(e.vy).toBeCloseTo(8, 5); // params.jumpForce, injected only this frame
  });

  it('folds an AI separation push (away from nearby bodies, capped) into the velocity', () => {
    // Chaser at the origin; a crowd packed to its +X inside the 2.2u radius.
    const ai = makePhysicsAgent([0, 1, 0], { ai: true });
    // Neighbours across BOTH scanned tags ('ai' + 'player'); the cluster is tight
    // enough that the repulsion saturates its cap.
    for (const [x, tag] of [
      [0.3, 'player'],
      [0.5, 'ai'],
      [0.7, 'player'],
    ] as const) {
      const n = world.createEntity();
      const m = new MeshPrimitiveComponent({ primitive: 'capsule', position: [x, 1, 0] });
      m.handle = renderer.createMesh(n.id, m.toPrimitiveSpec());
      renderer.meshWorldPositions.set(m.handle, [x, 1, 0]);
      n.add(m);
      n.addTag(tag);
    }
    // A tagged body with no mesh handle — exercises the `!om?.handle` skip.
    world.createEntity().addTag('player');

    const velSpy = vi.fn();
    eventBus.on(PhysicsInputEvents.SET_VELOCITY, velSpy);
    // Drive straight into the crowd (+X); separation must fight it back.
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, { entityId: ai.id, x: 1, z: 0 });
    world.update(0.016);

    const e = velSpy.mock.calls.at(-1)![0] as PhysicsSetVelocityEvent;
    // Neighbours all sit at +X → repulsion is -X, pulling vx below the raw
    // 10 u/s intent, and the cap keeps it finite (not flung).
    expect(e.vx).toBeLessThan(10);
    expect(Number.isFinite(e.vx)).toBe(true);
  });

  it('a non-ai physics body gets no separation push (clean velocity passthrough)', () => {
    // A player-tagged body right next to the agent must NOT perturb a non-ai
    // mover — separationVelocity early-returns unless the mover is 'ai'.
    const agent = makePhysicsAgent([0, 1, 0]);
    const neighbour = world.createEntity();
    const m = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0.4, 1, 0] });
    m.handle = renderer.createMesh(neighbour.id, m.toPrimitiveSpec());
    renderer.meshWorldPositions.set(m.handle, [0.4, 1, 0]);
    neighbour.add(m);
    neighbour.addTag('player');

    const velSpy = vi.fn();
    eventBus.on(PhysicsInputEvents.SET_VELOCITY, velSpy);
    eventBus.emit(MovementInputEvents.SET_MOVEMENT_VECTOR, { entityId: agent.id, x: 1, z: 0 });
    world.update(0.1);

    const e = velSpy.mock.calls.at(-1)![0] as PhysicsSetVelocityEvent;
    expect(e.vx).toBeCloseTo(10, 5); // untouched by the adjacent body
  });
});
