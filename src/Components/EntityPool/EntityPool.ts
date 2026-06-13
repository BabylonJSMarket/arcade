/**
 * EntityPool.ts — renderer-agnostic System for the generic, declarative pool.
 *
 * Registers a framework entity pool (`world.registerPool`) per
 * EntityPoolComponent it sees, building each slot from the declarative
 * `components` config (resolved by name via `world.sceneLoader`). Spawning a
 * wave never churns entities/meshes: `entityPool.spawn` → `world.acquire`
 * (un-parks + resets a slot), `entityPool.release` → `world.release` (parks it).
 *
 * See EntityPool.core for the collision-proxy convention and reuse semantics.
 */
import { System } from '@babylonjsmarket/ecs'
import type { EventBus, Entity, World } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import {
  EntityPoolComponent,
  EntityPoolEvents,
  EntityPoolInputEvents,
  type EntityPoolSpawnEvent,
  type EntityPoolReleaseEvent,
} from './EntityPool.core'

export {
  EntityPoolComponent,
  EntityPoolEvents,
  EntityPoolInputEvents,
  type EntityPoolInput,
  type EntityPoolSpawnEvent,
  type EntityPoolReleaseEvent,
} from './EntityPool.core'

export class EntityPoolSystem extends System {
  protected query = { required: [EntityPoolComponent] }
  /** Pool names already registered (idempotent across ticks). */
  private registered = new Set<string>()
  /** entityId → pool name, so RELEASE can name the pool on its event. */
  private poolOf = new Map<string, string>()

  protected onInitialize(): void {
    this.listen(EntityPoolInputEvents.SPAWN, (e: EntityPoolSpawnEvent) => this.handleSpawn(e))
    this.listen(EntityPoolInputEvents.RELEASE, (e: EntityPoolReleaseEvent) =>
      this.release(e.entityId),
    )
  }

  protected onUpdate(): void {
    // Register each declared pool lazily on the first tick the world + renderer
    // are ready (build pre-creates meshes). Idempotent via `registered`.
    const w = this.world
    if (!w || !w.renderer) return
    for (const entity of this.entities) {
      const comp = entity.get(EntityPoolComponent)
      if (!comp || this.registered.has(comp.pool)) continue
      this.registerPool(w, comp)
      this.registered.add(comp.pool)
      this.eventBus.emit(EntityPoolEvents.READY, { pool: comp.pool, size: comp.size })
    }
  }

  private registerPool(w: World, comp: EntityPoolComponent): void {
    const sl = w.sceneLoader
    const tags = comp.tags
    // Precompute the effective per-component data ONCE so build + reset agree.
    // When a visual Mesh is declared, the MeshPrimitive becomes an invisible
    // collision proxy and its Shadow caster is off (the Mesh casts instead).
    const hasVisual = Object.prototype.hasOwnProperty.call(comp.components, 'Mesh')
    const effective: Array<[string, Record<string, unknown>]> = Object.entries(comp.components).map(
      ([name, data]) => {
        if (hasVisual && name === 'MeshPrimitive') return [name, { ...data, visible: false }]
        if (hasVisual && name === 'Shadow') return [name, { ...data, castShadow: false }]
        return [name, data]
      },
    )

    const resolve = (name: string) => sl?.getComponentClass(name) as (new (d?: unknown) => object) | undefined

    w.registerPool(comp.pool, {
      size: comp.size,
      build: (entity: Entity) => {
        for (const t of tags) entity.addTag(t)
        for (const [name, data] of effective) {
          const Cls = resolve(name)
          if (!Cls) {
            console.warn(`EntityPool[${comp.pool}]: component "${name}" is not registered`)
            continue
          }
          entity.add(new Cls(data) as never)
        }
      },
      reset: (entity: Entity, data?: unknown) => {
        const e = (data ?? {}) as EntityPoolSpawnEvent
        // A reused slot keeps exactly its declared tags — clear any transient
        // gameplay tags (e.g. `dying`) that were added during its last life.
        for (const t of entity.getTags()) {
          if (!tags.includes(t)) entity.removeTag(t)
        }
        // Re-apply each declared component's config so configured fields (HP,
        // speed, …) snap back, copying only keys that exist directly on the
        // component instance — runtime state (mesh handles, nested load params,
        // i-frame timers) is left intact.
        for (const [name, cfg] of effective) {
          const Cls = resolve(name)
          if (!Cls) continue
          const inst = entity.get(Cls as never) as Record<string, unknown> | undefined
          if (!inst) continue
          const fresh = new Cls(cfg) as Record<string, unknown>
          for (const k of Object.keys(cfg)) {
            if (k in inst) inst[k] = fresh[k]
          }
        }
        // Position the collision/position proxy.
        const mp = entity.get(MeshPrimitiveComponent)
        if (mp) {
          mp.position[0] = e.x
          mp.position[1] = e.y
          mp.position[2] = e.z
        }
        // Per-spawn dynamics / custom reset for game systems.
        this.eventBus.emit(EntityPoolEvents.ACQUIRED, { pool: comp.pool, entityId: entity.id, data: e })
      },
    })
  }

  private handleSpawn(e: EntityPoolSpawnEvent): void {
    const w = this.world
    if (!w || !this.registered.has(e.pool)) return
    const ent = w.acquire(e.pool, e)
    if (!ent) {
      this.eventBus.emit(EntityPoolEvents.EXHAUSTED, { pool: e.pool })
      return
    }
    this.poolOf.set(ent.id, e.pool)
    this.eventBus.emit(EntityPoolEvents.SPAWNED, {
      pool: e.pool,
      entityId: ent.id,
      spawnerId: e.spawnerId,
    })
  }

  private release(entityId: string): void {
    const w = this.world
    if (!w) return
    const ent = w.getEntity(entityId)
    if (!ent) return
    if (w.release(ent)) {
      this.eventBus.emit(EntityPoolEvents.RELEASED, {
        pool: this.poolOf.get(entityId) ?? '',
        entityId,
      })
    }
  }
}
