/**
 * Flash — pure core (data only).
 *
 * Short-lived visual entity. Spawned by other systems (e.g. TwinStickShooter
 * for muzzle flash, an impact handler for hit bursts). Carries a `lifetime`
 * countdown; the system removes the entity when the timer expires. No
 * animation by default — the FX is "brief, bright, gone." Pair it with
 * MeshPrimitive on the same entity for visuals.
 *
 * Typical use:
 *   const e = world.createEntity()
 *   e.add(new MeshPrimitiveComponent({
 *     primitive: 'sphere', diameter: 0.7, segments: 8,
 *     position: [...spawnPos],
 *     material: { diffuseColor: [1,1,0.6], emissiveColor: [1,1,0.6] },
 *   }))
 *   e.add(new FlashComponent({ lifetime: 0.08 }))
 */
import { Component } from '@babylonjsmarket/ecs'

export interface FlashInput {
  /** Seconds before the host entity is removed. */
  lifetime?: number
}

export class FlashComponent extends Component {
  lifetime: number

  constructor(data: FlashInput = {}) {
    super()
    this.lifetime = data.lifetime ?? 0.08
  }

  serialize(): FlashInput {
    return { lifetime: this.lifetime }
  }
}
