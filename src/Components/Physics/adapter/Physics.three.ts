/**
 * Physics — Three adapter plugin (Rapier).
 *
 * Imports nothing: every Rapier call goes through the backend the ThreeAdapter
 * hands over, described structurally, so a member who downloads Physics and runs
 * Babylon never installs `three` or `@dimforge/rapier3d` to typecheck it.
 *
 * Rapier can answer scene queries; this adapter's backend does not expose them
 * yet, so `canQuery` is false and callers keep their own geometry test. That is
 * the honest answer, and it is why `canQuery` is a question rather than a null
 * return: a caller can tell "no engine support" from "the ray hit nothing".
 */

import type { PhysicsExtension, PhysicsQueryHit } from '../Physics.defs';

/** The Rapier backend surface this plugin drives. */
interface RapierBackend {
  setAngularVelocity(meshId: string, vx: number, vy: number, vz: number): void;
  setDrivenByMesh(meshId: string, drivenByMesh: boolean): void;
  resizeBoxBody(meshId: string, hx: number, hy: number, hz: number): void;
}

/** The subset of ThreeAdapter's extension-host surface this plugin needs. */
export interface ThreeExtensionHost {
  /** Null on the pure-core integrator path, which tracks neither of these. */
  getRapierBackend(): RapierBackend | null;
}

export function createThreeExtension(host: ThreeExtensionHost): PhysicsExtension {
  return {
    canQuery(): boolean {
      return false;
    },
    raycast(): PhysicsQueryHit | null {
      return null;
    },
    sphereCast(): PhysicsQueryHit | null {
      return null;
    },
    resizeBoxBody(meshId: string, halfExtents: readonly number[]): void {
      host.getRapierBackend()?.resizeBoxBody(meshId, halfExtents[0]!, halfExtents[1]!, halfExtents[2]!);
    },
    setBodyAngularVelocity(meshId: string, vx: number, vy: number, vz: number): void {
      host.getRapierBackend()?.setAngularVelocity(meshId, vx, vy, vz);
    },
    setBodyDrivenByMesh(meshId: string, drivenByMesh: boolean): void {
      host.getRapierBackend()?.setDrivenByMesh(meshId, drivenByMesh);
    },
  };
}
