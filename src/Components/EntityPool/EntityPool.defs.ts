/**
 * EntityPool — definitions.
 *
 * Holds the `EntityPoolComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name EntityPool in a query, or type an event it listens for, without
 * pulling EntityPool's behaviour into its own bundle. Import from here, not
 * from EntityPool.ts.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface EntityPoolInput {
  /** Pool name; also the pooled-entity name prefix (`enemy-0`, …). */
  pool?: string
  /** Slots to pre-allocate. Caps concurrent live entities (recycles oldest when exceeded). */
  size?: number
  /** Tags every pooled entity carries (e.g. `['enemy']`). A reused slot is reset to exactly these. */
  tags?: string[]
  /**
   * Declarative component set for each pooled entity — `{ ComponentName: data }`.
   * Resolved by name via the SceneLoader registry; include a `MeshPrimitive`
   * (the collision/position proxy). See the file header for the visual-Mesh rule.
   */
  components?: Record<string, Record<string, unknown>>
}

export class EntityPoolComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in EntityPool must still match a copy in the project.
  static componentType = 'EntityPool'

  pool: string
  size: number
  tags: string[]
  components: Record<string, Record<string, unknown>>

  constructor(data: EntityPoolInput = {}) {
    super()
    this.pool = data.pool ?? 'entity'
    this.size = data.size ?? 16
    this.tags = data.tags ? [...data.tags] : []
    this.components = data.components ?? {}
  }

  serialize(): EntityPoolInput {
    return {
      pool: this.pool,
      size: this.size,
      tags: [...this.tags],
      components: this.components,
    }
  }
}

export interface EntityPoolSpawnEvent {
  /** Which pool to acquire from. */
  pool: string
  x: number
  y: number
  z: number
  /** Echoed on SPAWNED so spawners can track their live count. */
  spawnerId?: string
  /** Any extra keys ride through to the ACQUIRED event for per-spawn dynamics. */
  [key: string]: unknown
}

export interface EntityPoolReleaseEvent {
  entityId: string
}