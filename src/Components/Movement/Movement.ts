/**
 * Movement.ts — renderer-agnostic System for character movement with jumping
 * and grounding.
 *
 * The pure core (Movement.core.ts) does the math. This System bridges it to
 * the world: on each frame it reads the input intent (move vector + jump
 * edge) out of the Component, reads the current mesh position from the active
 * adapter, feeds both into the core with a `groundY` from the Component
 * (flat-floor assumption by default), and writes the resulting position and
 * yaw rotation back through the adapter.
 *
 * Input intent is updated two ways:
 *   - Directly by setting `component.moveX/moveZ/jumpPressed` (script, AI).
 *   - Via event bus: `MovementInputEvents.SET_MOVEMENT_VECTOR` and
 *     `MovementInputEvents.JUMP_REQUESTED`.
 *
 * Zero imports from @babylonjs or three. Identical under both adapters.
 */

import { MovementEvents, MovementInputEvents, PhysicsInputEvents } from '../../events';
import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { PhysicsComponent, type PhysicsSetVelocityEvent } from '../Physics/Physics';
import {
  createMovement,
  DEFAULT_MOVEMENT_PARAMS,
  type MovementInstance,
  type MovementParams,
} from './Movement.core';

// ============================================
// Events
// ============================================





export interface MovementSetVectorEvent {
  entityId: string;
  x: number;
  y?: number;
  z: number;
}

export interface MovementJumpEvent {
  entityId: string;
}

export interface MovementInput extends Partial<MovementParams> {
  /**
   * World Y value of the ground under the character (flat-floor assumption).
   * Pass `null` to disable grounding entirely — the character falls forever.
   */
  groundY?: number | null;
  /** Initial position of the character's pivot. Defaults to [0, feetOffset, 0]. */
  position?: Vec3;
}

// ============================================
// Component
// ============================================

export class MovementComponent extends Component {
  params: MovementParams;
  /** Ground Y passed into the core each frame. null = no grounding. */
  groundY: number | null;
  initialPosition: Vec3;

  /** Live input intent — mutate directly or via input events. */
  moveX: number = 0;
  moveZ: number = 0;
  /** Edge-triggered: set true to request a jump; consumed on the next tick. */
  jumpPressed: boolean = false;

  /** Populated lazily by the System on first tick. */
  instance: MovementInstance | null = null;

  constructor(data: MovementInput = {}) {
    super();
    const { groundY, position, ...params } = data;
    this.params = { ...DEFAULT_MOVEMENT_PARAMS, ...params };
    this.groundY = groundY === undefined ? 0 : groundY;
    this.initialPosition = position
      ? [position[0], position[1], position[2]]
      : [0, this.params.feetOffset, 0];
  }

  serialize(): MovementInput {
    return {
      ...this.params,
      groundY: this.groundY,
      position: [...this.initialPosition] as Vec3,
    };
  }
}

// ============================================
// System
// ============================================

