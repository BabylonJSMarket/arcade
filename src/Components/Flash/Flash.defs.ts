/**
 * Flash — definitions.
 *
 * Holds the `FlashComponent` class and the shapes its data and events travel
 * in. No System lives here, which is the point: another component can name
 * Flash in a query, or type an event it listens for, without pulling Flash's
 * behaviour into its own bundle. Import from here, not from Flash.ts.
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