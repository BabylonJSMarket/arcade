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

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import {
  createMovement,
  DEFAULT_MOVEMENT_PARAMS,
  type MovementInstance,
  type MovementParams,
} from './Movement.core';

// ============================================
// Events
// ============================================

export const MovementEvents = {
  /** Emitted the frame the character leaves the ground via jump. */
  JUMP_STARTED: 'movement.jump.started',
  /** Emitted whenever the grounded state flips. Payload: { isGrounded }. */
  GROUNDED_CHANGED: 'movement.grounded.changed',
  /** Emitted the frame the character transitions from still to moving. */
  STARTED_MOVING: 'movement.started',
  /** Emitted the frame the character transitions from moving to still. */
  STOPPED_MOVING: 'movement.stopped',
} as const;

export const MovementInputEvents = {
  /** External move intent. Payload: `{ entityId, x, y?, z }`. XZ plane only. */
  SET_MOVEMENT_VECTOR: 'input.movement.vector',
  /** External jump request. Payload: `{ entityId }`. Edge-triggered. */
  JUMP_REQUESTED: 'input.jump.requested',
} as const;

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
  private unsubscribes: Array<() => void> = [];
  /** Reusable tuple for get/set adapter calls — avoids per-frame allocation. */
  private _tmp: Vec3 = [0, 0, 0];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [MovementComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on(MovementInputEvents.SET_MOVEMENT_VECTOR, (e: MovementSetVectorEvent) => {
        this.handleSetVector(e);
      }),
      this.eventBus.on(MovementInputEvents.JUMP_REQUESTED, (e: MovementJumpEvent) => {
        this.handleJump(e);
      }),
    );

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
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

      const entityId = (entity as unknown as { id: string }).id;
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
