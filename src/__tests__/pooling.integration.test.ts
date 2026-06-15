/**
 * Reproduces the live ArcadeGame lifecycle order — entities are created during
 * scene load, THEN systems are added (with backfill) — to prove the bullet +
 * enemy pools build and make their meshes visible on fire/spawn. Unit tests add
 * systems first; this guards the reversed order the runtime actually uses.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EventBus, World, SceneLoader, MockRendererAdapter, type MeshHandle, type Vec3 } from '@babylonjsmarket/ecs'
import { MeshPrimitiveSystem, MeshPrimitiveComponent } from '../Components/MeshPrimitive/MeshPrimitive'
import { BulletPoolComponent, BulletPoolSystem } from '../Components/BulletPool/BulletPool'
import { BulletComponent, BulletSystem } from '../Components/Bullet/Bullet'
import { EntityPoolComponent, EntityPoolSystem } from '../Components/EntityPool/EntityPool'
import { EnemyComponent, EnemySystem } from '../Components/Enemy/Enemy'
import { EnemySpawnerComponent, EnemySpawnerSystem } from '../Components/EnemySpawner/EnemySpawner'
import { HealthComponent, HealthSystem } from '../Components/Health/Health'
import { HealthBarComponent, HealthBarSystem } from '../Components/HealthBar/HealthBar'
import { TwinStickShooterComponent, TwinStickShooterSystem } from '../Components/TwinStickShooter/TwinStickShooter'
import { FlashComponent, FlashSystem } from '../Components/Flash/Flash'
import { BulletPoolInputEvents } from '../Components/BulletPool/BulletPool'

/** Latest position the renderer was told for a given handle. */
function lastPosition(renderer: MockRendererAdapter, handle: MeshHandle): Vec3 | undefined {
  let p: Vec3 | undefined
  for (const c of renderer.calls) {
    if (c.method === 'setMeshPosition' && c.args[0] === handle) {
      p = [c.args[1] as number, c.args[2] as number, c.args[3] as number]
    }
  }
  return p
}

