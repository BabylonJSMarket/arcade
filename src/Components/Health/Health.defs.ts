/**
 * Health — definitions.
 *
 * The Health component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Health in a query or react to what it emits: this file carries no System, so
 * naming Health never drags its behaviour into your bundle.
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