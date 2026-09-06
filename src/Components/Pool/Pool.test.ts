/**
 * PoolSystem tests — the blueprint-driven factory. A blueprint is a scene entity
 * carrying a `Pool` marker beside the components its instances get; the system
 * pre-allocates parked copies, consumes the blueprint, and serves slots via
 * `world.acquire` / the `pool.spawn` event.
 *
 * (System REGISTRATION of the offspring — the reason the template lives in the
 * scene — is an ArcadeGame/scene-load concern proven by the spaceshooter render, not
 * here; these tests wire the offspring systems by hand.)
 */
import { PoolEvents, PoolInputEvents } from '../../events'
import { describe, it, expect } from 'vitest'
import { EventBus, World, SceneLoader, MockRendererAdapter } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { MeshPrimitiveSystem } from '../MeshPrimitive/MeshPrimitive';
import { HealthComponent } from '../Health/Health.defs';
import { HealthSystem } from '../Health/Health';
import { ShadowComponent } from '../Shadow/Shadow.defs';
import { ShadowSystem } from '../Shadow/Shadow';
import { MeshComponent } from '../Mesh/Mesh.defs';
import { PoolComponent, PoolSystem } from './Pool'

function setup(
  poolData: ConstructorParameters<typeof PoolComponent>[0],
  offspring: { tags?: string[]; mp?: Record<string, unknown>; health?: Record<string, unknown> } = {},
  blueprintId = 'Bullets',
) {
  const eventBus = new EventBus()
  const renderer = new MockRendererAdapter()
  const sceneLoader = new SceneLoader(eventBus)
  sceneLoader.registerComponent('MeshPrimitive', MeshPrimitiveComponent, MeshPrimitiveSystem)
  sceneLoader.registerComponent('Health', HealthComponent, HealthSystem)
  sceneLoader.registerComponent('Pool', PoolComponent, PoolSystem)
  const world = new World({ eventBus, renderer, sceneLoader, detectRaces: false })

  // Blueprint entity: the Pool marker beside the offspring's own components.
  const bp = world.createEntity(blueprintId)
  bp.add(new PoolComponent(poolData))
  for (const t of offspring.tags ?? []) bp.addTag(t)
  bp.add(new MeshPrimitiveComponent(offspring.mp ?? { primitive: 'sphere', diameter: 1 }))
  bp.add(new HealthComponent(offspring.health ?? { hp: 2, maxHp: 2 }))

  for (const s of [
    new MeshPrimitiveSystem(eventBus),
    new HealthSystem(eventBus),
    new PoolSystem(eventBus),
  ]) {
    world.addSystem(s)
  }
  return { eventBus, renderer, world, blueprintId }
}

const slotMeshes = (renderer: MockRendererAdapter, pool: string) =>
  renderer.calls.filter(
    (c) => c.method === 'createMesh' && new RegExp(`^${pool}-\\d`).test(String(c.args[0])),
  )

