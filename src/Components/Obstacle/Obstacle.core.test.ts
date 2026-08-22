import { describe, it, expect } from 'vitest'
import { ObstacleComponent, type BoxBounds } from './Obstacle.defs';
import { resolveCircleVsBox, segmentIntersectsBox } from './Obstacle.core';

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

  it('pushes a circle clipping the -X/-Z corner straight out along the contact normal', () => {
    // Centre below minX AND below minZ → exercises the first arm of both
    // closest-point clamps (nx = minX, nz = minZ).
    const [x, z] = resolveCircleVsBox(-1.2, -1.2, 0.5, box)
    // Corner at (-1,-1); centre is dist sqrt(0.08)≈0.283 < 0.5 → pushed out.
    expect(x).toBeLessThan(-1.2)
    expect(z).toBeLessThan(-1.2)
  })

  it('pushes a circle clipping the +Z face straight out', () => {
    // Centre above maxZ (cz > box.maxZ) but within the X span → closest point
    // is on the +Z face; pushed out to z = maxZ + (r - overlap).
    const [x, z] = resolveCircleVsBox(0, 1.3, 0.5, box)
    expect(x).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(1.5, 5)
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

  it('ejects a centre nearest the -X face out the -X side', () => {
    // Centre at x=-0.8 inside → nearest face is -X → pushed to minX - r = -1.5.
    const [x, z] = resolveCircleVsBox(-0.8, 0, 0.5, box)
    expect(x).toBeCloseTo(-1.5, 5)
    expect(z).toBeCloseTo(0, 5)
  })

  it('ejects a centre nearest the +Z face out the +Z side', () => {
    // Centre at z=0.8 inside → nearestZ < nearestX → ejected along Z (maxZ + r).
    const [x, z] = resolveCircleVsBox(0, 0.8, 0.5, box)
    expect(x).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(1.5, 5)
  })

  it('ejects a centre nearest the -Z face out the -Z side', () => {
    // Centre at z=-0.8 inside → ejected along -Z (minZ - r).
    const [x, z] = resolveCircleVsBox(0, -0.8, 0.5, box)
    expect(x).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(-1.5, 5)
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

  it('detects a diagonal segment crossing the box (exercises both slab arms)', () => {
    // Non-zero dx AND dz, so all four slab clips do real work (p<0 and p>0).
    expect(segmentIntersectsBox(-3, -3, 3, 3, box)).toBe(true)
  })

  it('is false for a vertical segment to one side of the box', () => {
    // dx = 0 (parallel to the X slabs); the Z slabs (lines 130-131) clip it.
    // x = 3 is entirely past maxX, so the X-slab parallel test rejects it.
    expect(segmentIntersectsBox(3, -3, 3, 3, box)).toBe(false)
  })

  it('detects a vertical segment passing straight down through the box', () => {
    // dx = 0 inside the X span (parallel-but-inside: line 118 q>=0), Z slabs cross.
    expect(segmentIntersectsBox(0, -3, 0, 3, box)).toBe(true)
  })

  it('is false for a horizontal segment above the box (parallel Z slab, outside)', () => {
    // dz = 0 with z = 3 outside the Z span → parallel-and-outside rejects it.
    expect(segmentIntersectsBox(-3, 3, 3, 3, box)).toBe(false)
  })

  it('detects a segment entering from the +X/+Z corner (both slabs tighten t1)', () => {
    // Travels from outside (+X,+Z) into the box, so the maxX and maxZ slabs
    // (p>0) each tighten t1; an endpoint inside guarantees a hit.
    expect(segmentIntersectsBox(3, 3, 0, 0, box)).toBe(true)
  })

  it('detects a segment entering through the +Z face heading -Z', () => {
    // dz < 0 with the start above the box: the +Z slab clip arm tightens the
    // range; the segment passes straight down through the box.
    expect(segmentIntersectsBox(0, 3, 0, -3, box)).toBe(true)
  })

  it('is false for a sloped segment whose X-slab exit precedes its entry (p>0 miss)', () => {
    // The +X slab candidate t falls below the already-tightened entry t0, so the
    // p>0 arm bails (`if (t < t0) return false`).
    expect(segmentIntersectsBox(3, 2, 5, -2, box)).toBe(false)
  })

  it('is false for a segment skimming entirely below the box (-Z slab rejects)', () => {
    // Spans the X range but stays below minZ; the -Z slab clip call returns false.
    expect(segmentIntersectsBox(-3, -2, 3, -3, box)).toBe(false)
  })
})
