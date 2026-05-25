/**
 * HealthBar — 3D billboarded bar that hovers over any entity with Health.
 *
 * Attach `HealthBar: { ... }` to an entity that already has Health +
 * MeshPrimitive. The system creates two thin box meshes — a darker
 * background and a colored fill — and positions them above the parent
 * mesh each frame. Both are billboarded (mesh.billboardMode = ALL) so
 * the bar always faces the active camera. Fill X-scale tracks hp/maxHp;
 * at full HP the whole bar hides (configurable).
 *
 * Renderer coupling: we ask the adapter to billboard the bar meshes via
 * `setMeshBillboardMode(handle, 'all')`. Each adapter maps that to its own
 * primitive (Babylon's `mesh.billboardMode`, a Three Sprite or
 * lookAt-camera shim, etc.).
 *
 * Runtime state — the two `MeshHandle`s and the `initialized` one-shot
 * flag live in a per-Component WeakMap on the System so the Component
 * stays a pure data class.
 */
import { System } from '@babylonjsmarket/ecs'
import type { EventBus, Entity } from '@babylonjsmarket/ecs'
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { HealthComponent } from '../Health/Health'
import { HealthBarComponent } from './HealthBar.core'

interface HealthBarRuntime {
  bgHandle?: MeshHandle
  fillHandle?: MeshHandle
  initialized: boolean
}

export class HealthBarSystem extends System {
  protected query = { required: [HealthBarComponent, HealthComponent, MeshPrimitiveComponent] }
  private runtime = new WeakMap<HealthBarComponent, HealthBarRuntime>()

  constructor(eventBus: EventBus) {
    super(eventBus)
  }

  private getRuntime(c: HealthBarComponent): HealthBarRuntime {
    let r = this.runtime.get(c)
    if (!r) {
      r = { initialized: false }
      this.runtime.set(c, r)
    }
    return r
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureBars(entity)
    // Re-show on re-acquire (a parked bar was hidden via visibility below).
    // layout() then scales it for the current HP. Harmless on first build.
    const bar = entity.get(HealthBarComponent)
    const rt = bar && this.runtime.get(bar)
    const r = this.world?.renderer
    if (rt && r) {
      if (rt.bgHandle) r.setMeshVisible(rt.bgHandle, true)
      if (rt.fillHandle) r.setMeshVisible(rt.fillHandle, true)
    }
  }

  protected onEntityRemoved(entity: Entity): void {
    const bar = entity.get(HealthBarComponent)
    if (!bar) return
    const rt = this.runtime.get(bar)
    if (!rt) return
    const r = this.world?.renderer
    // Parked (pooled, removed from play) — keep the bar meshes for reuse, just
    // hide them. Hide via VISIBILITY, not scale: layout() owns `setMeshScale`,
    // and a kill parks the enemy *inside* another system's update (the bullet's),
    // so a scale write here would collide with layout()'s on the same handle in
    // one frame (an adapter race). Different method = no race.
    if (!entity.active) {
      if (r && rt.bgHandle) r.setMeshVisible(rt.bgHandle, false)
      if (r && rt.fillHandle) r.setMeshVisible(rt.fillHandle, false)
      return
    }
    if (rt.bgHandle) r?.disposeMesh(rt.bgHandle)
    if (rt.fillHandle) r?.disposeMesh(rt.fillHandle)
    this.runtime.delete(bar)
  }

  protected onUpdate(_dt: number): void {
    for (const entity of this.entities) this.ensureBars(entity)
    this.layout()
  }

  private ensureBars(entity: Entity): void {
    const bar = entity.get(HealthBarComponent)
    const r = this.world?.renderer
    if (!bar || !r) return
    const rt = this.getRuntime(bar)
    if (rt.initialized) return

    // Background: full-width thin box. Created at world origin; positioned
    // each frame in layout().
    rt.bgHandle = r.createMesh(`healthbar_bg_${entity.id}`, {
      kind: 'box',
      width: bar.width,
      height: bar.height,
      depth: bar.height * 0.4,
    }, {
      diffuse: bar.backgroundColor,
      specular: [0, 0, 0],
      emissive: [bar.backgroundColor[0] * 0.4, bar.backgroundColor[1] * 0.4, bar.backgroundColor[2] * 0.4],
    })
    rt.fillHandle = r.createMesh(`healthbar_fill_${entity.id}`, {
      kind: 'box',
      width: bar.width,
      height: bar.height,
      depth: bar.height * 0.4,
    }, {
      diffuse: bar.color,
      specular: [0, 0, 0],
      emissive: bar.color,
    })

    r.setMeshBillboardMode(rt.bgHandle, 'all')
    r.setMeshBillboardMode(rt.fillHandle, 'all')

    rt.initialized = true
  }

  private layout(): void {
    const r = this.world?.renderer
    if (!r) return

    for (const entity of this.entities) {
      const bar = entity.get(HealthBarComponent)
      const health = entity.get(HealthComponent)
      const mesh = entity.get(MeshPrimitiveComponent)
      if (!bar || !health || !mesh) continue
      const rt = this.runtime.get(bar)
      if (!rt?.bgHandle || !rt.fillHandle) continue

      const x = mesh.position[0]
      const y = mesh.position[1] + bar.offsetY
      const z = mesh.position[2]
      const ratio = health.maxHp > 0 ? Math.max(0, Math.min(1, health.hp / health.maxHp)) : 0

      const visible = !(bar.hideAtFullHp && ratio >= 0.9999)
      // Hide via tiny scale rather than enable/disable so a single setMeshPosition
      // call below still lands somewhere harmless. Keeps the runtime hot path branch-free.
      if (!visible) {
        r.setMeshScale(rt.bgHandle, 0, 0, 1)
        r.setMeshScale(rt.fillHandle, 0, 0, 1)
        continue
      }
      r.setMeshScale(rt.bgHandle, 1, 1, 1)
      r.setMeshScale(rt.fillHandle, ratio, 1, 1)

      // Anchor the fill at one edge so it shrinks naturally. Billboard mode
      // rotates the mesh to face camera but doesn't change its local origin,
      // so a position offset along world X happens to map to "left/right of
      // the bar" from any locked-camera angle. For free cameras you'd need
      // to project this through the camera right-vector instead — out of
      // scope here.
      const shrink = (1 - ratio) * bar.width * 0.5
      r.setMeshPosition(rt.bgHandle, x, y, z)
      r.setMeshPosition(
        rt.fillHandle,
        bar.fillFromLeft ? x - shrink : x + shrink,
        y,
        z,
      )
    }
  }
}

export { HealthBarComponent } from './HealthBar.core'
export type { HealthBarInput } from './HealthBar.core'
