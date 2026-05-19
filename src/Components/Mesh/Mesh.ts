/**
 * Mesh.ts — renderer-agnostic System for file-loaded meshes (GLB / glTF).
 *
 * The state machine lives in Mesh.core.ts. This System is a thin driver: it
 * observes entities with a MeshComponent, calls `world.renderer.loadMesh(id,
 * { url, position, rotation, scale })`, and on the returned Promise records
 * the assigned meshId + animation names back on the core. Events fire at each
 * transition so HUDs / downstream systems (e.g., Animation) can react.
 *
 * Zero imports from @babylonjs or three — the adapter handles the
 * `SceneLoader.ImportMeshAsync` / `GLTFLoader.loadAsync` specifics.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import {
  createMesh,
  DEFAULT_MESH_PARAMS,
  type MeshInstance,
  type MeshParams,
} from './Mesh.core';

// ============================================
// Events
// ============================================

export const MeshEvents = {
  /** A load request has been dispatched to the renderer. */
  LOADING: 'mesh.loading',
  /** The model finished loading — `meshId` is now valid for animation calls. */
  LOADED: 'mesh.loaded',
  /** The renderer rejected the load. `error` has the message. */
  ERROR: 'mesh.error',
} as const;

export const MeshInputEvents = {
  /** Kick a load for the matching entity. Payload: `{ entityId, src? }`. */
  LOAD: 'mesh.load',
} as const;

export interface MeshLoadRequest {
  entityId: string;
  /** Optional override; if omitted the System uses the component's current `src`. */
  src?: string;
}

export interface MeshInput extends Omit<Partial<MeshParams>, 'position' | 'rotation'> {
  /** Accept Vec3 arrays or `{x, y, z}` objects for position/rotation. */
  position?: Vec3 | { x: number; y: number; z: number };
  rotation?: Vec3 | { x: number; y: number; z: number };
}

function toVec3(input: unknown, fallback: Vec3): Vec3 {
  if (!input) return [...fallback] as Vec3;
  if (Array.isArray(input) && input.length === 3) {
    return [Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0];
  }
  const o = input as { x?: number; y?: number; z?: number };
  if (typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number') {
    return [o.x, o.y, o.z];
  }
  return [...fallback] as Vec3;
}

// ============================================
// Component
// ============================================

export class MeshComponent extends Component {
  params: MeshParams;
  /** Populated by the System on first update. */
  instance: MeshInstance | null = null;
  /** Renderer handle returned by `loadMesh`. Populated on successful load. */
  handle: MeshHandle | null = null;

  constructor(data: MeshInput = {}) {
    super();
    this.params = {
      src: data.src ?? DEFAULT_MESH_PARAMS.src,
      position: toVec3(data.position, DEFAULT_MESH_PARAMS.position),
      rotation: toVec3(data.rotation, DEFAULT_MESH_PARAMS.rotation),
      scale: data.scale ?? DEFAULT_MESH_PARAMS.scale,
      autoLoad: data.autoLoad ?? DEFAULT_MESH_PARAMS.autoLoad,
      assetServerUrl: data.assetServerUrl ?? DEFAULT_MESH_PARAMS.assetServerUrl,
    };
  }

  serialize(): MeshInput {
    return {
      src: this.params.src,
      position: [...this.params.position] as Vec3,
      rotation: [...this.params.rotation] as Vec3,
      scale: this.params.scale,
      autoLoad: this.params.autoLoad,
      assetServerUrl: this.params.assetServerUrl,
    };
  }
}

// ============================================
// System
// ============================================

export class MeshSystem extends System {
  /** Entities we've already dispatched a load for this session. */
  private dispatched = new Set<string>();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [MeshComponent] };
  }

  protected onInitialize(): void {
    this.eventBus.on(MeshInputEvents.LOAD, (e: MeshLoadRequest) => {
      this.handleLoadRequest(e);
    });

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const id = (entity as unknown as { id: string }).id;
    const comp = entity.get(MeshComponent);
    if (comp?.handle) {
      this.world?.renderer?.disposeMesh(comp.handle);
      comp.handle = null;
    }
    this.dispatched.delete(id);
  }

  protected onShutdown(): void {
    this.dispatched.clear();
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(MeshComponent);
    if (!comp || comp.instance) return;
    comp.instance = createMesh(comp.params);
  }

  protected onUpdate(_dt: number): void {
    for (const entity of this.entities) {
      const id = (entity as unknown as { id: string }).id;
      const comp = entity.get(MeshComponent);
      if (!comp?.instance) continue;

      if (comp.params.autoLoad && !this.dispatched.has(id)) {
        this.dispatchLoad(id, comp);
      }
    }
  }

  private handleLoadRequest(e: MeshLoadRequest): void {
    const entity = this.findEntityById(e.entityId);
    if (!entity) return;
    const comp = entity.get(MeshComponent);
    if (!comp?.instance) return;
    if (e.src) comp.instance.setParams({ src: e.src });
    // Reset loader state so a re-load after error / reset goes through.
    if (comp.instance.getState().state !== 'loading') {
      comp.instance.reset();
    }
    this.dispatchLoad(e.entityId, comp);
  }

  private dispatchLoad(entityId: string, comp: MeshComponent): void {
    const inst = comp.instance;
    if (!inst) return;
    if (!inst.getParams().src) return; // No src yet; wait for a LOAD event.

    const started = inst.beginLoad();
    if (!started) return;
    this.dispatched.add(entityId);

    const r = this.world?.renderer;
    const params = inst.getParams();
    this.eventBus.emit(MeshEvents.LOADING, {
      entityId,
      src: params.src,
    });

    if (!r) return; // No renderer attached (unit test); leave state as `loading`.

    r.loadMesh(entityId, {
      url: inst.getResolvedUrl(),
      position: params.position,
      rotation: params.rotation,
      scale: params.scale,
    })
      .then((res) => {
        inst.completeLoad(res.meshId, res.animationNames);
        comp.handle = res.handle;
        this.eventBus.emit(MeshEvents.LOADED, {
          entityId,
          meshId: res.meshId,
          animationNames: res.animationNames,
        });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        inst.failLoad(message);
        this.eventBus.emit(MeshEvents.ERROR, {
          entityId,
          src: params.src,
          error: message,
        });
      });
  }

  private findEntityById(entityId: string): Entity | undefined {
    for (const e of this.entities) {
      if ((e as unknown as { id: string }).id === entityId) return e;
    }
    return this.world?.getEntity(entityId);
  }
}
