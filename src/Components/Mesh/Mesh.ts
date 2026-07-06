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
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';
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
  /**
   * Freeze / release a followed mesh's facing. While locked the follow holds
   * its current yaw instead of turning toward movement — e.g. a strafe mode
   * where the character keeps facing forward while stepping sideways.
   * Payload: `{ entityId, locked }`.
   */
  FACE_LOCK: 'mesh.faceLock',
} as const;

export interface MeshFaceLockRequest {
  entityId: string;
  locked: boolean;
}

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

  constructor(data: MeshInput = {}) {
    super();
    this.params = {
      src: data.src ?? DEFAULT_MESH_PARAMS.src,
      position: toVec3(data.position, DEFAULT_MESH_PARAMS.position),
      rotation: toVec3(data.rotation, DEFAULT_MESH_PARAMS.rotation),
      scale: data.scale ?? DEFAULT_MESH_PARAMS.scale,
      autoLoad: data.autoLoad ?? DEFAULT_MESH_PARAMS.autoLoad,
      assetServerUrl: data.assetServerUrl ?? DEFAULT_MESH_PARAMS.assetServerUrl,
      instanced: data.instanced ?? DEFAULT_MESH_PARAMS.instanced,
      follow: data.follow ?? DEFAULT_MESH_PARAMS.follow,
      faceMode: data.faceMode ?? DEFAULT_MESH_PARAMS.faceMode,
      yawOffset: data.yawOffset ?? DEFAULT_MESH_PARAMS.yawOffset,
      lockRootMotion: data.lockRootMotion ?? DEFAULT_MESH_PARAMS.lockRootMotion,
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
      instanced: this.params.instanced,
      follow: this.params.follow,
      faceMode: this.params.faceMode,
      yawOffset: this.params.yawOffset,
      lockRootMotion: this.params.lockRootMotion,
    };
  }
}

// ============================================
// System
// ============================================

interface MeshRuntime {
  /** Renderer handle returned by `loadMesh` / `instantiateModel`. */
  handle: MeshHandle | null;
}

/**
 * Per-entity follow bookkeeping for instanced + `follow` meshes. Lives on the
 * System (keyed by entityId), never on the Component — it isn't serializable
 * and is reused across park/unpark of a pooled entity.
 */
interface MeshFollowState {
  prevX: number;
  prevZ: number;
  yaw: number;
}

export class MeshSystem extends System {
  /** Entities we've already dispatched a load for this session. */
  private dispatched = new Set<string>();
  /** Per-component runtime state (renderer handles). Never serialized. */
  private runtime = new WeakMap<MeshComponent, MeshRuntime>();
  /** Url-load bookkeeping shared across all entities cloning the same file. */
  private templateRequested = new Set<string>();
  private templateReady = new Set<string>();
  /** Animation names reported by `loadModelTemplate`, keyed by url. */
  private templateAnimationNames = new Map<string, string[]>();
  /** Per-entity follow state (instanced + follow). Keyed by entityId. */
  private followState = new Map<string, MeshFollowState>();
  /** Entity ids whose follow yaw is frozen (strafe / aim lock). */
  private faceLocked = new Set<string>();

  private getRuntime(comp: MeshComponent): MeshRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { handle: null };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  protected query = { required: [MeshComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(MeshInputEvents.LOAD, (e: MeshLoadRequest) => {
      this.handleLoadRequest(e);
    });
    this.listen(MeshInputEvents.FACE_LOCK, (e: MeshFaceLockRequest) => {
      if (e.locked) this.faceLocked.add(e.entityId);
      else this.faceLocked.delete(e.entityId);
    });

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);

    // Instanced re-acquire: if a clone handle already exists for this entity
    // (kept alive while parked), reveal it and reset prevX/prevZ to the
    // current proxy position so the first follow frame doesn't spin from the
    // stale pre-park position. At pool build time there's no clone yet → no-op.
    const id = (entity as unknown as { id: string }).id;
    const comp = entity.get(MeshComponent);
    if (!comp?.params.instanced) return;
    const rt = this.runtime.get(comp);
    if (!rt?.handle) return;
    this.world?.renderer?.setModelVisible(rt.handle, true);
    // A reused clone may have been faded out on its last death — restore opacity.
    this.world?.renderer?.setModelAlpha(id, 1);
    const fs = this.followState.get(id);
    const mp = entity.get(MeshPrimitiveComponent);
    if (fs && mp) {
      fs.prevX = mp.position[0];
      fs.prevZ = mp.position[2];
    }
  }

  protected onEntityRemoved(entity: Entity): void {
    const id = (entity as unknown as { id: string }).id;
    const comp = entity.get(MeshComponent);
    if (comp) {
      const rt = this.getRuntime(comp);
      if (rt.handle) {
        const r = this.world?.renderer;
        if (comp.params.instanced) {
          // Park-aware: a parked (pooled) entity keeps its clone + follow state
          // for reuse, just hidden. A true destroy disposes the clone.
          if (!entity.active) {
            r?.setModelVisible(rt.handle, false);
            // Keep handle, followState, and `dispatched` so re-acquire reuses
            // them; return early without clearing per-session load state.
            return;
          }
          r?.disposeModel(id, rt.handle);
          rt.handle = null;
          this.followState.delete(id);
        } else {
          r?.disposeMesh(rt.handle);
          rt.handle = null;
        }
      }
    }
    this.dispatched.delete(id);
    this.faceLocked.delete(id);
  }

