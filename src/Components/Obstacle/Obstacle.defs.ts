/**
 * Obstacle — definitions.
 *
 * The Obstacle component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Obstacle in a query or react to what it emits: this file carries no System, so
 * naming Obstacle never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
export interface ObstacleInput {
  /** XZ half-extents of the box footprint. */
  halfWidth?: number
  halfDepth?: number
  /** Full-height wall breaks line of sight (low cover doesn't). */
  blocksSight?: boolean
  /** Full-height wall stops bullets (low cover lets them through). */
  blocksBullets?: boolean
}

export class ObstacleComponent extends Component {
  halfWidth: number
  halfDepth: number
  blocksSight: boolean
  blocksBullets: boolean

  constructor(data: ObstacleInput = {}) {
    super()
    this.halfWidth = data.halfWidth ?? 1
    this.halfDepth = data.halfDepth ?? 1
    this.blocksSight = data.blocksSight ?? true
    this.blocksBullets = data.blocksBullets ?? true
  }

  serialize(): ObstacleInput {
    return {
      halfWidth: this.halfWidth,
      halfDepth: this.halfDepth,
      blocksSight: this.blocksSight,
      blocksBullets: this.blocksBullets,
    }
  }
}

/** An axis-aligned box footprint in the XZ plane. */
export interface BoxBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}