describe('pool integration (live lifecycle order)', () => {
  let eventBus: EventBus
  let world: World
  let renderer: MockRendererAdapter

  beforeEach(() => {
    eventBus = new EventBus()
    renderer = new MockRendererAdapter()
    // EntityPool resolves its declarative component set by name via the
    // SceneLoader registry — wire one up (mirrors ArcadeGame, where scene
    // markers register these names before the pool builds).
    const sceneLoader = new SceneLoader(eventBus)
    sceneLoader.registerComponent('MeshPrimitive', MeshPrimitiveComponent, MeshPrimitiveSystem)
    sceneLoader.registerComponent('Enemy', EnemyComponent, EnemySystem)
    sceneLoader.registerComponent('Health', HealthComponent, HealthSystem)
    sceneLoader.registerComponent('HealthBar', HealthBarComponent, HealthBarSystem)
    // World is NOT initialized yet — mirrors ArcadeGame constructing the world
    // before loadScene.
    world = new World({ eventBus, renderer, sceneLoader, detectRaces: false })

    // 1) Entities first (as SceneLoader.instantiateScene does).
    const worldEntity = world.createEntity('World')
    worldEntity.add(
      new BulletPoolComponent({ poolSize: 8, bulletDiameter: 0.5, arenaHalfWidth: 8, arenaHalfDepth: 8 }),
    )
    worldEntity.add(new BulletComponent())
    worldEntity.add(
      new EntityPoolComponent({
        pool: 'enemy',
        size: 8,
        tags: ['enemy'],
        components: {
          MeshPrimitive: { primitive: 'sphere', diameter: 1.2 },
          Enemy: {},
          Health: { hp: 2, maxHp: 2 },
          HealthBar: {},
        },
      }),
    )
    // A bare `Flash: {}` marker (no MeshPrimitive) — exactly like the live
    // scene's World singleton. FlashSystem must NOT consume it; if it does, the
    // pool-host entity is destroyed and the pools silently stop working. Short
    // lifetime so the regression would trigger within the test's frames.
    worldEntity.add(new FlashComponent({ lifetime: 0.05 }))

    const player = world.createEntity('Player')
    player.addTag('player')
    player.add(new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0.8, 0] }))

    const spawner = world.createEntity('Spawner')
    spawner.add(
      new MeshPrimitiveComponent({ primitive: 'cylinder', position: [5, 0.2, 5] }),
    )
    spawner.add(new EnemySpawnerComponent({ interval: 0.1, maxAlive: 4 }))

    // 2) Systems after (as ArcadeGame does from instantiateScene's result).
    for (const s of [
      new MeshPrimitiveSystem(eventBus),
      new HealthSystem(eventBus),
      new HealthBarSystem(eventBus),
      new BulletPoolSystem(eventBus),
      new BulletSystem(eventBus),
      new EntityPoolSystem(eventBus),
      new EnemySystem(eventBus),
      new EnemySpawnerSystem(eventBus),
      new TwinStickShooterSystem(eventBus),
      new FlashSystem(eventBus),
    ]) {
      world.addSystem(s)
    }
  })

  it('bullet pool builds and a fired bullet mesh becomes visible', () => {
    world.update(1 / 60) // auto-initialize + build pools

    const bulletMeshIds = renderer.calls
      .filter((c) => c.method === 'createMesh' && String(c.args[0]).startsWith('bullet-'))
      .length
    expect(bulletMeshIds).toBe(8) // pool pre-allocated

    eventBus.emit(BulletPoolInputEvents.FIRE, {
      x: 1,
      y: 0.8,
      z: 0,
      dx: 0,
      dz: 1,
      meta: { speed: 30, lifetime: 1.4, radius: 0.4, damage: 1 },
    })
    world.update(1 / 60)

    // A pooled bullet mesh was moved out of its parked depth to the firing
    // height (0.8) — i.e. it's now on the playfield, not parked below it.
    const placedOnField = renderer.calls.some(
      (c) => c.method === 'setMeshPosition' && c.args[2] === 0.8,
    )
    expect(placedOnField).toBe(true)
  })

  it('a bullet that leaves the arena is released back to the pool', () => {
    world.update(1 / 60) // build pools

    eventBus.emit(BulletPoolInputEvents.FIRE, {
      x: 0,
      y: 0.8,
      z: 0,
      dx: 0,
      dz: 1, // travels +z; arena bound is 8
      speed: 40,
      lifetime: 5, // long enough that bounds (not lifetime) ends it
    })
    // Acquire frame is skipped (newborn); then ~0.5s of travel → z ≈ 20 > 8.
    const fired = world.getEntitiesByTag('bullet').filter((e) => e.active)
    expect(fired.length).toBe(1)
    const bulletId = fired[0]!.id

    for (let i = 0; i < 40; i++) world.update(1 / 60)

    // Released (parked) for leaving the arena — not destroyed, still poolable.
    expect(world.getEntity(bulletId)!.active).toBe(false)
    expect(world.getEntitiesByTag('bullet').filter((e) => e.active).length).toBe(0)
  })

  it('enemy pool builds and a spawned enemy becomes visible + live', () => {
    // A few ticks: pool builds, spawner interval (0.1s) elapses, spawn flows.
    // This also outlasts the World entity's Flash-marker lifetime (0.05s) —
    // the pool-host must survive it (regression guard for FlashSystem eating
    // bare marker entities).
    for (let i = 0; i < 12; i++) world.update(1 / 60)

    // The pool-host singleton must still exist (FlashSystem must not have
    // consumed the bare Flash marker on it).
    expect(world.getEntity('World')).toBeDefined()

    // Pooled enemies all carry the `enemy` tag; only acquired ones are active.
    const liveEnemies = world.getEntitiesByTag('enemy').filter((e) => e.active)
    expect(liveEnemies.length).toBeGreaterThan(0)

    const mesh = liveEnemies[0]!.get(MeshPrimitiveComponent)
    expect(mesh?.handle).toBeDefined()
    // The reused body was positioned at the spawn point (spawner y 0.2 + 0.5).
    const pos = lastPosition(renderer, mesh!.handle!)
    expect(pos).toBeDefined()
    expect(pos![1]).toBeCloseTo(0.7)
  })
})
