/**
 * Obstacle — definitions.
 *
 * Holds the `ObstacleComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Obstacle in a query, or type an event it listens for, without pulling
 * Obstacle's behaviour into its own bundle. Import from here, not from
 * Obstacle.ts.
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