/**
 * MeshPrimitive.ts — renderer-agnostic System for primitive meshes.
 *
 * The math, geometry, and material state live in MeshPrimitive.core.ts.
 * This file drives the active `world.renderer` adapter to create/update the
 * underlying 3D object. Zero imports from @babylonjs or three.
 */

import { MeshPrimitiveEvents, MeshPrimitiveInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';
import {
  MeshPrimitiveComponent,
  getMeshPrimitiveRuntime,
  type MeshPrimitiveInput,
  type MeshPrimitiveRuntime,
  type PrimitiveType,
} from './MeshPrimitive.defs';

export { MeshPrimitiveComponent, type MeshPrimitiveInput, type MeshPrimitiveRuntime, type PrimitiveType };





interface BabylonMeshExposer {
  kind: 'babylon';
  getMeshObject(h: MeshHandle): unknown;
}

export class MeshPrimitiveSystem extends System {
  /**
   * Per-component runtime state (the renderer handle). The Component is pure
   * data, so the live handle lives here, keyed by the Component instance.
   * Backed by the shared module-level map in MeshPrimitive.core so the
   * Component's `handle` getter and this System observe the SAME slot — that
   * shared identity is what lets pooled entities (which reuse the same
   * Component instance) keep their mesh across park/unpark.
   */
  private runtime = new WeakMap<MeshPrimitiveComponent, MeshPrimitiveRuntime>();

  private getRuntime(comp: MeshPrimitiveComponent): MeshPrimitiveRuntime {
    const rt = getMeshPrimitiveRuntime(comp);
    this.runtime.set(comp, rt);
    return rt;
  }

  protected query = { required: [MeshPrimitiveComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(MeshPrimitiveInputEvents.CREATE, (data: { entityId: string } & Partial<MeshPrimitiveInput>) => {
      this.handleCreateRequest(data.entityId, data);
    });
    this.listen(MeshPrimitiveInputEvents.SET_POSITION, (data: { entityId: string; x: number; y: number; z: number }) => {
      this.handleSetPosition(data.entityId, data.x, data.y, data.z);
    });
    this.listen(MeshPrimitiveInputEvents.SET_SCALE, (data: { entityId: string; x: number; y: number; z: number }) => {
      this.handleSetScale(data.entityId, data.x, data.y, data.z);
    });
    this.listen(MeshPrimitiveInputEvents.SET_COLOR, (data: { entityId: string; r: number; g: number; b: number }) => {
      this.handleSetColor(data.entityId, data.r, data.g, data.b);
    });
    this.listen(MeshPrimitiveInputEvents.SET_VISIBLE, (data: { entityId: string; visible: boolean }) => {
      this.handleSetVisible(data.entityId, data.visible);
    });
    this.listen(MeshPrimitiveInputEvents.DISPOSE, (data: { entityId: string }) => {
      this.handleDispose(data.entityId);
    });

    for (const entity of this.entities) {
      const comp = entity.get(MeshPrimitiveComponent);
      if (comp?.autoCreate && !comp.isCreated) {
        this.createPrimitive(entity, comp);
      }
    }
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    if (comp.autoCreate && !comp.isCreated) {
      this.createPrimitive(entity, comp);
      return;
    }
    // Reactivated from a pool: the mesh still exists (kept alive while parked).
    // Reposition + show it instead of recreating — `reset()` may have moved
    // comp.position while it was out of play.
    //
    // QUEUED, not written here. This hook runs inside whichever system's update
    // triggered the acquire — the spawner's — so writing now puts a second
    // system's mutation inside that window: it is misattributed to the spawner,
    // and it lands in the same frame as the owning system's own write when a
    // car is driven early in the frame and recycled later in it. Flushing from
    // our own onUpdate keeps every write in its owner's window.
    this.pendingRestore.add(entity.id);
    this.pendingVisible.set(entity.id, true);
  }

  /** Pooled entities reactivated this frame, awaiting a pose restore. */
  private pendingRestore = new Set<string>();

  /**
   * Net visibility for pooled entities that parked and/or reactivated this
   * frame. A spawner that sweeps a car and immediately reuses it does BOTH in
   * one frame; writing each as it happens is two systems on one handle, which
   * is the race. Recording the net and writing once resolves it — and the last
   * value recorded is the correct one either way.
   */
  private pendingVisible = new Map<string, boolean>();

  private flushRestores(): void {
    if (!this.pendingRestore.size && !this.pendingVisible.size) return;
    const r = this.world?.renderer;

    for (const id of this.pendingRestore) {
      const comp = this.world?.getEntity(id)?.get(MeshPrimitiveComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.handle || !r) continue;
      r.setMeshPosition(rt.handle, comp.position[0], comp.position[1], comp.position[2]);
      r.setMeshRotation(rt.handle, comp.rotation[0], comp.rotation[1], comp.rotation[2]);
    }
    this.pendingRestore.clear();

    for (const [id, live] of this.pendingVisible) {
      const comp = this.world?.getEntity(id)?.get(MeshPrimitiveComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.handle || !r) continue;
      // Parked hides outright; reactivated shows whatever the component asks
      // for, which for a hidden gameplay proxy is still hidden.
      r.setMeshVisible(rt.handle, live && comp.visible);
    }
    this.pendingVisible.clear();
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (!rt.handle) return;
    const r = this.world?.renderer;
    // Parked (pooled, removed from play) — keep the mesh for reuse, just hide
    // it. Disposing here would re-churn the GPU work pooling exists to avoid.
    if (!entity.active) {
      // Queued, not written — see pendingVisible.
      this.pendingVisible.set(entity.id, false);
      return;
    }
    // Destroyed, or the MeshPrimitive component was removed — dispose for real.
    r?.disposeMesh(rt.handle);
    rt.handle = undefined;
    comp.isCreated = false;
  }

  protected onUpdate(_deltaTime: number): void {
    this.flushRestores();
  }

  private createPrimitive(entity: Entity, comp: MeshPrimitiveComponent): void {
    const r = this.world?.renderer;
    if (!r) {
      // Without a renderer the component can still be inspected by tests;
      // creation is deferred until one is attached.
      return;
    }

    const rt = this.getRuntime(comp);
    if (rt.handle) {
      r.disposeMesh(rt.handle);
      rt.handle = undefined;
    }

    const handle = r.createMesh(entity.id, comp.toPrimitiveSpec(), comp.material);
    r.setMeshPosition(handle, comp.position[0], comp.position[1], comp.position[2]);
    r.setMeshRotation(handle, comp.rotation[0], comp.rotation[1], comp.rotation[2]);
    r.setMeshVisible(handle, comp.visible);

    rt.handle = handle;
    comp.isCreated = true;

    if (comp.material) {
      this.eventBus.emit(MeshPrimitiveEvents.MATERIAL_APPLIED, { entityId: entity.id });
    }

    // Back-compat: non-migrated consumers (ArcCamera, Shadow) still read
    // `data.mesh`. The Babylon adapter exposes the raw mesh via a non-interface
    // method; the Three adapter has no such concept, so `mesh` is undefined there.
    const exposer = r as unknown as BabylonMeshExposer;
    const mesh = exposer.kind === 'babylon' && typeof exposer.getMeshObject === 'function'
      ? exposer.getMeshObject(handle)
      : undefined;

    this.eventBus.emit(MeshPrimitiveEvents.CREATED, {
      entityId: entity.id,
      primitive: comp.primitive,
      handle,
      mesh,
    });
  }

  private getEntityById(entityId: string): Entity | undefined {
    for (const e of this.entities) {
      if (e.id === entityId) return e;
    }
    return this.world?.getEntity(entityId);
  }

  private handleCreateRequest(entityId: string, params: Partial<MeshPrimitiveInput>): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;

    if (params.primitive) comp.primitive = params.primitive;
    if (params.width !== undefined) comp.width = params.width;
    if (params.height !== undefined) comp.height = params.height;
    if (params.depth !== undefined) comp.depth = params.depth;
    if (params.diameter !== undefined) comp.diameter = params.diameter;
    if (params.color) comp.material = { diffuse: params.color };

    this.createPrimitive(entity, comp);
  }

  private handleSetPosition(entityId: string, x: number, y: number, z: number): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    comp.position[0] = x;
    comp.position[1] = y;
    comp.position[2] = z;
    const { handle } = this.getRuntime(comp);
    if (handle) this.world?.renderer?.setMeshPosition(handle, x, y, z);
  }

  private handleSetScale(entityId: string, x: number, y: number, z: number): void {
    // Scale is not part of the RendererAdapter yet; no-op for now.
    void entityId;
    void x;
    void y;
    void z;
  }

  private handleSetColor(entityId: string, r: number, g: number, b: number): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    comp.material = { ...(comp.material ?? {}), diffuse: [r, g, b] };
    const rt = this.getRuntime(comp);
    if (rt.handle) this.world?.renderer?.setMeshColor(rt.handle, r, g, b);
  }

  private handleSetVisible(entityId: string, visible: boolean): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    comp.visible = visible;
    const { handle } = this.getRuntime(comp);
    if (handle) this.world?.renderer?.setMeshVisible(handle, visible);
  }

  private handleDispose(entityId: string): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (!rt.handle) return;
    this.world?.renderer?.disposeMesh(rt.handle);
    rt.handle = undefined;
    comp.isCreated = false;
    this.eventBus.emit(MeshPrimitiveEvents.DISPOSED, { entityId });
  }
}
