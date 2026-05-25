import { describe, it, expect } from 'vitest'
import { EntityPoolComponent } from './EntityPool.core'

describe('EntityPoolComponent', () => {
  it('applies defaults', () => {
    const c = new EntityPoolComponent()
    expect(c.pool).toBe('entity')
    expect(c.size).toBe(16)
    expect(c.tags).toEqual([])
    expect(c.components).toEqual({})
  })

  it('takes config and serialize round-trips', () => {
    const input = {
      pool: 'enemy',
      size: 32,
      tags: ['enemy'],
      components: {
        MeshPrimitive: { primitive: 'sphere', diameter: 1.2 },
        Health: { hp: 2, maxHp: 2 },
      },
    }
    const a = new EntityPoolComponent(input)
    const b = new EntityPoolComponent(a.serialize())
    expect(b.pool).toBe('enemy')
    expect(b.size).toBe(32)
    expect(b.tags).toEqual(['enemy'])
    expect(b.components).toEqual(input.components)
  })

  it('copies tags so callers cannot mutate the component array', () => {
    const tags = ['enemy']
    const c = new EntityPoolComponent({ tags })
    tags.push('mutated')
    expect(c.tags).toEqual(['enemy'])
  })
})
