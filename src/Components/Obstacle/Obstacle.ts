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
 * Bullet, TwinStickShooter). This module re-exports the pure core and provides
 * the one impure bit — scanning the World for live obstacle footprints.
 */
import type { World } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { ObstacleComponent } from './Obstacle.core'

export {
  ObstacleComponent,
  resolveCircleVsBox,
  segmentIntersectsBox,
  type ObstacleInput,
  type BoxBounds,
} from './Obstacle.core'

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
 * Snapshot the live obstacle boxes (XZ footprint from each obstacle's sibling
 * MeshPrimitive). Cheap — a scene has only a handful of obstacles — so callers
 * rebuild this each frame rather than caching.
 */
export function collectObstacleBoxes(world: World): ObstacleBox[] {
  const boxes: ObstacleBox[] = []
  for (const e of world.getEntitiesWithComponent(ObstacleComponent)) {
    if (!e.active) continue
    const o = e.get(ObstacleComponent)
    const m = e.get(MeshPrimitiveComponent)
    if (!o || !m) continue
    boxes.push({
      minX: m.position[0] - o.halfWidth,
      maxX: m.position[0] + o.halfWidth,
      minZ: m.position[2] - o.halfDepth,
      maxZ: m.position[2] + o.halfDepth,
      blocksSight: o.blocksSight,
      blocksBullets: o.blocksBullets,
    })
  }
  return boxes
}
