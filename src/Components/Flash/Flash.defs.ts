/**
 * Flash — definitions.
 *
 * The Flash component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Flash in a query or react to what it emits: this file carries no System, so
 * naming Flash never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
export interface FlashInput {
  /** Seconds before the host entity is removed. */
  lifetime?: number
}

export class FlashComponent extends Component {
  lifetime: number

  constructor(data: FlashInput = {}) {
    super()
    this.lifetime = data.lifetime ?? 0.08
  }

  serialize(): FlashInput {
    return { lifetime: this.lifetime }
  }
}