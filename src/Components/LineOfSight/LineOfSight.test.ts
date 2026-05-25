import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs'
import { LineOfSightSystem } from './LineOfSight'
import { LineOfSightEvents, LineOfSightInputEvents } from './LineOfSight.core'
import { LineOfSightComponent } from './LineOfSight.core'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core'

describe('LineOfSightSystem', () => {
  let eventBus: EventBus
  let world: World
  let renderer: MockRendererAdapter
  let acquired: string[]
  let lost: string[]

  beforeEach(() => {
    // random()=0 → the per-entity check timer starts at 0 and fires on frame 1.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    eventBus = new EventBus()
    renderer = new MockRendererAdapter()
    world = new World({ eventBus, renderer })
    world.addSystem(new LineOfSightSystem(eventBus))
    world.initialize()
    acquired = []
    lost = []
    eventBus.on(LineOfSightEvents.ACQUIRED, (d: { entityId: string }) => acquired.push(d.entityId))
    eventBus.on(LineOfSightEvents.LOST, (d: { entityId: string }) => lost.push(d.entityId))
  })

  afterEach(() => vi.restoreAllMocks())

  function makePlayer(pos: [number, number, number]) {
    const e = world.createEntity()
    const m = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos })
    m.handle = renderer.createMesh(e.id, m.toPrimitiveSpec())
    e.add(m)
    e.addTag('player')
    return e
  }

  function makeSeer(pos: [number, number, number]) {
    const e = world.createEntity()
    const m = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos })
    m.handle = renderer.createMesh(e.id, m.toPrimitiveSpec())
    e.add(m)
    e.add(new LineOfSightComponent({ fov: 360, range: 100, blockRadius: 0.6 }))
    return e
  }

  it('emits acquired when the target is in clear view', () => {
    makePlayer([5, 0.8, 0])
    const seer = makeSeer([0, 0.5, 0])
    world.update(0.016)
    expect(acquired).toContain(seer.id)
    expect(lost).not.toContain(seer.id)
  })

  it('emits lost when another body blocks the sightline', () => {
    makePlayer([10, 0.8, 0])
    makeSeer([5, 0.5, 0]) // blocker, squarely between
    const blocked = makeSeer([0, 0.5, 0])
    world.update(0.016)
    expect(lost).toContain(blocked.id)
  })

  it('draws ray helper line systems only when toggled on', () => {
    makePlayer([5, 0.8, 0])
    makeSeer([0, 0.5, 0])
    world.update(0.016)
    expect(renderer.calls.some((c) => c.method === 'createLineSystem')).toBe(false)

    eventBus.emit(LineOfSightInputEvents.SET_DEBUG_RAYS, { enabled: true })
    world.update(0.016)
    expect(renderer.calls.some((c) => c.method === 'createLineSystem')).toBe(true)

    // Toggling off disposes them.
    eventBus.emit(LineOfSightInputEvents.SET_DEBUG_RAYS, { enabled: false })
    world.update(0.016)
    expect(renderer.calls.some((c) => c.method === 'disposeLineSystem')).toBe(true)
  })
})
