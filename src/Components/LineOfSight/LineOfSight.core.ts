/**
 * LineOfSight — pure core.
 *
 * A reusable perception component: "can this entity see a tagged target?" It's a
 * vision CONE (field of view) plus a ranged ray-cast that other bodies and
 * sight-blocking walls can occlude. The System in `LineOfSight.ts` runs the
 * check on a timer and emits `lineofsight.acquired` / `lineofsight.lost` — any
 * system (e.g. TwinStickEnemySystem) reacts to those events; LineOfSight itself knows
 * nothing about enemies, so it can be dropped on a turret, a guard, anything.
 *
 * All geometry here is pure (XZ plane) so it's unit-testable without a renderer.
 * `hasLineOfSight` = inside the cone AND in range AND at least one ray reaches
 * the target unobstructed; the cone/ray helpers are exported so the System can
 * draw matching debug rays.
 */

import { type BoxBounds } from '../Obstacle/Obstacle.defs';
import { segmentIntersectsBox } from '../Obstacle/Obstacle.core';
import { type Occluder } from './LineOfSight.defs';

/**
 * Is the target within range AND inside the viewer's FOV cone (measured from
 * `facing`)? When `facing` is ~zero (unknown orientation) or `fov >= 360`, the
 * cone test is skipped (omnidirectional). Range 0 = unbounded.
 */
export function inSightCone(
  fromX: number,
  fromZ: number,
  facingX: number,
  facingZ: number,
  targetX: number,
  targetZ: number,
  fov: number,
  range: number,
): boolean {
  const dx = targetX - fromX
  const dz = targetZ - fromZ
  const dist = Math.hypot(dx, dz)
  if (dist < 1e-4) return true
  if (range > 0 && dist > range) return false
  const fmag = Math.hypot(facingX, facingZ)
  if (fmag < 1e-4 || fov >= 360) return true
  // cos of the half-angle vs the normalized facing·toTarget dot.
  const cosHalf = Math.cos(((fov * Math.PI) / 180) / 2)
  const dot = (facingX * dx + facingZ * dz) / (fmag * dist)
  return dot >= cosHalf
}

/** The fanned ray endpoints across the target's width (±`halfWidth` ⟂ the sightline). */
export function rayFanEndpoints(
  fromX: number,
  fromZ: number,
  targetX: number,
  targetZ: number,
  rayCount: number,
  halfWidth: number,
): Array<[number, number]> {
  const dx = targetX - fromX
  const dz = targetZ - fromZ
  const dist = Math.hypot(dx, dz)
  const n = Math.max(1, Math.floor(rayCount))
  if (dist < 1e-4) return [[targetX, targetZ]]
  const px = -dz / dist
  const pz = dx / dist
  const out: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
    out.push([targetX + px * t * halfWidth, targetZ + pz * t * halfWidth])
  }
  return out
}

/** Does the ray from (ax,az)→(bx,bz) reach the end without passing within
 * `blockRadius` of an occluder or crossing a sight-blocking box? */
export function rayReaches(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  occluders: ReadonlyArray<Occluder>,
  blockRadius: number,
  boxes: ReadonlyArray<BoxBounds> = [],
): boolean {
  if (segmentBlocked(ax, az, bx, bz, occluders, blockRadius)) return false
  for (const box of boxes) {
    if (segmentIntersectsBox(ax, az, bx, bz, box)) return false
  }
  return true
}

/**
 * Full line-of-sight predicate: in range, inside the FOV cone, and at least one
 * fanned ray reaches the target past the occluders and sight-blocking boxes.
 */
export function hasLineOfSight(
  fromX: number,
  fromZ: number,
  facingX: number,
  facingZ: number,
  targetX: number,
  targetZ: number,
  occluders: ReadonlyArray<Occluder>,
  rayCount: number,
  blockRadius: number,
  fov: number,
  range: number,
  boxes: ReadonlyArray<BoxBounds> = [],
): boolean {
  if (!inSightCone(fromX, fromZ, facingX, facingZ, targetX, targetZ, fov, range)) return false
  const ends = rayFanEndpoints(fromX, fromZ, targetX, targetZ, rayCount, blockRadius)
  for (const [ex, ez] of ends) {
    if (rayReaches(fromX, fromZ, ex, ez, occluders, blockRadius, boxes)) return true
  }
  return false
}

/** True if any occluder circle (radius `blockRadius`) overlaps segment A→B. */
function segmentBlocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  occluders: ReadonlyArray<Occluder>,
  blockRadius: number,
): boolean {
  const sx = bx - ax
  const sz = bz - az
  const segLen2 = sx * sx + sz * sz
  const r2 = blockRadius * blockRadius
  for (const o of occluders) {
    let t = segLen2 < 1e-8 ? 0 : ((o.x - ax) * sx + (o.z - az) * sz) / segLen2
    if (t < 0) t = 0
    else if (t > 1) t = 1
    const ddx = o.x - (ax + sx * t)
    const ddz = o.z - (az + sz * t)
    if (ddx * ddx + ddz * ddz < r2) return true
  }
  return false
}

// The definitions live in LineOfSight.defs.ts; re-exported so existing importers
// keep working. New code should import them from './LineOfSight.defs' directly.
export { LineOfSightComponent, type LineOfSightInput, type Occluder } from './LineOfSight.defs';
