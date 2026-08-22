/**
 * TwinStickEnemy — pure core.
 *
 * Owns the enemy's tuning (speed, point value, separation radius, contact
 * range/damage, target tag) plus the spawner id that owns it. The System
 * in `TwinStickEnemy.ts` reads these fields for chase, separation, contact damage,
 * and death-cleanup decisions.
 */

/**
 * Locomotion decision with hysteresis: 'attack' within contactRange, 'walk'
 * beyond contactRange * hysteresis, and HOLDS the current state in the dead-band
 * between (so an enemy hovering at the boundary doesn't flicker walk↔attack).
 */
export function decideLocomotion(
  distance: number,
  contactRange: number,
  current: 'walk' | 'attack',
  hysteresis: number,
): 'walk' | 'attack' {
  if (distance <= contactRange) return 'attack'
  if (distance > contactRange * hysteresis) return 'walk'
  return current
}

/**
 * Every clip that counts as a death animation — used to gate the animated-death
 * flow and to recognise a finished death clip. The union of the random and
 * directional lists (so configuring only directional clips still works).
 */
export function allDeathClips(
  deathClips: ReadonlyArray<string>,
  fallBackClips: ReadonlyArray<string>,
  fallForwardClips: ReadonlyArray<string>,
): string[] {
  if (fallBackClips.length === 0 && fallForwardClips.length === 0) return [...deathClips]
  return Array.from(new Set([...deathClips, ...fallBackClips, ...fallForwardClips]))
}

/**
 * Choose a death clip. `dot` is facing·shotDirection (the dot of the robot's
 * facing with the bullet's travel direction), or null when unknown:
 * - dot < 0  → shot landed in the FRONT (robot faces the shooter) → fall back
 * - dot >= 0 → shot landed in the BACK (robot faces away)         → fall forward
 *
 * Uses the matching directional list when it has entries; otherwise falls back
 * to a random pick over `deathClips`. `rand` is a value in [0, 1).
 */
export function chooseDeathClip(
  deathClips: ReadonlyArray<string>,
  fallBackClips: ReadonlyArray<string>,
  fallForwardClips: ReadonlyArray<string>,
  dot: number | null,
  rand: number,
): string | undefined {
  if (dot !== null) {
    const directional = dot < 0 ? fallBackClips : fallForwardClips
    if (directional.length > 0) return directional[Math.floor(rand * directional.length)]
  }
  const pool =
    deathClips.length > 0 ? deathClips : Array.from(new Set([...fallBackClips, ...fallForwardClips]))
  return pool.length > 0 ? pool[Math.floor(rand * pool.length)] : undefined
}

/**
 * Pick a wander heading biased away from the crowd. `awayX/awayZ` is
 * (self − crowd centroid); the heading is that direction rotated by `jitter`
 * radians so wanderers scatter instead of fleeing in a dead-straight line.
 * When the away-vector is ~zero (the robot sits at the centroid / is alone) it
 * falls back to `randomAngle`. Returns a unit [x, z] vector.
 */
export function wanderHeading(
  awayX: number,
  awayZ: number,
  jitter: number,
  randomAngle: number,
): [number, number] {
  const mag = Math.hypot(awayX, awayZ)
  const angle = mag < 1e-4 ? randomAngle : Math.atan2(awayZ, awayX) + jitter
  return [Math.cos(angle), Math.sin(angle)]
}

// The definitions live in TwinStickEnemy.defs.ts; re-exported so existing importers
// keep working. New code should import them from './TwinStickEnemy.defs' directly.
export { TwinStickEnemyComponent, type TwinStickEnemyInput } from './TwinStickEnemy.defs';
