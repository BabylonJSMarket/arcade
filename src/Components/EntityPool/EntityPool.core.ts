/**
 * EntityPool — pure core (data only).
 *
 * A generic, declarative entity pool. Instead of a hard-coded `build()`, the
 * component set each pooled entity carries is declared as data (`components`),
 * exactly like a scene entity's `components` map. The System resolves each name
 * via the SceneLoader registry, so every component named here must be
 * registered (declare a marker for it on a scene entity, as usual).
 *
 * Convention — the MeshPrimitive is the collision/position proxy. Include a
 * `MeshPrimitive` in `components`; the pool writes each spawn's position into
 * it. When the set ALSO declares a separate visual `Mesh` (a loaded GLB), the
 * pool makes that MeshPrimitive invisible and stops it casting shadows — it
 * becomes a pure collision shape while the Mesh provides the visual (and casts
 * the shadow). Without a `Mesh`, the MeshPrimitive is the visual as usual.
 *
 * Reuse semantics — on acquire the pool re-applies each declared component's
 * config (so HP/speed/etc. snap back to configured values), clears any
 * transient tags (a reused slot keeps exactly its declared `tags`), writes the
 * spawn position, then emits ACQUIRED so game systems can apply per-spawn
 * dynamics. Runtime fields not named in the config (mesh handles, load state)
 * are preserved.
 *
 * No imports from @babylonjs, three, solid-js, or the DOM.
 */
import { Component } from '@babylonjsmarket/ecs'

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
