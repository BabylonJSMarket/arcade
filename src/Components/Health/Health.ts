/**
 * Health.ts — renderer-agnostic System.
 *
 * The core (`Health.core.ts`) owns the HealthComponent, event-name
 * constants (HealthEvents, HealthInputEvents), and request-payload
 * interfaces (HealthDamageRequest, HealthHealRequest). This System listens
 * for the input events, mutates HP, emits the output events, and (for
 * respawn-configured entities) snaps the host's MeshPrimitive back to the
 * configured spawn point with full HP.
 */
import { HealthEvents, HealthInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs'
import type { EventBus, Entity } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { HealthComponent, type HealthDamageRequest, type HealthHealRequest, type HealthInput } from './Health.core';

export class HealthSystem extends System {
  protected query = { required: [HealthComponent] }

  constructor(eventBus: EventBus) {
    super(eventBus)
  }

  protected onInitialize(): void {
    this.listen(HealthInputEvents.DAMAGE, (req: HealthDamageRequest) => {
      this.applyDamage(req)
    })
    this.listen(HealthInputEvents.HEAL, (req: HealthHealRequest) => {
      this.applyHeal(req)
    })
  }

  protected onUpdate(_dt: number): void {
    /* event-driven */
  }

  private applyDamage(req: HealthDamageRequest): void {
    const ent = this.world?.getEntity(req.entityId)
    if (!ent) return
    const h = ent.get(HealthComponent)
    if (!h || h.hp <= 0 || req.damage <= 0) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now < h.invulnUntil) return

    h.hp = Math.max(0, h.hp - req.damage)
    if (h.invulnSeconds > 0) h.invulnUntil = now + h.invulnSeconds * 1000
    this.eventBus.emit(HealthEvents.DAMAGED, {
      entityId: req.entityId,
      hp: h.hp,
      maxHp: h.maxHp,
      damage: req.damage,
    })

    if (h.hp <= 0) {
      this.eventBus.emit(HealthEvents.DIED, { entityId: req.entityId })
      if (h.respawnPosition) this.respawn(ent, h)
    }
  }

  private applyHeal(req: HealthHealRequest): void {
    const ent = this.world?.getEntity(req.entityId)
    if (!ent) return
    const h = ent.get(HealthComponent)
    if (!h || req.amount <= 0) return
    if (h.hp >= h.maxHp) return
    h.hp = Math.min(h.maxHp, h.hp + req.amount)
    this.eventBus.emit(HealthEvents.HEALED, {
      entityId: req.entityId,
      hp: h.hp,
      maxHp: h.maxHp,
      amount: req.amount,
    })
  }

  private respawn(entity: Entity, h: HealthComponent): void {
    if (!h.respawnPosition) return
    // Set the position DATA only — the entity's transform owner (for the player,
    // TwinStickShooter, which commits every frame) pushes it to the renderer.
    // Calling setMeshPosition here too would make HealthSystem a second writer
    // of the same mesh handle in one frame, racing that owner on the death
    // frame (the flicker the RaceDetector flags). Respawn is only used by the
    // player, which has such an owner.
    const mesh = entity.get(MeshPrimitiveComponent)
    if (mesh) {
      mesh.position[0] = h.respawnPosition[0]
      mesh.position[1] = h.respawnPosition[1]
      mesh.position[2] = h.respawnPosition[2]
    }
    h.hp = h.maxHp
    // Brief grace after respawn so a clump of enemies doesn't insta-kill again.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    h.invulnUntil = now + Math.max(h.invulnSeconds, 1.0) * 1000
    this.eventBus.emit(HealthEvents.RESPAWNED, {
      entityId: entity.id,
      hp: h.hp,
      maxHp: h.maxHp,
    })
  }
}

export { HealthComponent, type HealthDamageRequest, type HealthHealRequest, type HealthInput } from './Health.core';
