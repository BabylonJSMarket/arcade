import { describe, it, expect } from 'vitest'
import { LineOfSightComponent } from './LineOfSight.defs';
import { hasLineOfSight, inSightCone, rayReaches, rayFanEndpoints } from './LineOfSight.core';

describe('LineOfSightComponent', () => {
  it('applies defaults', () => {
    const c = new LineOfSightComponent()
    expect(c.targetTag).toBe('player')
    expect(c.fov).toBe(220)
    expect(c.range).toBe(32)
    expect(c.rayCount).toBe(3)
    expect(c.blockRadius).toBe(0.6)
    expect(c.interval).toBe(1.5)
  })

  it('serialize round-trips', () => {
    const a = new LineOfSightComponent({ targetTag: 'hero', fov: 90, range: 12, rayCount: 1, blockRadius: 1, interval: 0.5 })
    const b = new LineOfSightComponent(a.serialize())
    expect(b.targetTag).toBe('hero')
    expect(b.fov).toBe(90)
    expect(b.range).toBe(12)
    expect(b.rayCount).toBe(1)
    expect(b.blockRadius).toBe(1)
    expect(b.interval).toBe(0.5)
  })
})

describe('inSightCone', () => {
  // Viewer at origin facing +X.
  it('sees a target dead ahead', () => {
    expect(inSightCone(0, 0, 1, 0, 10, 0, 220, 100)).toBe(true)
  })

  it('does not see a target behind it (outside the cone)', () => {
    expect(inSightCone(0, 0, 1, 0, -10, 0, 220, 100)).toBe(false)
  })

  it('does not see a target beyond range', () => {
    expect(inSightCone(0, 0, 1, 0, 50, 0, 220, 30)).toBe(false)
  })

  it('is omnidirectional when facing is unknown (zero vector)', () => {
    expect(inSightCone(0, 0, 0, 0, -10, 0, 90, 100)).toBe(true)
  })

  it('is omnidirectional at fov >= 360', () => {
    expect(inSightCone(0, 0, 1, 0, -10, 0, 360, 100)).toBe(true)
  })

  it('respects a narrow cone', () => {
    // 40° cone (half 20°): a target ~45° off-axis is outside.
    expect(inSightCone(0, 0, 1, 0, 10, 10, 40, 100)).toBe(false)
    expect(inSightCone(0, 0, 1, 0, 10, 0, 40, 100)).toBe(true)
  })

  it('always sees a target essentially at the viewer', () => {
    // dist < 1e-4 short-circuits, even with a narrow cone facing away.
    expect(inSightCone(0, 0, 1, 0, 0, 0, 40, 100)).toBe(true)
  })
})

describe('rayFanEndpoints', () => {
  it('returns one centre endpoint for a single ray', () => {
    const ends = rayFanEndpoints(0, 0, 10, 0, 1, 0.6)
    expect(ends).toHaveLength(1)
    expect(ends[0]![0]).toBeCloseTo(10, 5)
    expect(ends[0]![1]).toBeCloseTo(0, 5)
  })

  it('fans rayCount endpoints across the target width', () => {
    const ends = rayFanEndpoints(0, 0, 10, 0, 3, 0.6)
    expect(ends).toHaveLength(3)
    // Perpendicular to +X sightline is ±Z; spread spans [-0.6, +0.6].
    expect(ends[0]![1]).toBeCloseTo(-0.6, 5)
    expect(ends[2]![1]).toBeCloseTo(0.6, 5)
  })

  it('returns a single endpoint at the from point when the target coincides', () => {
    // dist < 1e-4 short-circuits to one endpoint (no perpendicular axis).
    const ends = rayFanEndpoints(0, 0, 0, 0, 3, 0.6)
    expect(ends).toEqual([[0, 0]])
  })
})

describe('rayReaches', () => {
  it('reaches with no occluders', () => {
    expect(rayReaches(0, 0, 10, 0, [], 0.6)).toBe(true)
  })

  it('is blocked by an occluder on the line', () => {
    expect(rayReaches(0, 0, 10, 0, [{ x: 5, z: 0 }], 0.6)).toBe(false)
  })

  it('passes an occluder off to the side', () => {
    expect(rayReaches(0, 0, 10, 0, [{ x: 5, z: 3 }], 0.6)).toBe(true)
  })

  it('is blocked by a wall box across the line', () => {
    expect(rayReaches(0, 0, 10, 0, [], 0.6, [{ minX: 4, maxX: 6, minZ: -2, maxZ: 2 }])).toBe(false)
  })

  it('handles a degenerate zero-length segment (from == to)', () => {
    // segLen2 < 1e-8 → t = 0; occluder at the point is within radius → blocked.
    expect(rayReaches(0, 0, 0, 0, [{ x: 0, z: 0 }], 0.6)).toBe(false)
  })

  it('clamps the projection to the segment start when the occluder is behind A', () => {
    // Occluder just behind A: projection t < 0, clamped to 0, within radius → blocked.
    expect(rayReaches(0, 0, 10, 0, [{ x: -0.1, z: 0 }], 0.6)).toBe(false)
  })

  it('clamps the projection to the segment end when the occluder is beyond B', () => {
    // Occluder just past B: projection t > 1, clamped to 1, within radius → blocked.
    expect(rayReaches(0, 0, 10, 0, [{ x: 10.1, z: 0 }], 0.6)).toBe(false)
  })
})

describe('hasLineOfSight', () => {
  // Viewer at origin facing +X toward a target at (10,0); wide cone + range so
  // these isolate occlusion unless stated.
  const los = (occluders: { x: number; z: number }[], rays = 3, boxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = []) =>
    hasLineOfSight(0, 0, 1, 0, 10, 0, occluders, rays, 0.6, 360, 100, boxes)

  it('is clear with no occluders', () => {
    expect(los([])).toBe(true)
  })

  it('is blocked by a robot on the sightline', () => {
    expect(los([{ x: 5, z: 0 }])).toBe(false)
  })

  it('peeks past a blocker edge with the fan but not a single ray', () => {
    const grazing = [{ x: 5, z: 0.45 }]
    expect(los(grazing, 3)).toBe(true)
    expect(los(grazing, 1)).toBe(false)
  })

  it('is blocked by a full-height wall across the sightline', () => {
    expect(los([], 3, [{ minX: 4, maxX: 6, minZ: -2, maxZ: 2 }])).toBe(false)
  })

  it('fails when the target is outside the FOV cone', () => {
    // Facing +X but target behind, with a real (non-360) cone.
    expect(hasLineOfSight(0, 0, 1, 0, -10, 0, [], 3, 0.6, 220, 100)).toBe(false)
  })

  it('fails when the target is beyond range', () => {
    expect(hasLineOfSight(0, 0, 1, 0, 50, 0, [], 3, 0.6, 360, 30)).toBe(false)
  })
})
