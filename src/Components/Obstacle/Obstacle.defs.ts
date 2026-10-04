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
  /**
   * Explicit XZ centre of the footprint, `[x, z]`. Set it for anything that
   * isn't a MeshPrimitive box — a GLB cabinet, a prop, an invisible barrier —
   * or whenever the collider should sit somewhere other than the mesh's
   * origin. When it is absent the footprint is centred on the sibling
   * MeshPrimitive, then on the sibling Mesh; an entity with neither is not
   * an obstacle at all.
   */
  center?: [number, number]
  /** XZ half-extents of the box footprint. */
  halfWidth?: number
  halfDepth?: number
  /** Full-height wall breaks line of sight (low cover doesn't). */
  blocksSight?: boolean
  /** Full-height wall stops bullets (low cover lets them through). */
  blocksBullets?: boolean
}

export class ObstacleComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Obstacle must still match a copy in the project.
  static componentType = 'Obstacle'

  center?: [number, number]
  halfWidth: number
  halfDepth: number
  blocksSight: boolean
  blocksBullets: boolean

  constructor(data: ObstacleInput = {}) {
    super()
    this.center = data.center ? [data.center[0], data.center[1]] : undefined
    this.halfWidth = data.halfWidth ?? 1
    this.halfDepth = data.halfDepth ?? 1
    this.blocksSight = data.blocksSight ?? true
    this.blocksBullets = data.blocksBullets ?? true
  }

  serialize(): ObstacleInput {
    return {
      ...(this.center ? { center: [this.center[0], this.center[1]] as [number, number] } : {}),
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
