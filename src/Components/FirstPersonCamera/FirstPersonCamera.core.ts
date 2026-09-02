/**
 * FirstPersonCamera — pure core.
 *
 * Two things the walking camera needs that have nothing to do with a
 * renderer or a world: the collision sweep that turns "I want to step there"
 * into "here is where you actually end up", and the little codec that
 * remembers the pose between visits. Plain numbers in, plain numbers out, so
 * both are unit-tested with a handful of boxes and no engine at all.
 */

import type { BoxBounds } from '../Obstacle/Obstacle.defs';
import { resolveCircleVsBox } from '../Obstacle/Obstacle.core';

/** A floor-plane point, `[x, z]`. */
export type WalkPoint = readonly [number, number];

/**
 * Contact tolerance. A player the sweep has parked exactly one radius off a
 * face sits at `face - r`, and `face - (face - r)` is not quite `r` in
 * floating point. Without a little give, next frame that reads as a sliver
 * of overlap: the box is taken for one the player is "inside", and the
 * never-deeper rule pins them to the wall instead of letting them slide.
 */
const EPS = 1e-9;

/**
 * Sweep a circle of `radius` from `from` toward `to` through `boxes` and
 * return where it ends up.
 *
 * The step is walked in substeps no longer than half a radius, and after
 * each one the circle is pushed back out of anything it overlaps along the
 * contact normal (`resolveCircleVsBox` from Obstacle.core, reused as-is).
 * That push removes only the part of the motion that points INTO the box and
 * keeps the rest, which is what makes a wall feel like a wall rather than
 * glue: walking diagonally into a cabinet, the player slides along its front
 * instead of stopping dead, and at a corner the normal is the corner's own,
 * so the circle rounds it rather than catching on it.
 *
 * The substep is what makes this a SWEEP and not a check of where the step
 * lands. From a clear spot the centre sits at least a radius from every box
 * surface, so a move of half a radius can never carry it inside one; every
 * push is therefore a push out from a surface — never `resolveCircleVsBox`'s
 * centre-inside branch, which ejects through the nearest face and would send
 * a hitched-frame step (a tab switch, 3 m in one go) out the far side of a
 * 20 cm wall. The same reasoning is why it cannot pass clean through a box.
 *
 * A box the circle already overlaps at `from` — a pose restored into a
 * freshly placed prop, a spawn point inside a wall — is handled apart: it
 * never displaces the player (no teleport out the far side), it only refuses
 * any step that would push DEEPER into it. Backing out is always allowed.
 *
 * Why not the classic two-axis resolve (X then Z, each stopped at the face
 * it hits)? It is the right tool for a BOX-shaped player and the wrong one
 * for a circle: pressed diagonally into a cabinet corner, an exact circle is
 * refused on X (that alone would clip the corner) and refused on Z (likewise),
 * one axis at a time, and wedges on the edge instead of rounding it — the
 * auto-walk stalled there in testing. The normal push has no such seam; on a
 * flat face the two are the same motion.
 */
export function resolveWalk(
  from: WalkPoint,
  to: WalkPoint,
  radius: number,
  boxes: readonly BoxBounds[],
): [number, number] {
  const clear: BoxBounds[] = [];
  const inside: BoxBounds[] = [];
  for (const box of boxes) {
    (circleOverlapsBox(from[0], from[1], radius, box) ? inside : clear).push(box);
  }

  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius / 2)));
  // Each substep is a lerp from `from` plus everything the boxes have pushed
  // so far (rather than a running sum of increments), so a walk nothing
  // touched lands on `to` to the bit and a slide keeps its sideways part
  // exactly.
  let ox = 0;
  let oz = 0;
  for (let i = 1; i <= steps; i++) {
    const last = i === steps;
    const px = (last ? to[0] : from[0] + dx * (i / steps)) + ox;
    const pz = (last ? to[1] : from[1] + dz * (i / steps)) + oz;
    const [nx, nz] = settle(px, pz, radius, clear);
    ox += nx - px;
    oz += nz - pz;
  }
  let x = to[0] + ox;
  let z = to[1] + oz;

  // Already inside something: never pushed, never allowed deeper.
  for (const box of inside) {
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    if (Math.abs(x - cx) < Math.abs(from[0] - cx)) x = from[0];
    if (Math.abs(z - cz) < Math.abs(from[1] - cz)) z = from[1];
  }
  return [x, z];
}

/**
 * True when a circle of `r` at (x, z) overlaps `box`. Touching counts as
 * clear, to within {@link EPS} — the circle the sweep parked against a face
 * last frame must not read as "inside" this frame.
 */
export function circleOverlapsBox(x: number, z: number, r: number, box: BoxBounds): boolean {
  const nx = x < box.minX ? box.minX : x > box.maxX ? box.maxX : x;
  const nz = z < box.minZ ? box.minZ : z > box.maxZ ? box.maxZ : z;
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < r * r - EPS;
}

/**
 * Push the circle out of every box it overlaps until nothing moves it.
 * Leaving one box can land it in a neighbour (two cabinets closer together
 * than the player is wide), hence the passes; the cap is belt and braces.
 * A push smaller than {@link EPS} is rounding, not contact, and is ignored.
 */
function settle(x: number, z: number, r: number, boxes: readonly BoxBounds[]): [number, number] {
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const box of boxes) {
      const [nx, nz] = resolveCircleVsBox(x, z, r, box);
      if (Math.abs(nx - x) > EPS || Math.abs(nz - z) > EPS) {
        x = nx;
        z = nz;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, z];
}

// ── Pose persistence ─────────────────────────────────────────────────────────

/** What a visit leaves behind: where you stood and which way you looked. */
export interface PersistedPose {
  x: number;
  z: number;
  yaw: number;
}

/** The slice of `localStorage` the codec needs — anything with these two works. */
export interface PoseStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read a remembered pose. Anything that isn't three finite numbers under the
 * key — nothing stored yet, a hand-edited value, a store that throws (some
 * embedded and private-browsing contexts do) — reads as `null`, never as an
 * exception.
 */
export function readPose(store: PoseStore | null | undefined, key: string): PersistedPose | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPose> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const { x, z, yaw } = parsed;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw)) return null;
    return { x: x as number, z: z as number, yaw: yaw as number };
  } catch {
    return null;
  }
}

/** Remember a pose. Returns false, rather than throwing, when the store refuses. */
export function writePose(store: PoseStore | null | undefined, key: string, pose: PersistedPose): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify({ x: pose.x, z: pose.z, yaw: pose.yaw }));
    return true;
  } catch {
    return false;
  }
}
