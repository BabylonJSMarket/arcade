/**
 * Mesh — pure core.
 *
 * A tiny loader-state machine: `idle` → `loading` → (`loaded` | `error`).
 * Records the source URL, transform params, and — once loaded — the handle
 * id the renderer assigned plus the animation clip names it discovered.
 *
 * No imports from @babylonjs, three, solid-js or the DOM. Transform fields
 * are plain tuples. The System reads this and talks to `world.renderer`.
 */

import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export type MeshLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface MeshParams {
  /** URL or path to the .glb / .gltf. Required before a load can start. */
  src: string;
  /** World-space position applied after load. */
  position: Vec3;
  /** Euler rotation (radians) applied after load. */
  rotation: Vec3;
  /** Uniform scale. Three rolls it into a Vector3 internally. */
  scale: number;
  /** True = the System triggers a load automatically on entity attach. */
  autoLoad: boolean;
  /** Prepended to `src` when constructing the final URL. Defaults to "". */
  assetServerUrl: string;
}

export interface MeshOutputs {
  state: MeshLoadState;
  /** True the frame `state` transitioned. Read by tests + HUDs. */
  stateChanged: boolean;
  /** Populated once `state === 'loaded'`. */
  meshId: string | null;
  animationNames: readonly string[];
  /** Populated once `state === 'error'`. */
  errorMessage: string | null;
}

export interface MeshInstance {
  /** Begin the load. Idempotent — returns false if already in-flight/loaded. */
  beginLoad(): boolean;
  /** Record a successful load. Transitions idle/loading → loaded. */
  completeLoad(meshId: string, animationNames: string[]): void;
  /** Record a failed load. Transitions idle/loading → error. */
  failLoad(message: string): void;
  /** Read current state (non-destructive). */
  getState(): Readonly<MeshOutputs>;
  getParams(): Readonly<MeshParams>;
  setParams(partial: Partial<MeshParams>): void;
  /** Back to idle; forgets meshId and animationNames. */
  reset(): void;
  /** Full URL the System should pass to the adapter: assetServerUrl + src. */
  getResolvedUrl(): string;
}

export const DEFAULT_MESH_PARAMS: MeshParams = {
  src: '',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  autoLoad: true,
  assetServerUrl: '',
};

export function createMesh(params: Partial<MeshParams> = {}): MeshInstance {
  const active: MeshParams = { ...DEFAULT_MESH_PARAMS, ...params };
  let state: MeshLoadState = 'idle';
  let stateChanged = false;
  let meshId: string | null = null;
  let animationNames: string[] = [];
  let errorMessage: string | null = null;

  const transition = (next: MeshLoadState): void => {
    if (state === next) return;
    state = next;
    stateChanged = true;
  };

  return {
    beginLoad() {
      if (state === 'loading' || state === 'loaded') return false;
      transition('loading');
      meshId = null;
      animationNames = [];
      errorMessage = null;
      return true;
    },
    completeLoad(id, names) {
      meshId = id;
      // Copy so callers mutating the array later can't clobber our snapshot.
      animationNames = [...names];
      errorMessage = null;
      transition('loaded');
    },
    failLoad(message) {
      meshId = null;
      animationNames = [];
      errorMessage = message;
      transition('error');
    },
    getState() {
      const snapshot: MeshOutputs = {
        state,
        stateChanged,
        meshId,
        animationNames,
        errorMessage,
      };
      // `stateChanged` is a one-frame edge — clear it on read so consumers
      // that poll every frame see the transition exactly once.
      stateChanged = false;
      return snapshot;
    },
    getParams() {
      return active;
    },
    setParams(partial) {
      Object.assign(active, partial);
    },
    reset() {
      meshId = null;
      animationNames = [];
      errorMessage = null;
      transition('idle');
    },
    getResolvedUrl() {
      return active.assetServerUrl + active.src;
    },
  };
}
