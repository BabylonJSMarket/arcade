/**
 * Health — definitions.
 *
 * Holds the `HealthComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Health in a query, or type an event it listens for, without pulling
 * Health's behaviour into its own bundle. Import from here, not from
 * Health.ts.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface HealthInput {
  hp?: number
  maxHp?: number
  /** Post-damage grace period in seconds. 0 = no i-frames. */
  invulnSeconds?: number
  /** If set, entity teleports here + restores full HP when HP hits 0. */
  respawnPosition?: [number, number, number]
}

export class HealthComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Health must still match a copy in the project.
  static componentType = 'Health'

  hp: number
  maxHp: number
  invulnSeconds: number
  respawnPosition: [number, number, number] | null

  /** Wall-clock ms (performance.now) until which damage is ignored. */
  invulnUntil = 0

  constructor(data: HealthInput = {}) {
    super()
    this.hp = data.hp ?? 10
    this.maxHp = data.maxHp ?? this.hp
    this.invulnSeconds = data.invulnSeconds ?? 0
    this.respawnPosition = data.respawnPosition ?? null
  }

  serialize(): HealthInput {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      invulnSeconds: this.invulnSeconds,
      respawnPosition: this.respawnPosition ?? undefined,
    }
  }
}

export interface HealthDamageRequest {
  entityId: string
  damage: number
}

export interface HealthHealRequest {
  entityId: string
  amount: number
}