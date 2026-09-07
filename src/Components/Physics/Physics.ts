/**
 * Physics.ts — renderer-agnostic System.
 *
 * Physics state orchestration lives in Physics.core.ts. This System is a thin
 * driver: it watches for entities carrying PhysicsComponent (whatever minted
 * their mesh — MeshPrimitive, Renderable, a GLB), asks
 * the adapter to create a rigid body (`world.renderer.physicsCreateBody`),
 * forwards pause/resume events, and steps physics each frame via the adapter
 * (`world.renderer.physicsStep`). Under Babylon the adapter delegates to
 * Havok; under Three (or the mock) the adapter uses the pure-core integrator.
 * Zero @babylonjs / three imports — those live in the adapters.
 */

import { PhysicsEvents, PhysicsInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { PhysicsComponent, type PhysicsSetCollidersVisibleEvent, type PhysicsSetGravityEvent, type PhysicsSetRestitutionEvent, type PhysicsSetTimeStepEvent, type PhysicsSetVelocityEvent } from './Physics.defs';

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
    // A MeshPrimitive sibling that has not minted yet: wait for its handle.
    // Any other mesh source — a Renderable, a GLB Mesh, a procedural rock — is
    // answered by the adapter itself: physicsCreateBody reports false while
    // there is no mesh under this entity's id, and this runs again next tick.
    const prim = entity.get(MeshPrimitiveComponent);
    if (prim && !prim.handle) return;

    const r = this.world?.renderer;
    if (!r) return;
    if (!r.physicsCreateBody(entity.id, comp.toBodyOpts())) return;
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

// The definitions live in Physics.defs.ts; re-exported so existing importers
// keep working. New code should import them from './Physics.defs' directly.
export { PhysicsComponent, type PhysicsInput, type PhysicsMotionTypeName, type PhysicsSetCollidersVisibleEvent, type PhysicsSetGravityEvent, type PhysicsSetRestitutionEvent, type PhysicsSetTimeStepEvent, type PhysicsSetVelocityEvent, type PhysicsShapeTypeName } from './Physics.defs';
export { PHYSICS_EXTENSION, type PhysicsExtension, type PhysicsQueryHit } from './Physics.defs';
