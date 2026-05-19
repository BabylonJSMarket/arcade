/**
 * ArcCamera.ts — renderer-agnostic System for an orbit-style camera.
 * Drives world.renderer.createArcCamera / setCameraTarget / getCameraAngles.
 *
 * Target-follow subscribes to meshprimitive.created events (renderer-agnostic
 * payload now carries `{ entityId, handle }`) and stores the MeshHandle. Each
 * frame it reads the target's world position via the adapter and lerps the
 * camera target toward it.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { ArcCameraComponent, type ArcCameraInput } from './ArcCamera.core';

export { ArcCameraComponent, type ArcCameraInput };

export const ArcCameraEvents = {
  CREATED: 'arccamera.created',
  MOVED: 'arccamera.moved',
  ROTATED: 'arccamera.rotated',
  ZOOMED: 'arccamera.zoomed',
  TARGET_CHANGED: 'arccamera.target.changed',
} as const;

export class ArcCameraSystem extends System {
  private unsubscribes: Array<() => void> = [];
  private targetHandles = new Map<string, MeshHandle>();
  private idleTime = 0;
  private idleThreshold = 3;

  // Reused per-frame tuples
  private _tempMeshPos: Vec3 = [0, 0, 0];
  private _tempCamTarget: Vec3 = [0, 0, 0];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ArcCameraComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on('meshprimitive.created', (data: { entityId: string; handle: MeshHandle }) => {
        if (data?.entityId && data.handle) {
          this.targetHandles.set(data.entityId, data.handle);
        }
      }),
    );

    for (const entity of this.entities) {
      this.ensureCamera(entity);
    }
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.targetHandles.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureCamera(entity);
  }

  protected onEntityRemoved(_entity: Entity): void {
    // Babylon adapter keeps the camera alive across scene reloads; nothing to
    // do here today. Adapter.dispose() will release on teardown.
  }

  protected onUpdate(deltaTime: number): void {
    const r = this.world?.renderer;
    if (!r) return;

    let anyInput = false;

    for (const entity of this.entities) {
      const arc = entity.get(ArcCameraComponent);
      if (!arc?.handle || !arc.initialized) continue;

      if (arc.target) {
        const targetHandle = this.targetHandles.get(arc.target);
        if (targetHandle) {
          r.getMeshWorldPosition(targetHandle, this._tempMeshPos);
          r.getCameraTarget(arc.handle, this._tempCamTarget);
          const tx = this._tempMeshPos[0] + arc.targetOffset[0];
          const ty = this._tempMeshPos[1] + arc.targetOffset[1];
          const tz = this._tempMeshPos[2] + arc.targetOffset[2];
          const lerp = 0.1;
          const nx = this._tempCamTarget[0] + (tx - this._tempCamTarget[0]) * lerp;
          const ny = this._tempCamTarget[1] + (ty - this._tempCamTarget[1]) * lerp;
          const nz = this._tempCamTarget[2] + (tz - this._tempCamTarget[2]) * lerp;
          r.setCameraTarget(arc.handle, nx, ny, nz);
        }
      }

      const angles = r.getCameraAngles(arc.handle);
      const alphaDiff = Math.abs(angles.alpha - arc.lastAlpha);
      const betaDiff = Math.abs(angles.beta - arc.lastBeta);
      const radiusDiff = Math.abs(angles.radius - arc.lastRadius);

      if (alphaDiff > 0.01 || betaDiff > 0.01) {
        this.eventBus.emit(ArcCameraEvents.ROTATED, {
          entityId: entity.id,
          alpha: angles.alpha,
          beta: angles.beta,
          deltaAlpha: angles.alpha - arc.lastAlpha,
          deltaBeta: angles.beta - arc.lastBeta,
        });
        arc.lastAlpha = angles.alpha;
        arc.lastBeta = angles.beta;
        arc.alpha = angles.alpha;
        arc.beta = angles.beta;
        anyInput = true;
      }

      if (radiusDiff > 0.1) {
        this.eventBus.emit(ArcCameraEvents.ZOOMED, {
          entityId: entity.id,
          radius: angles.radius,
          deltaRadius: angles.radius - arc.lastRadius,
        });
        arc.lastRadius = angles.radius;
        arc.distance = angles.radius;
        anyInput = true;
      }

      if (arc.autoRotate) {
        if (anyInput) {
          this.idleTime = 0;
        } else {
          this.idleTime += deltaTime;
          if (this.idleTime > this.idleThreshold) {
            r.nudgeCameraAlpha(arc.handle, arc.autoRotateSpeed * deltaTime);
            arc.lastAlpha = r.getCameraAngles(arc.handle).alpha;
          }
        }
      }
    }
  }

  private ensureCamera(entity: Entity): void {
    const arc = entity.get(ArcCameraComponent);
    if (!arc || arc.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    // Seed the camera target from a tracked mesh if available; otherwise origin.
    const seedTarget: Vec3 = [0, 0, 0];
    if (arc.target) {
      const h = this.targetHandles.get(arc.target);
      if (h) {
        r.getMeshWorldPosition(h, seedTarget);
        seedTarget[0] += arc.targetOffset[0];
        seedTarget[1] += arc.targetOffset[1];
        seedTarget[2] += arc.targetOffset[2];
      }
    }
    const spec = arc.toSpec();
    spec.target = seedTarget;

    arc.handle = r.createArcCamera(entity.id, spec);
    arc.initialized = true;
    const angles = r.getCameraAngles(arc.handle);
    arc.lastAlpha = angles.alpha;
    arc.lastBeta = angles.beta;
    arc.lastRadius = angles.radius;

    this.eventBus.emit(ArcCameraEvents.CREATED, {
      entityId: entity.id,
      alpha: angles.alpha,
      beta: angles.beta,
      radius: angles.radius,
      target: [...seedTarget] as Vec3,
    });
  }
}