describe('PoolSystem', () => {
  it('pre-allocates parked slots from the blueprint, emits READY, and consumes the blueprint', () => {
    const ready: unknown[] = []
    const { eventBus, renderer, world } = setup({ size: 4 }, { tags: ['bullet'] })
    eventBus.on(PoolEvents.READY, (e) => ready.push(e))

    world.update(1 / 60)

    // 4 slots built (one mesh each), and all parked (inactive).
    expect(slotMeshes(renderer, 'Bullets').length).toBe(4)
    expect(world.getEntitiesByTag('bullet').filter((e) => e.active).length).toBe(0)
    expect(world.getEntitiesByTag('bullet').length).toBe(4)
    expect(ready).toEqual([{ pool: 'Bullets', size: 4 }])
    // The blueprint template is gone — it was only there to seed slots + register systems.
    expect(world.getEntity('Bullets')).toBeUndefined()
  })

  it('pool name defaults to the blueprint entity id; an explicit name overrides', () => {
    const { world } = setup({ size: 2, name: 'ammo' }, {}, 'Bullets')
    world.update(1 / 60)
    expect(world.acquire('ammo', {})).not.toBeNull()
    expect(world.acquire('Bullets', {})).toBeNull() // the id is NOT the pool name when overridden
  })

  it('acquire unparks a slot, positions the MeshPrimitive proxy, and emits ACQUIRED', () => {
    const acquired: Array<{ pool: string; entityId: string }> = []
    const { eventBus, world } = setup({ size: 3 }, { tags: ['bullet'] })
    eventBus.on(PoolEvents.ACQUIRED, (e) => acquired.push(e as never))
    world.update(1 / 60)

    const ent = world.acquire('Bullets', { x: 5, y: 6, z: 7 })
    expect(ent).not.toBeNull()
    expect(ent!.active).toBe(true)
    const mp = ent!.get(MeshPrimitiveComponent)!
    expect([mp.position[0], mp.position[1], mp.position[2]]).toEqual([5, 6, 7])
    expect(acquired.length).toBe(1)
    expect(acquired[0].pool).toBe('Bullets')
  })

  it('re-applies the blueprint config on reuse (HP snaps back after a slot is recycled)', () => {
    const { world } = setup({ size: 1 }, { health: { hp: 2, maxHp: 2 } })
    world.update(1 / 60)

    const first = world.acquire('Bullets', { x: 0, y: 0, z: 0 })!
    first.get(HealthComponent)!.hp = 0 // "damaged" during its life
    world.removeEntity(first) // pool-owned → parked back

    const reused = world.acquire('Bullets', { x: 1, y: 1, z: 1 })!
    expect(reused).toBe(first) // same slot recycled
    expect(reused.get(HealthComponent)!.hp).toBe(2) // config re-applied
  })

  it('emits EXHAUSTED when a spawn can\'t be served, and ignores spawns for unknown pools', () => {
    const exhausted: unknown[] = []
    const spawned: unknown[] = []
    const { eventBus, world } = setup({ size: 0 }, { tags: ['bullet'] })
    eventBus.on(PoolEvents.EXHAUSTED, (e) => exhausted.push(e))
    eventBus.on(PoolEvents.SPAWNED, (e) => spawned.push(e))
    world.update(1 / 60)

    eventBus.emit(PoolInputEvents.SPAWN, { pool: 'Bullets', x: 0, y: 0, z: 0 }) // size 0 → exhausted
    eventBus.emit(PoolInputEvents.SPAWN, { pool: 'nope', x: 0, y: 0, z: 0 }) // unknown → ignored
    expect(exhausted).toEqual([{ pool: 'Bullets' }])
    expect(spawned).toEqual([])
  })

  it('a release for an unknown or non-pooled entity is a no-op', () => {
    const released: unknown[] = []
    const { eventBus, world } = setup({ size: 1 }, { tags: ['bullet'] })
    eventBus.on(PoolEvents.RELEASED, (e) => released.push(e))
    world.update(1 / 60)

    eventBus.emit(PoolInputEvents.RELEASE, { entityId: 'does-not-exist' }) // getEntity → undefined
    const plain = world.createEntity('plain') // not pool-owned
    eventBus.emit(PoolInputEvents.RELEASE, { entityId: plain.id }) // world.release → false
    expect(released).toEqual([])
  })

  it('spawn without a position leaves the proxy untouched (no x override)', () => {
    const { eventBus, world } = setup({ size: 1 }, { tags: ['bullet'], mp: { primitive: 'sphere', diameter: 1 } })
    world.update(1 / 60)
    const ent = world.acquire('Bullets', {}) // no x/y/z
    const mp = ent!.get(MeshPrimitiveComponent)!
    expect([mp.position[0], mp.position[1], mp.position[2]]).toEqual([0, 0, 0])
  })

  it('leaves no stray blueprint primitive behind at the origin', () => {
    // The blueprint is an ordinary entity, so MeshPrimitiveSystem will happily
    // build it a mesh. Consuming the blueprint has to blind that mesh, or the
    // scene keeps a spare sphere parked at 0,0,0 forever.
    const { world, renderer } = setup({ size: 2 }, { tags: ['bullet'] })
    world.update(1 / 60)
    world.update(1 / 60)

    // Whichever order the two systems ran in, nothing of the blueprint's own
    // mesh may survive: never minted at all (the World no longer hands a
    // mid-destroy entity back to MeshPrimitiveSystem, which is how the stray
    // used to get built), or painted false at creation if Pool got there
    // first, or disposed on the removal flush if MeshPrimitive did.
    const isBlueprintMesh = (h: unknown) =>
      (h as { __mockHandle?: string })?.__mockHandle === 'mesh:Bullets'
    const created = renderer.calls.filter((c) => c.method === 'createMesh' && c.args[0] === 'Bullets')
    if (created.length > 0) {
      const painted = renderer.calls
        .filter((c) => c.method === 'setMeshVisible' && isBlueprintMesh(c.args[0]))
        .pop()
      const disposed = renderer.calls.some((c) => c.method === 'disposeMesh' && isBlueprintMesh(c.args[0]))
      expect(disposed || painted?.args[1] === false).toBe(true)
    }
    expect(world.getEntity('Bullets')).toBeUndefined()
  })

  // A blueprint that draws a GLB has two bodies: the model you see and the
  // MeshPrimitive underneath it doing collision. Drawing both put a red sphere
  // inside every robot in TwinStickArena — this is the demotion EntityPool did
  // for its `components` map, carried over to the blueprint form.
  describe('a blueprint carrying a visual Mesh', () => {
    function withMesh(mesh?: Record<string, unknown>) {
      const eventBus = new EventBus()
      const sceneLoader = new SceneLoader(eventBus)
      sceneLoader.registerComponent('MeshPrimitive', MeshPrimitiveComponent, MeshPrimitiveSystem)
      sceneLoader.registerComponent('Shadow', ShadowComponent, ShadowSystem)
      sceneLoader.registerComponent('Mesh', MeshComponent)
      sceneLoader.registerComponent('Pool', PoolComponent, PoolSystem)
      const world = new World({ eventBus, renderer: new MockRendererAdapter(), sceneLoader, detectRaces: false })

      const bp = world.createEntity('Enemies')
      bp.add(new PoolComponent({ size: 2, name: 'enemy' }))
      bp.add(new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2 }))
      bp.add(new ShadowComponent({ castShadow: true, receiveShadow: false }))
      if (mesh) bp.add(new MeshComponent(mesh))
      for (const s of [new MeshPrimitiveSystem(eventBus), new ShadowSystem(eventBus), new PoolSystem(eventBus)]) {
        world.addSystem(s)
      }
      world.update(1 / 60)
      return world
    }

    it('hides the MeshPrimitive proxy and moves the shadow onto the model', () => {
      const slot = withMesh({ src: '/bot.glb', instanced: true, follow: true })!.acquire('enemy')!
      expect(slot.get(MeshPrimitiveComponent)!.visible).toBe(false)
      expect(slot.get(ShadowComponent)!.castShadow).toBe(false)
    })

    it('leaves a Mesh-less blueprint drawing its primitive as before', () => {
      const slot = withMesh()!.acquire('enemy')!
      expect(slot.get(MeshPrimitiveComponent)!.visible).toBe(true)
      expect(slot.get(ShadowComponent)!.castShadow).toBe(true)
    })

    it('keeps the demotion across a park + reacquire, not just the first build', () => {
      const world = withMesh({ src: '/bot.glb', instanced: true, follow: true })
      const first = world.acquire('enemy')!
      first.get(MeshPrimitiveComponent)!.visible = true // a live system flips it back on
      world.removeEntity(first.id)
      const again = world.acquire('enemy')!
      expect(again.get(MeshPrimitiveComponent)!.visible).toBe(false)
    })
  })

  it('drives spawn/release through the pool.spawn / pool.release events too', () => {
    const spawned: Array<{ entityId: string }> = []
    const released: unknown[] = []
    const { eventBus, world } = setup({ size: 2 }, { tags: ['bullet'] })
    eventBus.on(PoolEvents.SPAWNED, (e) => spawned.push(e as never))
    eventBus.on(PoolEvents.RELEASED, (e) => released.push(e))
    world.update(1 / 60)

    eventBus.emit(PoolInputEvents.SPAWN, { pool: 'Bullets', x: 0, y: 0, z: 0 })
    expect(spawned.length).toBe(1)
    expect(world.getEntitiesByTag('bullet').filter((e) => e.active).length).toBe(1)

    eventBus.emit(PoolInputEvents.RELEASE, { entityId: spawned[0].entityId })
    expect(released.length).toBe(1)
    expect(world.getEntitiesByTag('bullet').filter((e) => e.active).length).toBe(0)
  })
})
