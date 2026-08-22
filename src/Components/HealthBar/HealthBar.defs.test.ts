import { describe, it, expect } from 'vitest'
import { HealthBarComponent } from './HealthBar.defs'

describe('HealthBarComponent', () => {
  it('applies defaults', () => {
    const c = new HealthBarComponent()
    expect(c.width).toBe(1.2)
    expect(c.height).toBe(0.14)
    expect(c.offsetY).toBe(1.0)
    expect(c.color).toEqual([0.35, 0.95, 0.45])
    expect(c.backgroundColor).toEqual([0.12, 0.06, 0.08])
    expect(c.hideAtFullHp).toBe(true)
    expect(c.fillFromLeft).toBe(true)
  })

  it('merges input on top of defaults', () => {
    const color: [number, number, number] = [1, 0, 0]
    const bg: [number, number, number] = [0, 0, 0]
    const c = new HealthBarComponent({
      width: 2,
      offsetY: 1.5,
      color,
      backgroundColor: bg,
      hideAtFullHp: false,
      fillFromLeft: false,
    })
    expect(c.width).toBe(2)
    expect(c.height).toBe(0.14) // untouched
    expect(c.offsetY).toBe(1.5)
    expect(c.color).toEqual([1, 0, 0])
    expect(c.backgroundColor).toEqual([0, 0, 0])
    expect(c.hideAtFullHp).toBe(false)
    expect(c.fillFromLeft).toBe(false)
    // arrays get stored, not deep-cloned
    expect(c.color).toBe(color)
    expect(c.backgroundColor).toBe(bg)
  })

  it('serialize round-trips', () => {
    const a = new HealthBarComponent({
      width: 1.8,
      height: 0.2,
      offsetY: 2,
      color: [0.5, 0.5, 0.5],
      backgroundColor: [0.1, 0.1, 0.1],
      hideAtFullHp: false,
      fillFromLeft: false,
    })
    const b = new HealthBarComponent(a.serialize())
    expect(b.width).toBe(a.width)
    expect(b.height).toBe(a.height)
    expect(b.offsetY).toBe(a.offsetY)
    expect(b.color).toEqual(a.color)
    expect(b.backgroundColor).toEqual(a.backgroundColor)
    expect(b.hideAtFullHp).toBe(a.hideAtFullHp)
    expect(b.fillFromLeft).toBe(a.fillFromLeft)
  })
})
