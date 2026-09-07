/**
 * Physics — Babylon adapter plugin (Havok).
 *
 * This is NOT the component — it's an adapter plugin, the sanctioned place
 * (alongside BabylonAdapter itself) to import `@babylonjs`. It owns the scene
 * casts and the two body controls that only some games ever reach for, so the
 * free ecs package stops carrying Havok's cast plumbing for everyone.
 *
 * Two Havok details that cost real debugging time and are easy to undo:
 *
 * A cast reports the BODY it hit, never a mesh id, so the plugin has to ask the
 * adapter which mesh a body belongs to and treat "not one of ours" as a miss —
 * otherwise a hit against something the component never registered reads as a
 * hit against whatever id happened to be nearby.
 *
 * And the result fields are `hitPoint` / `hitNormal`. Babylon's raycast result
 * also carries `hitPointWorld` from an older API; reading those gives zeros
 * that look like a contact at the origin.
 *
 * Sphere shapes are cached per radius (quantized to a centimetre) because a
 * shape allocation per cast, at one cast per projectile per frame, is the whole
 * budget.
 */

import { PhysicsShapeBox, PhysicsShapeSphere } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import { ShapeCastResult } from '@babylonjs/core/Physics/shapeCastResult';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import type { Scene } from '@babylonjs/core/scene';
import type { PhysicsExtension, PhysicsQueryHit } from '../Physics.defs';

/** The subset of BabylonAdapter's extension-host surface this plugin needs. */
export interface BabylonExtensionHost {
  getScene(): Scene | null;
  getPhysicsBody(meshId: string): PhysicsBody | null;
  /** Null until the Havok WASM has landed — the reason `canQuery` exists. */
  getHavokPlugin(): HavokPlugin | null;
  getMeshIdForBody(body: PhysicsBody): string | undefined;
}

export function createBabylonExtension(host: BabylonExtensionHost): PhysicsExtension {
  const sphereShapes = new Map<number, PhysicsShapeSphere>();
  const raycastResult = new PhysicsRaycastResult();
  const shapeCastInput = new ShapeCastResult();
  const shapeCastHit = new ShapeCastResult();
  const _from = new Vector3();
  const _to = new Vector3();
  const _rot = Quaternion.Identity();

  /** A Babylon cast result as a hit, or null when it hit nothing of ours. */
  const asHit = (
    res: PhysicsRaycastResult | ShapeCastResult,
    distance: number,
  ): PhysicsQueryHit | null => {
    if (!res.hasHit || !res.body) return null;
    const meshId = host.getMeshIdForBody(res.body);
    if (meshId === undefined) return null;
    const p = res.hitPoint;
    const n = res.hitNormal;
    return { meshId, point: [p.x, p.y, p.z], normal: [n.x, n.y, n.z], distance };
  };

  return {
    canQuery(): boolean {
      return host.getHavokPlugin() !== null;
    },

    raycast(from: readonly number[], to: readonly number[]): PhysicsQueryHit | null {
      const plugin = host.getHavokPlugin();
      if (!plugin) return null;
      _from.set(from[0]!, from[1]!, from[2]!);
      _to.set(to[0]!, to[1]!, to[2]!);
      plugin.raycast(_from, _to, raycastResult, { shouldHitTriggers: false });
      return asHit(raycastResult, raycastResult.hitDistance);
    },

    sphereCast(from: readonly number[], to: readonly number[], radius: number): PhysicsQueryHit | null {
      const plugin = host.getHavokPlugin();
      const scene = host.getScene();
      if (!plugin || !scene) return null;
      _from.set(from[0]!, from[1]!, from[2]!);
      _to.set(to[0]!, to[1]!, to[2]!);
      const key = Math.round(radius * 100) / 100;
      let shape = sphereShapes.get(key);
      if (!shape) {
        shape = new PhysicsShapeSphere(Vector3.Zero(), key, scene);
        sphereShapes.set(key, shape);
      }
      plugin.shapeCast(
        { shape, rotation: _rot, startPosition: _from, endPosition: _to, shouldHitTriggers: false },
        shapeCastInput,
        shapeCastHit,
      );
      return asHit(shapeCastHit, shapeCastHit.hitFraction * Vector3.Distance(_from, _to));
    },

    resizeBoxBody(meshId: string, halfExtents: readonly number[]): void {
      const scene = host.getScene();
      const body = host.getPhysicsBody(meshId);
      if (!scene || !body) return;
      // Build a new BOX shape at the requested dimensions, hot-swap it onto the
      // body, then dispose the old one. The body keeps motion type, mass,
      // restitution, friction, pose and velocity.
      const dims = new Vector3(halfExtents[0]! * 2, halfExtents[1]! * 2, halfExtents[2]! * 2);
      const newShape = new PhysicsShapeBox(
        new Vector3(0, 0, 0),
        new Quaternion(0, 0, 0, 1),
        dims,
        scene,
      );
      const oldShape = body.shape;
      body.shape = newShape;
      oldShape?.dispose();
    },

    setBodyAngularVelocity(meshId: string, vx: number, vy: number, vz: number): void {
      host.getPhysicsBody(meshId)?.setAngularVelocity(new Vector3(vx, vy, vz));
    },

    setBodyDrivenByMesh(meshId: string, drivenByMesh: boolean): void {
      const body = host.getPhysicsBody(meshId);
      if (!body) return;
      body.disablePreStep = !drivenByMesh;
    },
  };
}
