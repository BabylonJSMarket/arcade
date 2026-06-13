/**
 * BulletPool.ts — registers a framework entity pool of reusable bullet entities
 * (MeshPrimitive + Bullet), so firing never allocates an entity or mesh.
 *
 * `bulletPool.fire` → `world.acquire('bullet', …)`: un-parks a slot and resets
 * its direction/speed/lifetime + muzzle position. BulletSystem drives the
 * flight + collision off the live (active) bullet entities and releases a
 * bullet (`world.removeEntity`, which parks it) on expiry or hit.
 *
 * Parking is the World `active` flag; the park-aware MeshPrimitiveSystem keeps
 * each bullet's mesh alive (hidden) for reuse.
 */
import { Component, System } from '@babylonjsmarket/ecs'
import type { EventBus, Entity, World } from '@babylonjsmarket/ecs'
import type { Color } from '@babylonjsmarket/ecs/renderer-types'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { BulletComponent } from '../Bullet/Bullet.core'

export interface BulletPoolParams {
  /** Number of bullet entities to pre-allocate. Caps concurrent live bullets. */
  poolSize: number
  /** Diameter of the bullet sphere mesh — fixed at allocation. */
  bulletDiameter: number
  /** Arena half-extents; a bullet that leaves them is released (0 = unbounded). */
  arenaHalfWidth: number
  arenaHalfDepth: number
}

export const DEFAULT_BULLET_POOL_PARAMS: BulletPoolParams = {
  poolSize: 50,
  bulletDiameter: 0.3,
  arenaHalfWidth: 0,
  arenaHalfDepth: 0,
}

export const BulletPoolEvents = {
  /** Emitted once the pool has registered + pre-built its bullet entities. */
  READY: 'bulletPool.ready',
} as const

export const BulletPoolInputEvents = {
  /** Ask the pool to place a bullet at a muzzle position, travelling (dx,dz). */
  FIRE: 'bulletPool.fire',
} as const

export interface BulletPoolFireEvent {
  x: number
  y: number
  z: number
  /** Unit travel direction (XZ). */
  dx?: number
  dy?: number
  dz?: number
  /** Optional per-shot color override for the mesh. */
  color?: Color
  /** Per-shot flight params (fall back to BulletComponent defaults). */
  speed?: number
  lifetime?: number
  radius?: number
  damage?: number
}

export interface BulletPoolInput extends Partial<BulletPoolParams> {
  /** Default RGB color applied to every bullet mesh. */
  color?: Color
}

export class BulletPoolComponent extends Component {
  params: BulletPoolParams
  color: Color

  constructor(data: BulletPoolInput = {}) {
    super()
    const { color, ...rest } = data
    this.params = { ...DEFAULT_BULLET_POOL_PARAMS, ...rest }
    this.color = color ? [color[0], color[1], color[2]] : [1, 1, 0]
  }

  serialize(): BulletPoolInput {
    return { ...this.params, color: [...this.color] as Color }
  }
}

/** World pool name for bullet entities. */
const BULLET_POOL = 'bullet'

export class BulletPoolSystem extends System {
  protected query = { required: [BulletPoolComponent] }
  private registered = false

  constructor(eventBus: EventBus) {
    super(eventBus)
  }

  protected onInitialize(): void {
    this.listen(BulletPoolInputEvents.FIRE, (e: BulletPoolFireEvent) =>
      this.handleFire(e),
    )
  }

  protected onUpdate(): void {
    if (this.registered) return
    const w = this.world
    if (!w || !w.renderer) return
    const comp = this.firstComponent()
    if (!comp) return
    this.registerPool(w, comp)
    this.registered = true
    this.eventBus.emit(BulletPoolEvents.READY, { size: comp.params.poolSize })
  }

  private firstComponent(): BulletPoolComponent | null {
    for (const entity of this.entities) {
      const c = entity.get(BulletPoolComponent)
      if (c) return c
    }
    return null
  }

  private registerPool(w: World, comp: BulletPoolComponent): void {
    w.registerPool(BULLET_POOL, {
      size: comp.params.poolSize,
      build: (entity: Entity) => {
        entity.addTag('bullet')
        entity.add(
          new MeshPrimitiveComponent({
            primitive: 'sphere',
            diameter: comp.params.bulletDiameter,
            segments: 8,
            // Mostly emissive so bullets pop against a dark arena.
            material: { diffuseColor: comp.color, emissiveColor: comp.color },
          }),
        )
        entity.add(
          new BulletComponent({
            arenaHalfWidth: comp.params.arenaHalfWidth,
            arenaHalfDepth: comp.params.arenaHalfDepth,
          }),
        )
      },
      reset: (entity: Entity, data?: unknown) => {
        const e = (data ?? {}) as BulletPoolFireEvent
        const b = entity.get(BulletComponent)
        const m = entity.get(MeshPrimitiveComponent)
        if (b) {
          // Reset every flight field so a recycled bullet never inherits the
          // previous shot's (e.g. an expired lifetime of ~0). Arena bounds are
          // set once at build (they don't change per shot).
          b.direction = [e.dx ?? 0, 0, e.dz ?? 0]
          b.speed = e.speed ?? 18
          b.lifetime = e.lifetime ?? 1.2
          b.radius = e.radius ?? 0.3
          b.damage = e.damage ?? 1
        }
        if (m) {
          m.position[0] = e.x
          m.position[1] = e.y
          m.position[2] = e.z
        }
      },
    })
  }

  private handleFire(e: BulletPoolFireEvent): void {
    const w = this.world
    if (!w || !this.registered) return
    const bullet = w.acquire(BULLET_POOL, e)
    if (!bullet) return
    if (e.color) {
      const mesh = bullet.get(MeshPrimitiveComponent)
      const r = w.renderer
      if (mesh?.handle && r) r.setMeshColor(mesh.handle, e.color[0], e.color[1], e.color[2])
    }
  }
}