export class MovementSystem extends System {
  /** Reusable tuple for get/set adapter calls — avoids per-frame allocation. */
  private _tmp: Vec3 = [0, 0, 0];
  /** Reused scratch for the separation neighbor scan + its result. */
  private _sep: Vec3 = [0, 0, 0];
  private _sepOut = { x: 0, z: 0 };
  protected query = { required: [MovementComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /**
   * AI anti-clump separation. Physics bodies that all chase one ball pile into
   * a scrum; this adds a short-range, capped repulsion from nearby players so
   * `ai`-tagged agents keep their personal space and the play spreads out.
   * Only `ai` agents are pushed (the human's input stays crisp — they already
   * can't overlap thanks to the body), but they steer clear of EVERY player +
   * AI. Returns a velocity addend in `out`; zero when off or no one's close.
   */
  private separationVelocity(entity: Entity, px: number, pz: number, out: { x: number; z: number }): void {
    out.x = 0;
    out.z = 0;
    const r = this.world?.renderer;
    if (!r || !this.world || !entity.hasTag('ai')) return;
    const RADIUS = 2.2; // centers closer than this repel
    const STRENGTH = 4; // u/s per unit of crowding
    const MAX = 6; // cap so a tight cluster can't fling anyone
    let sx = 0;
    let sz = 0;
    for (const tag of ['ai', 'player']) {
      for (const other of this.world.getEntitiesByTag(tag)) {
        if (other.id === entity.id) continue;
        const om = other.get(MeshPrimitiveComponent);
        if (!om?.handle) continue;
        r.getMeshWorldPosition(om.handle, this._sep);
        const dx = px - this._sep[0];
        const dz = pz - this._sep[2];
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-6 && d2 < RADIUS * RADIUS) {
          const d = Math.sqrt(d2);
          const w = (1 - d / RADIUS) / d; // direction × linear falloff
          sx += dx * w;
          sz += dz * w;
        }
      }
    }
    let vx = sx * STRENGTH;
    let vz = sz * STRENGTH;
    const mag = Math.hypot(vx, vz);
    if (mag > MAX) {
      vx = (vx / mag) * MAX;
      vz = (vz / mag) * MAX;
    }
    out.x = vx;
    out.z = vz;
  }

  protected onInitialize(): void {
    this.listen(MovementInputEvents.SET_MOVEMENT_VECTOR, (e: MovementSetVectorEvent) => {
      this.handleSetVector(e);
    });
    this.listen(MovementInputEvents.JUMP_REQUESTED, (e: MovementJumpEvent) => {
      this.handleJump(e);
    });

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(MovementComponent);
    if (!comp || comp.instance) return;
    comp.instance = createMovement(comp.params);

    // Seed position: prefer mesh world position if available, else the
    // Component's initialPosition, else origin + feetOffset.
    const mesh = entity.get(MeshPrimitiveComponent);
    const r = this.world?.renderer;
    if (mesh?.handle && r) {
      r.getMeshWorldPosition(mesh.handle, this._tmp);
      comp.instance.setPosition(this._tmp[0], this._tmp[1], this._tmp[2]);
    } else {
      const p = comp.initialPosition;
      comp.instance.setPosition(p[0], p[1], p[2]);
    }
  }

  private findEntityById(entityId: string): Entity | undefined {
    for (const e of this.entities) if (e.id === entityId) return e;
    return undefined;
  }

  private handleSetVector(e: MovementSetVectorEvent): void {
    const entity = this.findEntityById(e.entityId);
    const comp = entity?.get(MovementComponent);
    if (!comp) return;
    comp.moveX = e.x;
    comp.moveZ = e.z;
  }

  private handleJump(e: MovementJumpEvent): void {
    const entity = this.findEntityById(e.entityId);
    const comp = entity?.get(MovementComponent);
    if (!comp) return;
    comp.jumpPressed = true;
  }

  protected onUpdate(dt: number): void {
    const r = this.world?.renderer;
    for (const entity of this.entities) {
      const comp = entity.get(MovementComponent);
      if (!comp?.instance) continue;

      // Pick up live panel edits to params.
      comp.instance.setParams(comp.params);

      // Sync the core's position with what the renderer actually shows —
      // external systems (Shadow, collisions) may have written to the mesh.
      const mesh = entity.get(MeshPrimitiveComponent);
      if (mesh?.handle && r) {
        r.getMeshWorldPosition(mesh.handle, this._tmp);
        comp.instance.setPosition(this._tmp[0], this._tmp[1], this._tmp[2]);
      }

      const wasMoving = comp.instance.getState().isMoving;
      const tick = comp.instance.update(
        {
          moveX: comp.moveX,
          moveZ: comp.moveZ,
          jumpPressed: comp.jumpPressed,
          groundY: comp.groundY,
        },
        dt,
      );

      // Jump is edge-triggered; reset after the update consumes it.
      comp.jumpPressed = false;

      const entityId = (entity as unknown as { id: string }).id;

      // Physics-velocity mode: when the entity ALSO carries a (non-static)
      // Physics body, the rigid body — not this System — owns the transform.
      // We translate the core's per-tick horizontal velocity into a
      // `physics.setVelocity` so the capsule COLLIDES with walls, the ball, and
      // other bodies instead of teleporting through them. Vertical velocity is
      // left to the engine (gravity), except on the jump frame where we inject
      // the jump impulse. We do NOT write the mesh transform here — Havok syncs
      // it from the body after each step (a setMeshPosition would be overwritten).
      const phys = entity.get(PhysicsComponent);
      const physicsMode = !!phys && phys.motionType !== 'static';

      if (physicsMode && r) {
        const state = r.physicsGetBodyState(entityId);
        if (state) {
          const vy = tick.jumpedThisFrame ? comp.params.jumpForce : state.linearVelocity[1];
          // Blend in AI separation so chasers don't clump on the ball.
          this.separationVelocity(entity, this._tmp[0], this._tmp[2], this._sepOut);
          this.eventBus.emit(PhysicsInputEvents.SET_VELOCITY, {
            entityId,
            vx: tick.velX + this._sepOut.x,
            vy,
            vz: tick.velZ + this._sepOut.z,
          } satisfies PhysicsSetVelocityEvent);
        }
      } else {
        if (mesh?.handle && r) {
          r.setMeshPosition(mesh.handle, tick.posX, tick.posY, tick.posZ);
          if (comp.params.faceMotion) {
            r.setMeshRotation(mesh.handle, 0, tick.yaw, 0);
          }
        }
        if (mesh) {
          mesh.position[0] = tick.posX;
          mesh.position[1] = tick.posY;
          mesh.position[2] = tick.posZ;
          if (comp.params.faceMotion) {
            mesh.rotation[1] = tick.yaw;
          }
        }
      }

      if (tick.jumpedThisFrame) {
        this.eventBus.emit(MovementEvents.JUMP_STARTED, { entityId });
      }
      if (tick.groundedChanged) {
        this.eventBus.emit(MovementEvents.GROUNDED_CHANGED, {
          entityId,
          isGrounded: tick.isGrounded,
        });
      }
      if (tick.isMoving !== wasMoving) {
        this.eventBus.emit(
          tick.isMoving ? MovementEvents.STARTED_MOVING : MovementEvents.STOPPED_MOVING,
          { entityId },
        );
      }
    }
  }
}
