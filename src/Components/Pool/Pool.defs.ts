/**
 * Pool — definitions.
 *
 * The Pool component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Pool in a query or react to what it emits: this file carries no System, so
 * naming Pool never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
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