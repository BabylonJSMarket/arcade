/**
 * Movement — definitions.
 *
 * Holds the `MovementComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Movement in a query, or type an event it listens for, without pulling
 * Movement's behaviour into its own bundle. Import from here, not from
 * Movement.ts.
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
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Movement must still match a copy in the project.
  static componentType = 'Movement';

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