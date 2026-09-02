/**
 * GlowLayer.ts — renderer-agnostic System for the scene-wide emissive bloom.
 *
 * Scene-global: one glow pass per scene, switched on with
 * `renderer.setGlowLayer(spec)` when the component attaches and off with
 * `setGlowLayer(null)` when it goes; intensity is diffed per frame so a
 * slider drives it live.
 *
 * The part that makes this more than a one-liner: the adapter's glow layer
 * starts from an EMPTY whitelist. Nothing blooms — not a CRT screen, not a
 * neon tube — until `addGlowMesh(handle)` enrols it. That is deliberate at
 * the adapter (a space shooter wants its sun to glow and its bullet trails
 * not to), but a room full of lit cabinets wants the opposite: everything
 * emissive, in. So with `includeEmissive` on, this System listens for meshes
 * as they appear — MeshPrimitive's CREATED and Mesh's LOADED both carry the
 * renderer handle — and enrols each one. Handles are remembered whether or
 * not the layer is up yet, so the order the scene lists its entities in does
 * not matter, and `removeGlowMesh` can undo every enrolment on detach.
 */

import { GlowLayerEvents, MeshEvents, MeshPrimitiveEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';
import { GlowLayerComponent, type GlowLayerInput } from './GlowLayer.defs';

export { GlowLayerComponent, type GlowLayerInput };

interface GlowLayerRuntime {
  /** True while the adapter has this component's layer up. */
  applied: boolean;
  lastIntensity?: number;
  lastEnabled?: boolean;
}

/** Payload shape shared by MeshPrimitive CREATED and Mesh LOADED. */
interface MeshHandleEvent {
  entityId: string;
  handle?: MeshHandle;
}

export class GlowLayerSystem extends System {
  protected query = { required: [GlowLayerComponent] };
  private runtime = new WeakMap<GlowLayerComponent, GlowLayerRuntime>();
  /** Every mesh handle the scene has told us about, by owning entity. */
  private meshHandles = new Map<string, MeshHandle>();
  /** The subset currently whitelisted into the live layer. */
  private enrolled = new Set<string>();
  /** The entity whose component owns the live layer, if any. */
  private activeEntity: Entity | null = null;

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: GlowLayerComponent): GlowLayerRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { applied: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  protected onInitialize(): void {
    const onMesh = (e: MeshHandleEvent) => {
      if (!e?.handle) return;
      this.meshHandles.set(e.entityId, e.handle);
      this.enrol(e.entityId);
    };
    this.listen(MeshPrimitiveEvents.CREATED, onMesh);
    this.listen(MeshEvents.LOADED, onMesh);
    this.listen(MeshPrimitiveEvents.DISPOSED, (e: { entityId: string }) => {
      this.forget(e.entityId);
    });
    for (const entity of this.entities) this.apply(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.apply(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(GlowLayerComponent);
    if (!comp) return;
    this.clear(entity, comp);
  }

  protected onUpdate(_dt: number): void {
    for (const entity of this.entities) {
      const comp = entity.get(GlowLayerComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);

      if (rt.lastEnabled !== comp.enabled) {
        // A toggle: bring the layer up or take it down, then fall through so
        // a same-frame intensity edit is folded into the apply.
        if (comp.enabled) this.apply(entity);
        else this.clear(entity, comp);
        continue;
      }
      if (!rt.applied) continue;

      if (rt.lastIntensity === undefined || Math.abs(rt.lastIntensity - comp.intensity) > 0.001) {
        // The adapter updates an existing layer in place (whitelist intact),
        // so a slider costs one call, not a rebuild.
        this.world?.renderer?.setGlowLayer(comp.toSpec());
        rt.lastIntensity = comp.intensity;
      }
    }
  }

  private apply(entity: Entity): void {
    const comp = entity.get(GlowLayerComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    rt.lastEnabled = comp.enabled;
    if (rt.applied || !comp.enabled) return;
    const r = this.world?.renderer;
    if (!r) return;

    r.setGlowLayer(comp.toSpec());
    rt.applied = true;
    rt.lastIntensity = comp.intensity;
    this.activeEntity = entity;
    this.eventBus.emit(GlowLayerEvents.APPLIED, {
      entityId: entity.id,
      intensity: comp.intensity,
    });
    // Meshes that showed up before the layer did: enrol them now.
    for (const id of this.meshHandles.keys()) this.enrol(id);
  }

  private clear(entity: Entity, comp: GlowLayerComponent): void {
    const rt = this.getRuntime(comp);
    rt.lastEnabled = comp.enabled;
    if (!rt.applied) return;
    const r = this.world?.renderer;
    for (const id of this.enrolled) {
      const h = this.meshHandles.get(id);
      if (h) r?.removeGlowMesh(h);
    }
    this.enrolled.clear();
    r?.setGlowLayer(null);
    rt.applied = false;
    rt.lastIntensity = undefined;
    this.activeEntity = null;
    this.eventBus.emit(GlowLayerEvents.CLEARED, { entityId: entity.id });
  }

  /** Whitelist one remembered mesh, if a layer is up and wants emissives. */
  private enrol(meshEntityId: string): void {
    const owner = this.activeEntity;
    if (!owner) return;
    const comp = owner.get(GlowLayerComponent);
    if (!comp || !comp.includeEmissive) return;
    const rt = this.getRuntime(comp);
    if (!rt.applied || this.enrolled.has(meshEntityId)) return;
    const h = this.meshHandles.get(meshEntityId);
    if (!h) return;
    this.world?.renderer?.addGlowMesh(h);
    this.enrolled.add(meshEntityId);
    this.eventBus.emit(GlowLayerEvents.MESH_ENROLLED, {
      entityId: owner.id,
      meshEntityId,
    });
  }

  /** A mesh went away: drop it from the whitelist and from memory. */
  private forget(meshEntityId: string): void {
    const h = this.meshHandles.get(meshEntityId);
    if (h && this.enrolled.has(meshEntityId)) {
      this.world?.renderer?.removeGlowMesh(h);
      this.enrolled.delete(meshEntityId);
    }
    this.meshHandles.delete(meshEntityId);
  }
}
