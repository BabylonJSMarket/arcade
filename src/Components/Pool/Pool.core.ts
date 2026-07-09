/**
 * Pool.core.ts — the blueprint marker for the generic entity factory (data only).
 *
 * A `Pool` component turns the scene entity it sits on into a BLUEPRINT: a
 * template whose OTHER components describe one pooled instance. `PoolSystem`
 * pre-allocates `size` parked copies of those components and hands them out via
 * `world.acquire(name)` — so spawning never churns entities or meshes, and there
 * is ONE pool implementation instead of a BulletPool / EnemyPool / MissilePool
 * per projectile type.
 *
 * Because the blueprint's other components are declared as ordinary top-level
 * scene component keys, their Systems register through the normal scene-keyed
 * path — so a pooled entity's behaviour (e.g. a bullet's impact System) runs
 * with no extra wiring. That is the whole point of putting the template in the
 * scene rather than in a nested config.
 *
 * Pure data — no imports from @babylonjs, three, solid-js, or the DOM.
 */
import { Component } from '@babylonjsmarket/ecs'

export interface PoolInput {
  /**
   * Pool name spawners pass to `world.acquire(name)`. Defaults to the blueprint
   * entity's id, so a `"Bullets"` blueprint is acquired as `world.acquire('Bullets')`.
   */
  name?: string
  /** Slots to pre-allocate. Caps concurrent live instances (recycles the oldest when exceeded). */
  size?: number
}

/**
 * Marks its host entity as a pool blueprint. The host's other components are the
 * template each pooled instance carries; this component itself is never copied
 * onto an instance.
 */
export class PoolComponent extends Component {
  /** Empty string means "use the blueprint entity's id as the pool name". */
  name: string
  size: number

  constructor(data: PoolInput = {}) {
    super()
    this.name = data.name ?? ''
    this.size = data.size ?? 16
  }

  serialize(): PoolInput {
    return { name: this.name || undefined, size: this.size }
  }
}
