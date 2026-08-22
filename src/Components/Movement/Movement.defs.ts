/**
 * Movement — definitions.
 *
 * The Movement component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Movement in a query or react to what it emits: this file carries no System, so
 * naming Movement never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { DEFAULT_MOVEMENT_PARAMS, type MovementInstance, type MovementParams } from './Movement.core';
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