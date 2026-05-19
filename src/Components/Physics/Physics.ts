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
} as const;

export interface PhysicsSetVelocityEvent {
  entityId: string;
  vx: number;
  vy: number;
  vz: number;
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
}

export class PhysicsComponent extends Component {
  shapeType: PhysicsShapeTypeName;
  motionType: PhysicsMotionTypeName;
  mass: number;
  friction: number;
  restitution: number;
  lockRotation: boolean;
  autoCreate: boolean;

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
    };
  }
}

// ============================================
// System
// ============================================

export class PhysicsSystem extends System {
  private unsubscribes: Array<() => void> = [];
  /** Entities whose body has been requested — prevents duplicate creates. */
  private created = new Set<string>();
  private isPaused = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [PhysicsComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on(PhysicsInputEvents.SET_VELOCITY, (e: PhysicsSetVelocityEvent) => {
        this.handleSetVelocity(e);
      }),
    );
    this.unsubscribes.push(
      this.eventBus.on(PhysicsInputEvents.PAUSE, () => {
        this.isPaused = true;
      }),
    );
    this.unsubscribes.push(
      this.eventBus.on(PhysicsInputEvents.RESUME, () => {
        this.isPaused = false;
      }),
    );

    // Try to attach any entities that already exist when the system initializes.
    for (const entity of this.entities) this.tryCreateBody(entity);
  }

  protected onShutdown(): void {
    const r = this.world?.renderer;
    if (r) {
      for (const id of this.created) r.physicsDestroyBody(id);
    }
    this.created.clear();
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
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
}
