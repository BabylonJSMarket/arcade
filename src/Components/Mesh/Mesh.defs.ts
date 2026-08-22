/**
 * Mesh — definitions.
 *
 * The Mesh component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Mesh in a query or react to what it emits: this file carries no System, so
 * naming Mesh never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { MeshHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { DEFAULT_MESH_PARAMS, type MeshInstance, type MeshParams } from './Mesh.core';
// ============================================
// Events
// ============================================

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

export function toVec3(input: unknown, fallback: Vec3): Vec3 {
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
      skin: data.skin ?? DEFAULT_MESH_PARAMS.skin,
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
      skin: this.params.skin ? { ...this.params.skin } : null,
    };
  }
}

// ============================================
// System
// ============================================

export interface MeshRuntime {
  /** Renderer handle returned by `loadMesh` / `instantiateModel`. */
  handle: MeshHandle | null;
}

/**
 * Per-entity follow bookkeeping for instanced + `follow` meshes. Lives on the
 * System (keyed by entityId), never on the Component — it isn't serializable
 * and is reused across park/unpark of a pooled entity.
 */
export interface MeshFollowState {
  prevX: number;
  prevZ: number;
  yaw: number;
}