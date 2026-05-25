/**
 * Flash.ts — renderer-agnostic System.
 *
 * The core (`Flash.core.ts`) owns the FlashComponent data class. This System
 * ticks the lifetime down each frame and removes the host entity when the
 * timer expires.
 */
import { System } from '@babylonjsmarket/ecs'
import type { EventBus } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { FlashComponent, type FlashInput } from './Flash.core'

export class FlashSystem extends System {
  // Require a mesh: a flash is a visual effect, so a real flash always has a
  // MeshPrimitive. This also stops the system from matching — and then
  // destroying — bare `Flash: {}` marker entities, e.g. the persistent
  // singleton that carries the BulletPool/EntityPool components. (Markers
  // exist only to make SceneLoader instantiate this system; they must never
  // be consumed as if they were real flashes.)
  protected query = { required: [FlashComponent, MeshPrimitiveComponent] }

  constructor(eventBus: EventBus) {
    super(eventBus)
  }

  protected onUpdate(dt: number): void {
    const w = this.world
    if (!w) return
    const toRemove: string[] = []
    for (const entity of this.entities) {
      const f = entity.get(FlashComponent)
      if (!f) continue
      f.lifetime -= dt
      if (f.lifetime <= 0) toRemove.push(entity.id)
    }
    for (const id of toRemove) w.removeEntity(id)
  }
}

export { FlashComponent, type FlashInput } from './Flash.core'
