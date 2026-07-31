import { describe, it, expect } from 'vitest'
import { EnemyComponent } from './Enemy.core'

describe('EnemyComponent', () => {
  it('is a marker: constructs with no arguments and holds no data', () => {
    const c = new EnemyComponent()
    expect(c).toBeInstanceOf(EnemyComponent)
    expect(Object.keys(c.serialize())).toHaveLength(0)
  })

  it('round-trips through serialize as an empty object', () => {
    // A scene declares it as `"Enemy": {}` and gets it back the same way, which
    // is what keeps a save file honest about a component that says one thing.
    const json = JSON.parse(JSON.stringify(new EnemyComponent().serialize()))
    expect(json).toEqual({})
  })

  it('is queryable by class, which is why it is a component and not a tag', () => {
    // The whole reason this exists: `get(EnemyComponent)` cannot be typo'd the
    // way a string tag can.
    const hostile: unknown = new EnemyComponent()
    expect(hostile instanceof EnemyComponent).toBe(true)
    expect(new (class Other {})() instanceof EnemyComponent).toBe(false)
  })
})
