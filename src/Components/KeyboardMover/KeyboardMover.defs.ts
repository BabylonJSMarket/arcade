/**
 * KeyboardMover — definitions.
 *
 * Holds the `KeyboardMoverComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name KeyboardMover in a query, or type an event it listens
 * for, without pulling KeyboardMover's behaviour into its own bundle. Import
 * from here, not from KeyboardMover.ts.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface KeyboardMoverInput {
  /** World units per second at full input. */
  speed?: number;
  /** When true, the mesh yaws to face its direction of motion. */
  faceMotion?: boolean;
}

export class KeyboardMoverComponent extends Component {
  speed: number;
  faceMotion: boolean;

  constructor(data: KeyboardMoverInput = {}) {
    super();
    this.speed = data.speed ?? 4;
    this.faceMotion = data.faceMotion ?? true;
  }

  serialize(): KeyboardMoverInput {
    return { speed: this.speed, faceMotion: this.faceMotion };
  }
}