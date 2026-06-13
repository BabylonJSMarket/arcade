/**
 * Physics.ts — renderer-agnostic System.
 *
 * Physics state orchestration lives in Physics.core.ts. This System is a thin
 * driver: it watches for entities with MeshPrimitive + PhysicsComponent, asks
 * the adapter to create a rigid body (`world.renderer.physicsCreateBody`),
 * forwards pause/resume events, and steps physics each frame via the adapter
 * (`world.renderer.physicsStep`). Under Babylon the adapter delegates to
 * Havok; under Three (or the mock) the adapter uses the pure-core integrator.
 * Zero @babylonjs / three imports — those live in the adapters.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { PhysicsBodyOpts } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

// ============================================
// Events
// ============================================

export const PhysicsEvents = {
  /** Emitted once the adapter has successfully created a rigid body for the entity. */
  BODY_CREATED: 'physics.body.created',
  /** Emitted when an entity's rigid body has been disposed. */
  BODY_DISPOSED: 'physics.body.disposed',
} as const;

export const PhysicsInputEvents = {
  /** Directly set a body's linear velocity. Payload: { entityId, vx, vy, vz }. */
  SET_VELOCITY: 'physics.setVelocity',
  /** Pause all physics stepping. Payload: {}. */
  PAUSE: 'physics.pause',
  /** Resume physics stepping. Payload: {}. */
  RESUME: 'physics.resume',
  /**
   * Reconfigure the engine's fixed simulation rate. Payload: { hz }. Higher
   * Hz = smaller substep → fewer tunneling artifacts at the cost of CPU.
   * Adapters without a configurable rate (Three/Mock) no-op.
   */
  SET_TIME_STEP: 'physics.setTimeStep',
  /** Set the world gravity vector. Payload: { x, y, z }. */
  SET_GRAVITY: 'physics.setGravity',
  /** Set a body's restitution (bounciness). Payload: { entityId, restitution }. */
  SET_RESTITUTION: 'physics.setRestitution',
  /** Toggle wireframe outlines of every collider. Payload: { visible }. */
  SET_COLLIDERS_VISIBLE: 'physics.setCollidersVisible',
} as const;

export interface PhysicsSetVelocityEvent {
  entityId: string;
  vx: number;
  vy: number;
  vz: number;
}

export interface PhysicsSetTimeStepEvent {
  hz: number;
}

export interface PhysicsSetGravityEvent {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsSetRestitutionEvent {
  entityId: string;
  restitution: number;
}

export interface PhysicsSetCollidersVisibleEvent {
  visible: boolean;
}

// ============================================
// Component
// ============================================

export type PhysicsShapeTypeName = 'sphere' | 'box' | 'capsule';
export type PhysicsMotionTypeName = 'dynamic' | 'static' | 'kinematic';

export interface PhysicsInput {
  shapeType?: PhysicsShapeTypeName;
  motionType?: PhysicsMotionTypeName;
  mass?: number;
  friction?: number;
  restitution?: number;
  lockRotation?: boolean;
  /**
   * When true (default), the System calls `physicsCreateBody` automatically
   * once the sibling MeshPrimitive's handle is ready. Set false to hand-drive
   * body creation (e.g., respawn flows that want to re-pose the mesh first).
   */
  autoCreate?: boolean;
  /**
   * Engine fixed simulation rate in Hertz. Applied once at system init via
   * `physicsSetTimeStep` and updateable live via the SET_TIME_STEP event
   * (e.g. the Physics debugger panel slider). The Hz lives on the component
   * so a scene-author can pin a higher rate per-game (pinball wants ~240).
   * Only one PhysicsComponent's `simulationHz` is consulted — the first one
   * encountered. Default 60.
   */
  simulationHz?: number;
}

export class PhysicsComponent extends Component {
  shapeType: PhysicsShapeTypeName;
  motionType: PhysicsMotionTypeName;
  mass: number;
  friction: number;
  restitution: number;
  lockRotation: boolean;
  autoCreate: boolean;
  simulationHz: number;

  /** Populated by the System once `physicsCreateBody` has run for this entity. */
  isCreated = false;

  constructor(data: PhysicsInput = {}) {
    super();
    this.shapeType = data.shapeType ?? 'sphere';
    // Mirror legacy default: a zero-mass body should be static even if the
    // caller omits `motionType`.
    this.motionType = data.motionType ?? (data.mass === 0 ? 'static' : 'dynamic');
    this.mass = data.mass ?? 1;
    this.friction = data.friction ?? 0.5;
    this.restitution = data.restitution ?? 0.5;
    this.lockRotation = data.lockRotation ?? false;
    this.autoCreate = data.autoCreate ?? true;
    this.simulationHz = data.simulationHz ?? 60;
  }

  toBodyOpts(): PhysicsBodyOpts {
    return {
      shapeType: this.shapeType,
      motionType: this.motionType,
      mass: this.mass,
      friction: this.friction,
      restitution: this.restitution,
      lockRotation: this.lockRotation,
    };
  }

