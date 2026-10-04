/**
 * ArcCamera — definitions.
 *
 * Holds the `ArcCameraComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name ArcCamera in a query, or type an event it listens for, without
 * pulling ArcCamera's behaviour into its own bundle. Import from here, not
 * from ArcCamera.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { ArcCameraSpec, CameraHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface ArcCameraInput {
  /** Entity the camera tracks when `follow` is true (kept centred). */
  target?: string;
  /**
   * Entity the camera centres on when `follow` is FALSE. If omitted, turning
   * follow off leaves the camera free (it holds its last look point and can be
   * panned). Used by pinball so "not following" frames the table while
   * "following" tracks the ball.
   */
  restTarget?: string;
  /**
   * When true, the camera keeps `target` centred each frame. When false it
   * centres `restTarget` (if set) or stays put, and `targetOffset` pans it.
   * Default true.
   */
  follow?: boolean;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  minBeta?: number;
  maxBeta?: number;
  allowBelowGround?: boolean;
  alpha?: number;
  beta?: number;
  inertia?: number;
  panningInertia?: number;
  wheelPrecision?: number;
  angularSensibility?: number;
  speed?: number;
  targetOffset?: Vec3;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  /**
   * When false, the renderer detaches mouse controls — the camera ignores
   * orbit/pan/dolly input. Default true. Useful for fixed-camera games
   * (top-down shooter, pinball) where the player shouldn't be able to
   * unhinge the framing by accident.
   */
  controlsEnabled?: boolean;
}

export function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

/**
 * Runtime (non-serializable) state. The camera handle is a live engine
 * reference that can't survive a serialize round-trip, but sibling systems
 * (CameraFollow, KeyboardMover, PinballCamera, TwinStickShooter) read it via
 * `component.handle` — so it's backed by this module-level WeakMap and exposed
 * through a getter/setter rather than a private System map. Pooled entities
 * reuse the same Component instance, so the handle survives parking.
 */
export interface ArcCameraRuntime {
  handle?: CameraHandle;
  initialized: boolean;
  /**
   * Look point held while in free mode (follow off + no restTarget). Captured
   * the frame the camera goes free so panning (targetOffset) moves relative to
   * it; cleared whenever an active target is tracked again.
   */
  freeBase?: Vec3;
}

export const runtimeByComponent = new WeakMap<ArcCameraComponent, ArcCameraRuntime>();

export function getArcCameraRuntime(comp: ArcCameraComponent): ArcCameraRuntime {
  let rt = runtimeByComponent.get(comp);
  if (!rt) {
    rt = { initialized: false };
    runtimeByComponent.set(comp, rt);
  }
  return rt;
}

export class ArcCameraComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in ArcCamera must still match a copy in the project.
  static componentType = 'ArcCamera';

  target?: string;
  restTarget?: string;
  follow: boolean;

  distance: number;
  minDistance: number;
  maxDistance: number;

  minBeta: number;
  maxBeta: number;
  allowBelowGround: boolean;

  alpha: number;
  beta: number;

  inertia: number;
  panningInertia: number;
  wheelPrecision: number;
  angularSensibility: number;

  speed: number;

  targetOffset: Vec3;

  autoRotate: boolean;
  autoRotateSpeed: number;
  controlsEnabled: boolean;

  // Change-detection snapshots; updated by the System after each adapter read.
  lastAlpha = 0;
  lastBeta = 0;
  lastRadius = 0;

  /** Live engine camera handle, backed by {@link getArcCameraRuntime}. */
  get handle(): CameraHandle | undefined {
    return getArcCameraRuntime(this).handle;
  }
  set handle(value: CameraHandle | undefined) {
    getArcCameraRuntime(this).handle = value;
  }

  constructor(data: ArcCameraInput = {}) {
    super();
    this.target = data.target;
    this.restTarget = data.restTarget;
    this.follow = data.follow ?? true;
    this.distance = data.distance ?? 15;
    this.minDistance = data.minDistance ?? 5;
    this.maxDistance = data.maxDistance ?? 50;
    this.allowBelowGround = data.allowBelowGround ?? false;
    this.minBeta = data.minBeta ?? 0.1;
    this.maxBeta = data.maxBeta ?? (this.allowBelowGround ? Math.PI - 0.1 : Math.PI / 2 - 0.1);
    this.alpha = data.alpha ?? Math.PI / 2;
    this.beta = data.beta ?? Math.PI / 3;
    this.inertia = data.inertia ?? 0.9;
    this.panningInertia = data.panningInertia ?? 0.9;
    this.wheelPrecision = data.wheelPrecision ?? 50;
    this.angularSensibility = data.angularSensibility ?? 1000;
    this.speed = data.speed ?? 1;
    this.targetOffset = data.targetOffset ? cloneVec3(data.targetOffset) : [0, 0, 0];
    this.autoRotate = data.autoRotate ?? false;
    this.autoRotateSpeed = data.autoRotateSpeed ?? 0.5;
    this.controlsEnabled = data.controlsEnabled ?? true;
  }

  toSpec(): ArcCameraSpec {
    return {
      alpha: this.alpha,
      beta: this.beta,
      radius: this.distance,
      minRadius: this.minDistance,
      maxRadius: this.maxDistance,
      minBeta: this.minBeta,
      maxBeta: this.maxBeta,
      target: [0, 0, 0],
      inertia: this.inertia,
      wheelPrecision: this.wheelPrecision,
      angularSensibility: this.angularSensibility,
      controlsEnabled: this.controlsEnabled,
    };
  }

  serialize(): ArcCameraInput {
    return {
      target: this.target,
      restTarget: this.restTarget,
      follow: this.follow,
      distance: this.distance,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      minBeta: this.minBeta,
      maxBeta: this.maxBeta,
      allowBelowGround: this.allowBelowGround,
      alpha: this.alpha,
      beta: this.beta,
      inertia: this.inertia,
      panningInertia: this.panningInertia,
      wheelPrecision: this.wheelPrecision,
      angularSensibility: this.angularSensibility,
      speed: this.speed,
      targetOffset: cloneVec3(this.targetOffset),
      autoRotate: this.autoRotate,
      autoRotateSpeed: this.autoRotateSpeed,
      controlsEnabled: this.controlsEnabled,
    };
  }
}