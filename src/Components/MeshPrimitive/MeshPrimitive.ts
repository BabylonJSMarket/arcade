/**
 * MeshPrimitive.ts — renderer-agnostic System for primitive meshes.
 *
 * The math, geometry, and material state live in MeshPrimitive.core.ts.
 * This file drives the active `world.renderer` adapter to create/update the
 * underlying 3D object. Zero imports from @babylonjs or three.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent, type MeshPrimitiveInput, type PrimitiveType } from './MeshPrimitive.core';

export { MeshPrimitiveComponent, type MeshPrimitiveInput, type PrimitiveType };

export const MeshPrimitiveEvents = {
  CREATED: 'meshprimitive.created',
  MATERIAL_APPLIED: 'meshprimitive.material.applied',
  DISPOSED: 'meshprimitive.disposed',
} as const;

export const MeshPrimitiveInputEvents = {
  CREATE: 'meshprimitive.create',
  SET_POSITION: 'meshprimitive.position.set',
  SET_SCALE: 'meshprimitive.scale.set',
  SET_COLOR: 'meshprimitive.color.set',
  SET_VISIBLE: 'meshprimitive.visible.set',
  DISPOSE: 'meshprimitive.dispose',
} as const;

interface BabylonMeshExposer {
  kind: 'babylon';
  getMeshObject(h: MeshHandle): unknown;
}

export class MeshPrimitiveSystem extends System {
  private unsubscribes: Array<() => void> = [];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [MeshPrimitiveComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on(MeshPrimitiveInputEvents.CREATE, (data: { entityId: string } & Partial<MeshPrimitiveInput>) => {
        this.handleCreateRequest(data.entityId, data);
      }),
      this.eventBus.on(MeshPrimitiveInputEvents.SET_POSITION, (data: { entityId: string; x: number; y: number; z: number }) => {
        this.handleSetPosition(data.entityId, data.x, data.y, data.z);
      }),
      this.eventBus.on(MeshPrimitiveInputEvents.SET_SCALE, (data: { entityId: string; x: number; y: number; z: number }) => {
        this.handleSetScale(data.entityId, data.x, data.y, data.z);
      }),
      this.eventBus.on(MeshPrimitiveInputEvents.SET_COLOR, (data: { entityId: string; r: number; g: number; b: number }) => {
        this.handleSetColor(data.entityId, data.r, data.g, data.b);
      }),
      this.eventBus.on(MeshPrimitiveInputEvents.SET_VISIBLE, (data: { entityId: string; visible: boolean }) => {
        this.handleSetVisible(data.entityId, data.visible);
      }),
      this.eventBus.on(MeshPrimitiveInputEvents.DISPOSE, (data: { entityId: string }) => {
        this.handleDispose(data.entityId);
      }),
    );

    for (const entity of this.entities) {
      const comp = entity.get(MeshPrimitiveComponent);
      if (comp?.autoCreate && !comp.isCreated) {
        this.createPrimitive(entity, comp);
      }
    }
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(MeshPrimitiveComponent);
    if (comp?.autoCreate && !comp.isCreated) {
      this.createPrimitive(entity, comp);
    }
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(MeshPrimitiveComponent);
    if (comp?.handle) {
      this.world?.renderer?.disposeMesh(comp.handle);
      comp.handle = undefined;
      comp.isCreated = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {}

  private createPrimitive(entity: Entity, comp: MeshPrimitiveComponent): void {
    const r = this.world?.renderer;
    if (!r) {
      // Without a renderer the component can still be inspected by tests;
      // creation is deferred until one is attached.
      return;
    }

    if (comp.handle) {
      r.disposeMesh(comp.handle);
      comp.handle = undefined;
    }

    const handle = r.createMesh(entity.id, comp.toPrimitiveSpec(), comp.material);
    r.setMeshPosition(handle, comp.position[0], comp.position[1], comp.position[2]);
    r.setMeshRotation(handle, comp.rotation[0], comp.rotation[1], comp.rotation[2]);
    r.setMeshVisible(handle, comp.visible);

    comp.handle = handle;
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
    if (comp.handle) this.world?.renderer?.setMeshPosition(comp.handle, x, y, z);
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
    if (comp.handle) this.world?.renderer?.setMeshColor(comp.handle, r, g, b);
  }

  private handleSetVisible(entityId: string, visible: boolean): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp) return;
    comp.visible = visible;
    if (comp.handle) this.world?.renderer?.setMeshVisible(comp.handle, visible);
  }

  private handleDispose(entityId: string): void {
    const entity = this.getEntityById(entityId);
    if (!entity) return;
    const comp = entity.get(MeshPrimitiveComponent);
    if (!comp?.handle) return;
    this.world?.renderer?.disposeMesh(comp.handle);
    comp.handle = undefined;
    comp.isCreated = false;
    this.eventBus.emit(MeshPrimitiveEvents.DISPOSED, { entityId });
  }
}
