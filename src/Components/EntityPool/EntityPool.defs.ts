/**
 * EntityPool — definitions.
 *
 * The EntityPool component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * EntityPool in a query or react to what it emits: this file carries no System, so
 * naming EntityPool never drags its behaviour into your bundle.
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