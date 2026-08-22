/**
 * KeyboardMover — definitions.
 *
 * The KeyboardMover component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * KeyboardMover in a query or react to what it emits: this file carries no System, so
 * naming KeyboardMover never drags its behaviour into your bundle.
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