/* eslint-disable babylonjsmarket/require-contract-test --
 * Obstacle has no System (it's static collision data + world-query helpers
 * consumed by other systems), so there's no mechanic to run runMechanicContract
 * against. The component + math are covered by Obstacle.core.test.ts. The rule
 * matches Components/{Name}/{Name}.ts purely by filename, so disable it here. */
/**
 * Obstacle.ts — world-side helper for the Obstacle component.
 *
 * Obstacles have no per-frame System of their own: they're static boxes
 * created by ObstacleFieldSystem and read by the gameplay systems (Enemy,
 * Bullet, TwinStickShooter, FirstPersonCamera). This module re-exports the
 * pure core and provides the one impure bit — scanning the World for live
 * obstacle footprints.
 */
import type { Entity, World } from '@babylonjsmarket/ecs'
import { MeshComponent } from '../Mesh/Mesh.defs';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { ObstacleComponent } from './Obstacle.defs';

export { ObstacleComponent, type ObstacleInput, type BoxBounds } from './Obstacle.defs';
export { resolveCircleVsBox, segmentIntersectsBox } from './Obstacle.core';

/** A collected obstacle footprint plus its collision flags. */
export interface ObstacleBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  blocksSight: boolean
  blocksBullets: boolean
}

/**
 * Where an obstacle's footprint is centred, in XZ.
 *
 * An explicit `center` wins outright. Without one the footprint follows the
 * entity's visible body: the sibling MeshPrimitive (a box wall) first, then
 * the sibling Mesh (a GLB cabinet or prop). An entity with none of the three
 * has nowhere to be, and is skipped.
 */
function obstacleCenter(entity: Entity, o: ObstacleComponent): [number, number] | null {
  if (o.center) return [o.center[0], o.center[1]]
  const prim = entity.get(MeshPrimitiveComponent)
  if (prim) return [prim.position[0], prim.position[2]]
  const mesh = entity.get(MeshComponent)
  if (mesh) return [mesh.params.position[0], mesh.params.position[2]]
  return null
}

/**
 * Snapshot the live obstacle boxes (XZ footprint from each obstacle's centre
 * and half-extents). Cheap — a scene has a few dozen obstacles at most — so
 * callers rebuild this each frame rather than caching.
 */
export function collectObstacleBoxes(world: World): ObstacleBox[] {
  const boxes: ObstacleBox[] = []
  for (const e of world.getEntitiesWithComponent(ObstacleComponent)) {
    if (!e.active) continue
    const o = e.get(ObstacleComponent)
    if (!o) continue
    const c = obstacleCenter(e, o)
    if (!c) continue
    boxes.push({
      minX: c[0] - o.halfWidth,
      maxX: c[0] + o.halfWidth,
      minZ: c[1] - o.halfDepth,
      maxZ: c[1] + o.halfDepth,
      blocksSight: o.blocksSight,
      blocksBullets: o.blocksBullets,
    })
  }
  return boxes
}
