import { describe, it, expect } from 'vitest'
import { PoolComponent } from './Pool.core'

describe('PoolComponent', () => {
  it('defaults name to "" (use entity id) and size to 16', () => {
    const c = new PoolComponent()
    expect(c.name).toBe('')
    expect(c.size).toBe(16)
  })

  it('round-trips its config through serialize (name omitted when empty)', () => {
    expect(new PoolComponent({ size: 256 }).serialize()).toEqual({ name: undefined, size: 256 })
    expect(new PoolComponent({ name: 'ammo', size: 8 }).serialize()).toEqual({ name: 'ammo', size: 8 })
  })
})
