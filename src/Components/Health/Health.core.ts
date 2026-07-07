/**
 * Health — pure core (data + event constants + request payload shapes).
 *
 * Generic HP component, decoupled from any one game.
 *
 * Wire it up by:
 *   1. Adding `Health: { hp, maxHp, invulnSeconds?, respawnPosition? }` to
 *      an entity in the scene.
 *   2. Anywhere that should hurt the entity, emit `health.damage`
 *      { entityId, damage } on the event bus.
 *
 * The system (in `Health.ts`) absorbs damage during invulnerability
 * windows, emits `health.damaged` { entityId, hp, maxHp } when HP actually
 * moves, and on 0 HP emits `health.died` { entityId } — then, if a
 * `respawnPosition` is set, snaps the entity's MeshPrimitive back to that
 * point with full HP restored.
 */
import { Component } from '@babylonjsmarket/ecs'

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
