/**
 * LineOfSight.ts — perception System (renderer-agnostic logic + optional debug
 * ray helpers).
 *
 * For each entity with a LineOfSightComponent it derives a facing from movement
 * (mirroring the visual yaw), then on a per-entity timer checks whether the
 * tagged target is within range + FOV cone and reachable past other bodies and
 * sight-blocking walls. On a visibility *change* it emits `lineofsight.acquired`
 * / `lineofsight.lost` — consumers (EnemySystem) react; this System never reads
 * another component. When debug rays are toggled on (`lineofsight.debugrays.set`)
 * it draws each entity's fanned sight rays, green where they reach the target,
 * red where blocked.
 */
import { System } from '@babylonjsmarket/ecs'
import type { Entity } from '@babylonjsmarket/ecs'
import type { LineHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { collectObstacleBoxes } from '../Obstacle/Obstacle'
import {
  LineOfSightComponent,
  LineOfSightEvents,
  LineOfSightInputEvents,
  hasLineOfSight,
  inSightCone,
  rayFanEndpoints,
  rayReaches,
} from './LineOfSight.core'
import type { Occluder } from './LineOfSight.core'

export {
  LineOfSightComponent,
  LineOfSightEvents,
  LineOfSightInputEvents,
  hasLineOfSight,
  inSightCone,
  rayFanEndpoints,
  rayReaches,
  type LineOfSightInput,
  type Occluder,
} from './LineOfSight.core'

const CLEAR_COLOR: Vec3 = [0.3, 1, 0.4]
const BLOCKED_COLOR: Vec3 = [1, 0.3, 0.3]
const DEGENERATE: Vec3[][] = [[[0, 0, 0], [0, 0, 0]]]

export class LineOfSightSystem extends System {
  protected query = { required: [LineOfSightComponent, MeshPrimitiveComponent], excludedTags: ['dying'] }
  // Per-entity facing derived from committed-position delta (= visual yaw).
  private facing = new Map<string, { x: number; z: number; px: number; pz: number }>()
  // Last emitted visibility per entity, so events fire only on a change.
  private visible = new Map<string, boolean>()
  // Per-entity countdown to the next sight check (staggered on first sight).
  private timer = new Map<string, number>()
  private occluders: Occluder[] = []
  // Debug ray helpers: two global line systems (reached vs blocked).
  private drawRays = false
  private clearLines?: LineHandle
  private blockedLines?: LineHandle

  protected onInitialize(): void {
    this.listen(LineOfSightInputEvents.SET_DEBUG_RAYS, (d: { enabled?: boolean }) => {
      this.drawRays = !!d.enabled
      if (!this.drawRays) this.disposeLines()
    })
  }

  protected onShutdown(): void {
    this.disposeLines()
    this.facing.clear()
    this.visible.clear()
    this.timer.clear()
  }

  protected onEntityAdded(entity: Entity): void {
    // Recycled pooled slot — start perception from scratch.
    this.facing.delete(entity.id)
    this.visible.delete(entity.id)
    this.timer.delete(entity.id)
  }

  protected onUpdate(dt: number): void {
    const w = this.world
    if (!w) return
    const r = w.renderer

    // Live seers — also the mutual occluders (bodies block each other's sight).
    const seers: Array<{ id: string; c: LineOfSightComponent; m: MeshPrimitiveComponent }> = []
    for (const e of this.entities) {
      const c = e.get(LineOfSightComponent)
      const m = e.get(MeshPrimitiveComponent)
      if (c && m?.handle) seers.push({ id: e.id, c, m })
    }
    if (seers.length === 0) {
      this.disposeLines()
      return
    }

    const sightBoxes = collectObstacleBoxes(w).filter((b) => b.blocksSight)
    // Targets are looked up per distinct tag (in practice one shared tag).
    const targetMesh = new Map<string, MeshPrimitiveComponent | undefined>()
    const targetIds = new Map<string, string | undefined>()
    const resolveTarget = (tag: string) => {
      if (!targetMesh.has(tag)) {
        const t = w.getEntitiesByTag(tag).find((e) => e.active)
        targetMesh.set(tag, t?.get(MeshPrimitiveComponent))
        targetIds.set(tag, t?.id)
      }
      return { mesh: targetMesh.get(tag), id: targetIds.get(tag) }
    }

    const clearSegs: Vec3[][] = []
    const blockedSegs: Vec3[][] = []

    for (const { id, c, m } of seers) {
      // Facing from movement delta (keeps last heading while stationary).
      let f = this.facing.get(id)
      if (!f) {
        f = { x: 0, z: 0, px: m.position[0], pz: m.position[2] }
        this.facing.set(id, f)
      }
      const mdx = m.position[0] - f.px
      const mdz = m.position[2] - f.pz
      const mlen = Math.hypot(mdx, mdz)
      if (mlen > 1e-3) {
        f.x = mdx / mlen
        f.z = mdz / mlen
      }
      f.px = m.position[0]
      f.pz = m.position[2]

      const { mesh: tMesh, id: tId } = resolveTarget(c.targetTag)

      // The other seers, as occluder circles (needed for the check and the rays).
      const needOccluders = this.drawRays
      let timer = (this.timer.get(id) ?? Math.random() * c.interval) - dt
      const doCheck = timer <= 0
      if (doCheck) timer = c.interval
      this.timer.set(id, timer)

      if (doCheck || needOccluders) {
        this.occluders.length = 0
        for (const o of seers) {
          if (o.id !== id) this.occluders.push({ x: o.m.position[0], z: o.m.position[2] })
        }
      }

      if (doCheck) {
        let see = false
        if (tMesh) {
          see = hasLineOfSight(
            m.position[0],
            m.position[2],
            f.x,
            f.z,
            tMesh.position[0],
            tMesh.position[2],
            this.occluders,
            c.rayCount,
            c.blockRadius,
            c.fov,
            c.range,
            sightBoxes,
          )
        }
        if (see !== this.visible.get(id)) {
          this.visible.set(id, see)
          this.eventBus.emit(see ? LineOfSightEvents.ACQUIRED : LineOfSightEvents.LOST, {
            entityId: id,
            targetId: tId,
          })
        }
      }

      // Debug rays: draw the fan, classifying each ray clear vs blocked. Out of
      // cone/range → every ray is "blocked" (the robot can't see).
      if (this.drawRays && tMesh) {
        const y = m.position[1]
        const cone = inSightCone(m.position[0], m.position[2], f.x, f.z, tMesh.position[0], tMesh.position[2], c.fov, c.range)
        const ends = rayFanEndpoints(m.position[0], m.position[2], tMesh.position[0], tMesh.position[2], c.rayCount, c.blockRadius)
        for (const [ex, ez] of ends) {
          const reaches = cone && rayReaches(m.position[0], m.position[2], ex, ez, this.occluders, c.blockRadius, sightBoxes)
          const seg: Vec3[] = [[m.position[0], y, m.position[2]], [ex, y, ez]]
          ;(reaches ? clearSegs : blockedSegs).push(seg)
        }
      }
    }

    if (this.drawRays && r) {
      this.ensureLines()
      if (this.clearLines) {
        r.updateLineSystem(this.clearLines, clearSegs.length ? clearSegs : DEGENERATE, CLEAR_COLOR)
        r.setLineSystemVisible(this.clearLines, clearSegs.length > 0)
      }
      if (this.blockedLines) {
        r.updateLineSystem(this.blockedLines, blockedSegs.length ? blockedSegs : DEGENERATE, BLOCKED_COLOR)
        r.setLineSystemVisible(this.blockedLines, blockedSegs.length > 0)
      }
    }
  }

  private ensureLines(): void {
    const r = this.world?.renderer
    if (!r) return
    if (!this.clearLines) this.clearLines = r.createLineSystem('los-clear', DEGENERATE, CLEAR_COLOR)
    if (!this.blockedLines) this.blockedLines = r.createLineSystem('los-blocked', DEGENERATE, BLOCKED_COLOR)
  }

  private disposeLines(): void {
    const r = this.world?.renderer
    if (this.clearLines && r) r.disposeLineSystem(this.clearLines)
    if (this.blockedLines && r) r.disposeLineSystem(this.blockedLines)
    this.clearLines = undefined
    this.blockedLines = undefined
  }
}