  protected onShutdown(): void {
    this.dispatched.clear();
    this.templateRequested.clear();
    this.templateReady.clear();
    this.templateAnimationNames.clear();
    this.followState.clear();
    this.faceLocked.clear();
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

      // Instanced loads can't complete until the shared template finishes
      // loading, so they don't mark `dispatched` until the clone exists. Keep
      // retrying every frame while autoLoad is set and we haven't instantiated.
      if (comp.params.autoLoad && !this.dispatched.has(id)) {
        this.dispatchLoad(id, comp);
      }

      // Follow the sibling proxy each frame once the mesh handle exists.
      if (comp.params.follow) {
        this.updateFollow(id, comp, entity);
      }
    }
  }

  /**
   * Copy the sibling MeshPrimitive's XZ onto the loaded mesh (Y stays the
   * mesh's own `position[1]` ground/feet offset) and yaw it toward its travel
   * direction. No-op until the mesh handle is present + a sibling exists.
   */
  private updateFollow(entityId: string, comp: MeshComponent, entity: Entity): void {
    const handle = this.getRuntime(comp).handle;
    if (!handle) return;
    const mp = entity.get(MeshPrimitiveComponent);
    if (!mp) return;
    const r = this.world?.renderer;
    if (!r) return;

    const px = mp.position[0];
    const pz = mp.position[2];
    r.setMeshPosition(handle, px, comp.params.position[1], pz);

    let fs = this.followState.get(entityId);
    if (!fs) {
      fs = { prevX: px, prevZ: pz, yaw: comp.params.yawOffset };
      this.followState.set(entityId, fs);
    }
    // While face-locked, hold the current yaw (strafe / aim mode): skip the
    // update but still track prevX/Z so movement doesn't snap on release.
    if (!this.faceLocked.has(entityId)) {
      if (comp.params.faceMode === 'proxy') {
        // The gameplay system already orients the proxy (e.g. a twin-stick player
        // faces its aim). Copy its yaw rather than inferring one from movement.
        fs.yaw = mp.rotation[1] + comp.params.yawOffset;
      } else {
        const dx = px - fs.prevX;
        const dz = pz - fs.prevZ;
        if (Math.hypot(dx, dz) > 1e-3) {
          fs.yaw = Math.atan2(dx, dz) + comp.params.yawOffset;
        }
      }
    }
    fs.prevX = px;
    fs.prevZ = pz;
    r.setMeshRotation(handle, 0, fs.yaw, 0);
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

    if (comp.params.instanced) {
      this.dispatchInstancedLoad(entityId, comp);
      return;
    }

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
        this.getRuntime(comp).handle = res.handle;
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

  /**
   * Instanced load path: one shared `loadModelTemplate` per url (deduped across
   * the whole pool), then a cheap `instantiateModel` clone per entity. Because
   * instantiate must wait for the async template, this does NOT mark `dispatched`
   * until the clone actually exists — `onUpdate` keeps retrying each frame, and
   * the core stays in `loading` until then. For a pool where N entities request
   * the same url in one tick: ONE loadModelTemplate, N instantiateModel.
   */
  private dispatchInstancedLoad(entityId: string, comp: MeshComponent): void {
    const inst = comp.instance;
    if (!inst) return;
    const params = inst.getParams();
    const url = inst.getResolvedUrl();
    const r = this.world?.renderer;

    // Move the core into `loading` (and emit LOADING) exactly once. beginLoad
    // returns false while already loading/loaded, so this guards the event.
    if (inst.beginLoad()) {
      this.eventBus.emit(MeshEvents.LOADING, {
        entityId,
        src: params.src,
      });
    }

    if (!r) return; // No renderer (unit test); leave state as `loading`.

    // Kick off the deduped template load once per url.
    if (!this.templateRequested.has(url)) {
      this.templateRequested.add(url);
      r.loadModelTemplate(url, { lockRootMotion: params.lockRootMotion })
        .then((res) => {
          this.templateAnimationNames.set(url, [...res.animationNames]);
          this.templateReady.add(url);
        })
        .catch(() => {
          // Allow a retry on a later frame if the template load failed.
          this.templateRequested.delete(url);
        });
    }

    // Wait until the template is ready before instantiating the clone.
    if (!this.templateReady.has(url)) return;

    const animationNames = this.templateAnimationNames.get(url) ?? [];
    const handle = r.instantiateModel(entityId, url, {
      position: params.position,
      rotation: params.rotation,
      scale: params.scale,
    });
    this.getRuntime(comp).handle = handle;
    // Clone starts hidden — reveal it.
    r.setModelVisible(handle, true);

    // Now the clone exists: complete the load + stop retrying.
    inst.completeLoad(entityId, animationNames);
    this.dispatched.add(entityId);
    this.eventBus.emit(MeshEvents.LOADED, {
      entityId,
      meshId: entityId,
      animationNames,
    });
  }

  private findEntityById(entityId: string): Entity | undefined {
    for (const e of this.entities) {
      if ((e as unknown as { id: string }).id === entityId) return e;
    }
    return this.world?.getEntity(entityId);
  }
}
