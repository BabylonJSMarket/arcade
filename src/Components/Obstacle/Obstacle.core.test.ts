import { describe, it, expect } from 'vitest'
import {
  ObstacleComponent,
  resolveCircleVsBox,
  segmentIntersectsBox,
  type BoxBounds,
} from './Obstacle.core'

const box: BoxBounds = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }

describe('ObstacleComponent', () => {
  it('defaults to a solid full obstacle', () => {
    const c = new ObstacleComponent()
    expect(c.halfWidth).toBe(1)
    expect(c.halfDepth).toBe(1)
    expect(c.blocksSight).toBe(true)
    expect(c.blocksBullets).toBe(true)
  })

  it('serialize round-trips', () => {
    const a = new ObstacleComponent({ halfWidth: 2, halfDepth: 0.5, blocksSight: false, blocksBullets: false })
    const b = new ObstacleComponent(a.serialize())
    expect(b.halfWidth).toBe(2)
    expect(b.halfDepth).toBe(0.5)
    expect(b.blocksSight).toBe(false)
    expect(b.blocksBullets).toBe(false)
  })
})

describe('resolveCircleVsBox', () => {
  it('leaves a circle that is clear of the box untouched', () => {
    expect(resolveCircleVsBox(5, 0, 0.5, box)).toEqual([5, 0])
  })

  it('pushes a circle clipping the +X face straight out', () => {
    // Centre at x=1.3 (just outside the +X face at 1), radius 0.5 → overlaps by
    // 0.2; should be pushed to x = 1.5 (face + radius).
    const [x, z] = resolveCircleVsBox(1.3, 0, 0.5, box)
    expect(x).toBeCloseTo(1.5, 5)
    expect(z).toBeCloseTo(0, 5)
  })

  it('ejects a circle whose centre is inside through the nearest face', () => {
    // Centre near the +X face from inside → ejected out the +X side.
    const [x, z] = resolveCircleVsBox(0.8, 0, 0.5, box)
    expect(x).toBeCloseTo(1.5, 5)
    expect(z).toBeCloseTo(0, 5)
  })
})

describe('segmentIntersectsBox', () => {
  it('detects a segment passing through the box', () => {
    expect(segmentIntersectsBox(-3, 0, 3, 0, box)).toBe(true)
  })

  it('is false for a segment that misses the box', () => {
    expect(segmentIntersectsBox(-3, 3, 3, 3, box)).toBe(false)
  })

  it('is true when an endpoint is inside the box', () => {
    expect(segmentIntersectsBox(0, 0, 5, 5, box)).toBe(true)
  })

  it('is false for a segment that stops short of the box', () => {
    expect(segmentIntersectsBox(-3, 0, -2, 0, box)).toBe(false)
  })
})