  serialize(): PhysicsInput {
    return {
      shapeType: this.shapeType,
      motionType: this.motionType,
      mass: this.mass,
      friction: this.friction,
      restitution: this.restitution,
      lockRotation: this.lockRotation,
      autoCreate: this.autoCreate,
      simulationHz: this.simulationHz,
    };
  }
}

// ============================================
// System
// ============================================

export class PhysicsSystem extends System {
  /** Entities whose body has been requested — prevents duplicate creates. */
  private created = new Set<string>();
  private isPaused = false;
  /** Initial Hz applied once during init from the first PhysicsComponent. */
  private timeStepApplied = false;
  protected query = { required: [PhysicsComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(PhysicsInputEvents.SET_VELOCITY, (e: PhysicsSetVelocityEvent) => {
      this.handleSetVelocity(e);
    });
    this.listen(PhysicsInputEvents.PAUSE, () => {
      this.isPaused = true;
    });
    this.listen(PhysicsInputEvents.RESUME, () => {
      this.isPaused = false;
    });
    this.listen(PhysicsInputEvents.SET_TIME_STEP, (e: PhysicsSetTimeStepEvent) => {
      this.handleSetTimeStep(e);
    });
    this.listen(PhysicsInputEvents.SET_GRAVITY, (e: PhysicsSetGravityEvent) => {
      this.world?.renderer?.physicsSetGravity(e.x, e.y, e.z);
    });
    this.listen(PhysicsInputEvents.SET_RESTITUTION, (e: PhysicsSetRestitutionEvent) => {
      const comp = this.world?.getEntity(e.entityId)?.get(PhysicsComponent);
      if (comp) comp.restitution = e.restitution; // mirror for serialize
      this.world?.renderer?.physicsSetRestitution(e.entityId, e.restitution);
    });
    this.listen(PhysicsInputEvents.SET_COLLIDERS_VISIBLE, (e: PhysicsSetCollidersVisibleEvent) => {
      this.world?.renderer?.setCollidersVisible(e.visible);
    });

    // Try to attach any entities that already exist when the system initializes.
    for (const entity of this.entities) this.tryCreateBody(entity);
    this.applyInitialTimeStep();
  }

  protected onShutdown(): void {
    const r = this.world?.renderer;
    if (r) {
      for (const id of this.created) r.physicsDestroyBody(id);
    }
    this.created.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.tryCreateBody(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    if (!this.created.has(entity.id)) return;
    const r = this.world?.renderer;
    r?.physicsDestroyBody(entity.id);
    this.created.delete(entity.id);
    const comp = entity.get(PhysicsComponent);
    if (comp) comp.isCreated = false;
    this.eventBus.emit(PhysicsEvents.BODY_DISPOSED, { entityId: entity.id });
  }

  protected onUpdate(dt: number): void {
    // New bodies are deferred until the sibling MeshPrimitive's handle lands;
    // re-check every tick is cheap (entities is a filtered query list).
    for (const entity of this.entities) {
      if (!this.created.has(entity.id)) this.tryCreateBody(entity);
    }
    if (!this.timeStepApplied) this.applyInitialTimeStep();
    if (this.isPaused) return;
    this.world?.renderer?.physicsStep(dt);
  }

  private tryCreateBody(entity: Entity): void {
    if (this.created.has(entity.id)) return;
    const comp = entity.get(PhysicsComponent);
    if (!comp || !comp.autoCreate) return;
    const mesh = entity.get(MeshPrimitiveComponent);
    if (!mesh?.handle) return; // mesh not ready yet

    const r = this.world?.renderer;
    if (!r) return;
    r.physicsCreateBody(entity.id, comp.toBodyOpts());
    comp.isCreated = true;
    this.created.add(entity.id);
    this.eventBus.emit(PhysicsEvents.BODY_CREATED, {
      entityId: entity.id,
      shapeType: comp.shapeType,
      motionType: comp.motionType,
      mass: comp.mass,
    });
  }

  private handleSetVelocity(e: PhysicsSetVelocityEvent): void {
    if (!this.created.has(e.entityId)) return;
    this.world?.renderer?.physicsSetBodyVelocity(e.entityId, e.vx, e.vy, e.vz);
  }

  private handleSetTimeStep(e: PhysicsSetTimeStepEvent): void {
    if (!Number.isFinite(e.hz) || e.hz <= 0) return;
    // Mirror into the first PhysicsComponent so reloads / serialize() pick
    // up the live value, then apply to the engine.
    for (const entity of this.entities) {
      const comp = entity.get(PhysicsComponent);
      if (comp) {
        comp.simulationHz = e.hz;
        break;
      }
    }
    this.world?.renderer?.physicsSetTimeStep(e.hz);
  }

  private applyInitialTimeStep(): void {
    if (this.timeStepApplied) return;
    for (const entity of this.entities) {
      const comp = entity.get(PhysicsComponent);
      if (!comp) continue;
      this.world?.renderer?.physicsSetTimeStep(comp.simulationHz);
      this.timeStepApplied = true;
      return;
    }
  }
}
