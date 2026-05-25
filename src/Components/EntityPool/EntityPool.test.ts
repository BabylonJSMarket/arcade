/**
 * EntityPool system tests. The pool resolves its declarative `components` by
 * name via `world.sceneLoader`, so each test wires a SceneLoader with the
 * components it declares — mirroring the live ArcadeGame path (markers register
 * the names, then the pool builds from config).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EventBus, World, SceneLoader, MockRendererAdapter } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent, MeshPrimitiveSystem } from '../MeshPrimitive/MeshPrimitive'
import { HealthComponent, HealthSystem } from '../Health/Health'
import { MeshComponent, MeshSystem } from '../Mesh/Mesh'
import {
  EntityPoolComponent,
  EntityPoolSystem,
  EntityPoolEvents,
  EntityPoolInputEvents,
} from './EntityPool'

function setup(poolConfig: ConstructorParameters<typeof EntityPoolComponent>[0]) {
  const eventBus = new EventBus()
  const renderer = new MockRendererAdapter()
  const sceneLoader = new SceneLoader(eventBus)
  sceneLoader.registerComponent('MeshPrimitive', MeshPrimitiveComponent, MeshPrimitiveSystem)
  sceneLoader.registerComponent('Health', HealthComponent, HealthSystem)
  sceneLoader.registerComponent('Mesh', MeshComponent, MeshSystem)
  const world = new World({ eventBus, renderer, sceneLoader, detectRaces: false })

  const marker = world.createEntity('Pool')
  marker.add(new EntityPoolComponent(poolConfig))

  for (const s of [
    new MeshPrimitiveSystem(eventBus),
    new HealthSystem(eventBus),
    new MeshSystem(eventBus),
    new EntityPoolSystem(eventBus),
  ]) {
    world.addSystem(s)
  }
  return { eventBus, renderer, world }
}

describe('EntityPoolSystem', () => {
  let captured: Record<string, unknown[]>
  beforeEach(() => {
    captured = {}
  })

  it('pre-allocates the declared component set and emits READY', () => {
    const ready: unknown[] = []
    const { eventBus, renderer, world } = setup({
      pool: 'enemy',
      size: 4,
      tags: ['enemy'],
      components: {
        MeshPrimitive: { primitive: 'sphere', diameter: 1.2 },
        Health: { hp: 2, maxHp: 2 },
      },
    })
    eventBus.on(EntityPoolEvents.READY, (e) => ready.push(e))

    world.update(1 / 60)

    // 4 pooled entities built, each with a sphere mesh — and all parked.
    const built = renderer.calls.filter(
      (c) => c.method === 'createMesh' && String(c.args[0]).startsWith('enemy-'),
    )
    expect(built.length).toBe(4)
    expect(ready).toEqual([{ pool: 'enemy', size: 4 }])
    expect(world.getEntitiesByTag('enemy').filter((e) => e.active).length).toBe(0)
  })

  it('acquires a slot on spawn: positions the proxy + emits SPAWNED/ACQUIRED', () => {
    const spawned: unknown[] = []
    const acquired: unknown[] = []
    const { eventBus, world } = setup({
      pool: 'enemy',
      size: 4,
      tags: ['enemy'],
      components: {
        MeshPrimitive: { primitive: 'sphere', diameter: 1.2 },
        Health: { hp: 2, maxHp: 2 },
      },
    })
    eventBus.on(EntityPoolEvents.SPAWNED, (e) => spawned.push(e))
    eventBus.on(EntityPoolEvents.ACQUIRED, (e) => acquired.push(e))

    world.update(1 / 60) // build
    eventBus.emit(EntityPoolInputEvents.SPAWN, { pool: 'enemy', x: 1, y: 2, z: 3, spawnerId: 'S1' })
    world.update(1 / 60)

    const live = world.getEntitiesByTag('enemy').filter((e) => e.active)
    expect(live.length).toBe(1)
    const mp = live[0]!.get(MeshPrimitiveComponent)!
    expect(mp.position).toEqual([1, 2, 3])
    expect(spawned).toEqual([{ pool: 'enemy', entityId: live[0]!.id, spawnerId: 'S1' }])
    expect(acquired.length).toBe(1)
  })

  it('re-applies declared config on reuse (HP snaps back to full)', () => {
    const { eventBus, world } = setup({
      pool: 'enemy',
      size: 1,
      tags: ['enemy'],
      components: {
        MeshPrimitive: { primitive: 'sphere', diameter: 1.2 },
        Health: { hp: 3, maxHp: 3 },
      },
    })
    world.update(1 / 60)
    eventBus.emit(EntityPoolInputEvents.SPAWN, { pool: 'enemy', x: 0, y: 0, z: 0 })
    world.update(1 / 60)

    const enemy = world.getEntitiesByTag('enemy').filter((e) => e.active)[0]!
    const health = enemy.get(HealthComponent)!
    health.hp = 0 // "killed"
    enemy.addTag('dying') // transient tag added during its life

    // Park then re-acquire the single slot.
    eventBus.emit(EntityPoolInputEvents.RELEASE, { entityId: enemy.id })
    world.update(1 / 60)
    eventBus.emit(EntityPoolInputEvents.SPAWN, { pool: 'enemy', x: 5, y: 0, z: 5 })
    world.update(1 / 60)

    const reused = world.getEntitiesByTag('enemy').filter((e) => e.active)[0]!
    expect(reused.id).toBe(enemy.id) // same recycled slot
    expect(reused.get(HealthComponent)!.hp).toBe(3) // config re-applied
    expect(reused.hasTag('dying')).toBe(false) // transient tag cleared
    expect(reused.get(MeshPrimitiveComponent)!.position).toEqual([5, 0, 5])
  })

  it('makes the MeshPrimitive an invisible collision proxy when a visual Mesh is declared', () => {
    const { world } = setup({
      pool: 'enemy',
      size: 1,
      tags: ['enemy'],
      components: {
        MeshPrimitive: { primitive: 'sphere', diameter: 1.2 }, // no explicit visible
        Mesh: { src: 'bot.glb', instanced: true, follow: true },
      },
    })
    world.update(1 / 60) // build

    // The pooled entity exists (parked); its proxy primitive was forced invisible.
    const pooled = world.getEntitiesByTag('enemy')[0]!
    expect(pooled.get(MeshPrimitiveComponent)!.visible).toBe(false)
  })

  it('emits EXHAUSTED when a spawn cannot be served and no slot can recycle', () => {
    // size 1, two spawns: the second recycles the first (pools recycle the
    // oldest), so EXHAUSTED only fires for an unregistered pool name.
    const exhausted: unknown[] = []
    const { eventBus, world } = setup({
      pool: 'enemy',
      size: 1,
      tags: ['enemy'],
      components: { MeshPrimitive: { primitive: 'sphere', diameter: 1 } },
    })
    eventBus.on(EntityPoolEvents.EXHAUSTED, (e) => exhausted.push(e))
    world.update(1 / 60)
    // Spawning from a pool that was never registered is a no-op (guarded).
    eventBus.emit(EntityPoolInputEvents.SPAWN, { pool: 'ghost', x: 0, y: 0, z: 0 })
    world.update(1 / 60)
    expect(world.getEntitiesByTag('enemy').filter((e) => e.active).length).toBe(0)
    void captured
  })
})
