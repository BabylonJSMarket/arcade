/**
 * ArcCamera.ts — renderer-agnostic System for an orbit-style camera.
 * Drives world.renderer.createArcCamera / setCameraTarget / getCameraAngles.
 *
 * Target-follow subscribes to meshprimitive.created events (renderer-agnostic
 * payload now carries `{ entityId, handle }`) and stores the MeshHandle. Each
 * frame it reads the target's world position via the adapter and lerps the
 * camera target toward it.
 */

import { ArcCameraEvents, MeshPrimitiveEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { MeshHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import {
  ArcCameraComponent,
  type ArcCameraInput,
  type ArcCameraRuntime,
  getArcCameraRuntime,
} from './ArcCamera.defs';

export { ArcCameraComponent, type ArcCameraInput };



export class ArcCameraSystem extends System {
  protected query = { required: [ArcCameraComponent] };
  private targetHandles = new Map<string, MeshHandle>();
  private idleTime = 0;
  private idleThreshold = 3;

  // Reused per-frame tuples
  private _tempMeshPos: Vec3 = [0, 0, 0];
  private _tempCamTarget: Vec3 = [0, 0, 0];

  private getRuntime(comp: ArcCameraComponent): ArcCameraRuntime {
    return getArcCameraRuntime(comp);
  }

  constructor(eventBus: EventBus) {
    super(eventBus);
    this._pauseable = false;
  }

  protected onInitialize(): void {
    this.listen(MeshPrimitiveEvents.CREATED, (data: { entityId: string; handle: MeshHandle }) => {
      if (data?.entityId && data.handle) {
        this.targetHandles.set(data.entityId, data.handle);
      }
    });

    for (const entity of this.entities) {
      this.ensureCamera(entity);
    }
  }

  protected onShutdown(): void {
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
      if (!arc) continue;
      const rt = this.getRuntime(arc);
      if (!rt.handle || !rt.initialized) continue;

      // Zoom: a locked camera (controls off — shooter, pinball) takes its
      // radius from `distance` each frame, so the control panel owns the zoom
      // and it can't drift. Free-orbit cameras keep their wheel radius.
      if (!arc.controlsEnabled) {
        r.setCameraRadius(rt.handle, arc.distance);
        r.setCameraRadiusLimits(rt.handle, arc.distance, arc.distance);
      }

      // Centre point. follow → track `target`; otherwise centre `restTarget`
      // (if set) or hold a captured free base. `targetOffset` always pans the
      // view (an offset from whatever we're centred on) — leave it at 0 to keep
      // the followed target dead-centre.
      const activeName = arc.follow ? arc.target : arc.restTarget;
      const activeHandle = activeName ? this.resolveTargetHandle(activeName) : undefined;
      let base: Vec3 | undefined;
      if (activeHandle) {
        r.getMeshWorldPosition(activeHandle, this._tempMeshPos);
        base = this._tempMeshPos;
        rt.freeBase = undefined;
      } else if (arc.target || arc.restTarget) {
        // Free mode (or the active target's mesh isn't ready yet): hold the
        // current look point so panning moves relative to it.
        if (!rt.freeBase) {
          r.getCameraTarget(rt.handle, this._tempCamTarget);
          rt.freeBase = [this._tempCamTarget[0], this._tempCamTarget[1], this._tempCamTarget[2]];
        }
        base = rt.freeBase;
      }
      if (base) {
        // Capture the intended radius BEFORE re-targeting. On an ArcRotate
        // camera, setCameraTarget keeps the world POSITION fixed and recomputes
        // the radius from it — so re-aiming at a MOVING followed target grows
        // `radius` every frame and the camera never repositions (the target
        // recedes and gets smaller). Restoring the pre-target radius snaps the
        // camera to the same distance from the NEW target — the chase — and
        // preserves user zoom (locked or free), with no feedback into `distance`.
        const preRadius = r.getCameraAngles(rt.handle).radius;
        r.setCameraTarget(
          rt.handle,
          base[0] + arc.targetOffset[0],
          base[1] + arc.targetOffset[1],
          base[2] + arc.targetOffset[2],
        );
        r.setCameraRadius(rt.handle, preRadius);
      }

      const angles = r.getCameraAngles(rt.handle);
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
            r.nudgeCameraAlpha(rt.handle, arc.autoRotateSpeed * deltaTime);
            arc.lastAlpha = r.getCameraAngles(rt.handle).alpha;
          }
        }
      }
    }
  }

  /**
   * Live mesh handle of a target entity. Reads it straight off the target's
   * MeshPrimitive (a getter backed by the system's runtime slot), so following
   * never depends on having caught the `meshprimitive.created` event before the
   * mesh was built — that ordering is not guaranteed. Falls back to the event
   * map for any target that has no MeshPrimitive.
   */
  private resolveTargetHandle(name: string): MeshHandle | undefined {
    const e = this.world?.getEntity(name);
    return e?.get(MeshPrimitiveComponent)?.handle ?? this.targetHandles.get(name);
  }

  private ensureCamera(entity: Entity): void {
    const arc = entity.get(ArcCameraComponent);
    if (!arc) return;
    const rt = this.getRuntime(arc);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    // Seed the camera target from the active target's mesh if available
    // (the followed target, or the rest target when not following); else origin.
    const seedTarget: Vec3 = [0, 0, 0];
    const seedName = arc.follow ? arc.target : (arc.restTarget ?? arc.target);
    if (seedName) {
      const h = this.resolveTargetHandle(seedName);
      if (h) {
        r.getMeshWorldPosition(h, seedTarget);
        seedTarget[0] += arc.targetOffset[0];
        seedTarget[1] += arc.targetOffset[1];
        seedTarget[2] += arc.targetOffset[2];
      }
    }
    const spec = arc.toSpec();
    spec.target = seedTarget;

    rt.handle = r.createArcCamera(entity.id, spec);
    rt.initialized = true;
    const angles = r.getCameraAngles(rt.handle);
    arc.lastAlpha = angles.alpha;
    arc.lastBeta = angles.beta;
    arc.lastRadius = angles.radius;

    this.eventBus.emit(ArcCameraEvents.CREATED, {
      entityId: entity.id,
      alpha: angles.alpha,
      beta: angles.beta,
      radius: angles.radius,
      target: [...seedTarget] as Vec3,
      // The renderer handle, so a listener (Sound's audio listener) can attach
      // to the camera without reaching into this System.
      handle: rt.handle,
    });
  }
}
