/**
 * Pool.ts — the blueprint-driven entity factory (renderer-agnostic System).
 *
 * For each scene entity carrying a `PoolComponent`, PoolSystem reads the
 * entity's OTHER components as a template, pre-allocates `size` parked copies of
 * them via `world.registerPool`, then consumes the blueprint entity (its
 * component keys have already registered their Systems through the normal
 * scene-keyed path, so it's done its job). Spawners acquire an instance with
 * `world.acquire(name)` — or fire a `pool.spawn` event — and park it with
 * `world.removeEntity` / a `pool.release` event.
 *
 * ONE pool for every projectile / wave / debris type: a Bullet blueprint, an
 * Enemy blueprint, a Missile blueprint are all just entities with a `Pool`
 * marker beside the components their instances carry — no BulletPool /
 * EnemyPool / MissilePool subclasses.
 *
 * Reuse semantics — on acquire the slot's declared config is re-applied (so
 * HP / speed / lifetime snap back to the blueprint's values) and its tags are
 * reset to exactly the blueprint's, then `pool.acquired` fires so the spawner
 * can set per-spawn pose / velocity / owner on the returned entity. A declared
 * `MeshPrimitive` proxy is positioned from the spawn `{x,y,z}` for classic
 * games; 6-DOF spawners set `Transform6DOF` on the acquired entity themselves.
 *
 * No imports from @babylonjs, three, solid-js, or the DOM.
 */
import { PoolEvents, PoolInputEvents } from '../../events'
import { System } from '@babylonjsmarket/ecs'
import type { Entity, World, Component } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { PoolComponent } from './Pool.defs'

export { PoolComponent, type PoolInput } from './Pool.defs'

/** One captured blueprint component: its class + the config to rebuild it with. */
interface SlotPart {
  Ctor: new (data?: unknown) => Component
  data: Record<string, unknown>
}

/** Spawn payload for the `pool.spawn` event (extra keys ride through to ACQUIRED). */
export interface PoolSpawnEvent {
  pool: string
  x?: number
  y?: number
  z?: number
  spawnerId?: string
  [key: string]: unknown
}

export interface PoolReleaseEvent {
  entityId: string
}

function serializeOf(c: Component): Record<string, unknown> {
  const s = (c as { serialize?: () => unknown }).serialize
  return typeof s === 'function' ? ((s.call(c) as Record<string, unknown>) ?? {}) : {}
}

export class PoolSystem extends System {
  protected query = { required: [PoolComponent] }

  /** Pool names already registered (idempotent). */
  private registered = new Set<string>()
  /** entityId → pool name, so RELEASE can name the pool on its event. */
  private poolOf = new Map<string, string>()

  protected onInitialize(): void {
    // High priority so a blueprint is captured + consumed early each frame,
    // before spawners try to acquire from it and before it can be drawn.
    this.priority = 900
    this.listen(PoolInputEvents.SPAWN, (e: PoolSpawnEvent) => this.handleSpawn(e))
    this.listen(PoolInputEvents.RELEASE, (e: PoolReleaseEvent) => this.release(e.entityId))
  }

  protected onUpdate(): void {
    const w = this.world
    // Wait for the renderer: `build` pre-creates each slot's mesh, and a
    // renderer-less run (some tests) would allocate handle-less slots.
    if (!w || !w.renderer) return

    // Collect first — registering a pool + consuming its blueprint mutates
    // `this.entities`, which we must not do mid-iteration.
    const blueprints: Array<{ name: string; entity: Entity; size: number }> = []
    for (const entity of this.entities) {
      const comp = entity.get(PoolComponent)
      if (!comp) continue
      const name = comp.name || entity.id
      if (this.registered.has(name)) continue
      blueprints.push({ name, entity, size: comp.size })
    }

    for (const { name, entity, size } of blueprints) {
      this.registerFromBlueprint(w, name, entity, size)
      this.registered.add(name)
      this.eventBus.emit(PoolEvents.READY, { pool: name, size })
    }
  }

  private registerFromBlueprint(w: World, name: string, blueprint: Entity, size: number): void {
    const tags = blueprint.getTags()
    // Capture the template: every component EXCEPT the Pool marker, as
    // { class, config }. `constructor` gives the class, `serialize()` the config.
    const spec: SlotPart[] = blueprint
      .getComponents()
      .filter((c) => !(c instanceof PoolComponent))
      .map((c) => ({
        Ctor: c.constructor as new (data?: unknown) => Component,
        data: serializeOf(c),
      }))

    w.registerPool(name, {
      size,
      build: (e: Entity) => {
        for (const t of tags) e.addTag(t)
        for (const { Ctor, data } of spec) e.add(new Ctor(data))
      },
      reset: (e: Entity, data?: unknown) => {
        const d = (data ?? {}) as PoolSpawnEvent
        // A reused slot keeps exactly the blueprint's tags — drop transient ones
        // (e.g. `dead`) added during its last life.
        for (const t of e.getTags()) if (!tags.includes(t)) e.removeTag(t)
        // Re-apply each declared component's config so configured fields snap
        // back; leave runtime state (mesh handles, timers) untouched.
        for (const { Ctor, data: cfg } of spec) {
          const inst = e.get(Ctor as never) as Record<string, unknown> | undefined
          if (!inst) continue
          const fresh = new Ctor(cfg) as unknown as Record<string, unknown>
          for (const k of Object.keys(cfg)) if (k in inst) inst[k] = fresh[k]
        }
        // Classic games: position the MeshPrimitive collision/visual proxy.
        const mp = e.get(MeshPrimitiveComponent)
        if (mp && typeof d.x === 'number') {
          mp.position[0] = d.x
          mp.position[1] = d.y ?? 0
          mp.position[2] = d.z ?? 0
        }
        // Per-spawn dynamics: the spawner sets pose/velocity/owner here or on
        // the acquired entity directly.
        this.eventBus.emit(PoolEvents.ACQUIRED, { pool: name, entityId: e.id, data: d })
      },
    })

    // The blueprint has done its job (its component keys registered their
    // Systems at scene-load; its config seeded the slots). Consume it so it
    // isn't a stray live instance.
    w.removeEntity(blueprint)
  }

  private handleSpawn(e: PoolSpawnEvent): void {
    const w = this.world
    if (!w || !this.registered.has(e.pool)) return
    const ent = w.acquire(e.pool, e)
    if (!ent) {
      this.eventBus.emit(PoolEvents.EXHAUSTED, { pool: e.pool })
      return
    }
    this.poolOf.set(ent.id, e.pool)
    this.eventBus.emit(PoolEvents.SPAWNED, { pool: e.pool, entityId: ent.id, spawnerId: e.spawnerId })
  }

  private release(entityId: string): void {
    const w = this.world
    if (!w) return
    const ent = w.getEntity(entityId)
    if (!ent) return
    if (w.release(ent)) {
      this.eventBus.emit(PoolEvents.RELEASED, { pool: this.poolOf.get(entityId) ?? '', entityId })
    }
  }
}
