/**
 * Obstacle — pure core.
 *
 * A solid, axis-aligned box barrier on the play field. Its XZ footprint
 * (`halfWidth`/`halfDepth`) comes from the sibling MeshPrimitive's box; this
 * component carries the *collision semantics*:
 *
 * - Movement is ALWAYS blocked — neither robots nor the player pass through.
 * - `blocksBullets` — full-height walls stop bullets; low cover lets them through.
 * - `blocksSight` — full-height walls break line of sight; low cover doesn't.
 *
 * Consumed by TwinStickEnemySystem (movement + LOS), BulletSystem (bullet stops), and
 * TwinStickShooterSystem (player movement). The collision math below is pure so
 * it's unit-testable without a renderer.
 */

import { type BoxBounds } from './Obstacle.defs';

/**
 * Push a circle (centre cx,cz, radius r) out of an AABB so it no longer
 * overlaps, choosing the least-penetration axis. Returns the corrected [x, z]
 * (unchanged if the circle is already clear of the box).
 */
export function resolveCircleVsBox(
  cx: number,
  cz: number,
  r: number,
  box: BoxBounds,
): [number, number] {
  // Closest point on the box to the circle centre.
  const nx = cx < box.minX ? box.minX : cx > box.maxX ? box.maxX : cx
  const nz = cz < box.minZ ? box.minZ : cz > box.maxZ ? box.maxZ : cz
  const dx = cx - nx
  const dz = cz - nz
  const d2 = dx * dx + dz * dz
  if (d2 > r * r) return [cx, cz] // not touching

  if (d2 > 1e-8) {
    // Centre is outside the box but the circle clips an edge/corner — push
    // straight out along the contact normal.
    const d = Math.sqrt(d2)
    const push = r - d
    return [cx + (dx / d) * push, cz + (dz / d) * push]
  }

  // Centre is inside the box — eject through the nearest face.
  const toMinX = cx - box.minX
  const toMaxX = box.maxX - cx
  const toMinZ = cz - box.minZ
  const toMaxZ = box.maxZ - cz
  const nearestX = Math.min(toMinX, toMaxX)
  const nearestZ = Math.min(toMinZ, toMaxZ)
  if (nearestX < nearestZ) {
    return [toMinX < toMaxX ? box.minX - r : box.maxX + r, cz]
  }
  return [cx, toMinZ < toMaxZ ? box.minZ - r : box.maxZ + r]
}

/**
 * Does segment A→B (XZ) intersect the AABB? True if it crosses or either
 * endpoint is inside. Liang–Barsky slab clipping.
 */
export function segmentIntersectsBox(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  box: BoxBounds,
): boolean {
  const dx = bx - ax
  const dz = bz - az
  let t0 = 0
  let t1 = 1
  // Clip the parameter range [t0,t1] against one slab boundary. Returns false
  // if the segment falls entirely outside it.
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0 // parallel to this slab — inside iff q >= 0
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
    return true
  }
  if (!clip(-dx, ax - box.minX)) return false
  if (!clip(dx, box.maxX - ax)) return false
  if (!clip(-dz, az - box.minZ)) return false
  if (!clip(dz, box.maxZ - az)) return false
  return t0 <= t1
}

// The definitions live in Obstacle.defs.ts; re-exported so existing importers
// keep working. New code should import them from './Obstacle.defs' directly.
export { type BoxBounds, ObstacleComponent, type ObstacleInput } from './Obstacle.defs';
