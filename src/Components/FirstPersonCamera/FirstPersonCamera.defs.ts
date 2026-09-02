/**
 * FirstPersonCamera — definitions.
 *
 * Holds the `FirstPersonCameraComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name FirstPersonCamera in a query, or type an event it
 * listens for, without pulling FirstPersonCamera's behaviour into its own
 * bundle. Import from here, not from FirstPersonCamera.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
/** Rectangle (metres) the camera is clamped to, so it can't leave the room. */
export interface FirstPersonCameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Input shape accepted by the constructor (and the scene JSON). */
export interface FirstPersonCameraInput {
  /** Eye height above the floor, in metres. ~1.7 is a standing adult. */
  eyeHeight?: number;
  /** Start position on the floor plane, `[x, z]`. */
  position?: [number, number];
  /** Initial facing, in radians. 0 looks toward +Z. */
  yaw?: number;
  /** Walk speed, world units / second. */
  moveSpeed?: number;
  /** Turn speed, radians / second (A / D). */
  turnSpeed?: number;
  /**
   * Seconds an auto-approach takes — clicking a machine to walk over to it.
   * Fixed, not distance-based: a click across the hall and a click at your
   * elbow should both read as one gesture. 0.7 is the hand-written room's.
   */
  approachDuration?: number;
  /** Vertical field of view, in radians. */
  fov?: number;
  /** Near clip-plane distance, metres. */
  near?: number;
  /** Far clip-plane distance, metres. */
  far?: number;
  /**
   * When set, the camera position is clamped to this rectangle every frame so
   * the player can't walk through the walls. Inset it from the wall faces by
   * roughly the player's shoulder width. Omit for unbounded movement.
   */
  bounds?: FirstPersonCameraBounds;
  /**
   * Walk collision against the scene's Obstacle footprints: the player slides
   * along cabinets and props instead of walking through them. Default TRUE.
   * `bounds` still applies on top, as the outer belt.
   */
  collide?: boolean;
  /**
   * The player's body radius for that collision, in metres — a shoulder's
   * half-width. Default 0.45.
   */
  radius?: number;
  /**
   * localStorage key under which the live pose (x, z, yaw) is remembered and
   * restored next visit, so a reload puts you back where you were standing.
   * Omit for a fresh start at `position` every time.
   */
  persistKey?: string;
}

export class FirstPersonCameraComponent extends Component {
  eyeHeight: number;
  /** Start position `[x, z]`; the live pose lives on the System's runtime map. */
  startX: number;
  startZ: number;
  yaw: number;
  moveSpeed: number;
  turnSpeed: number;
  approachDuration: number;
  fov: number;
  near: number;
  far: number;
  bounds?: FirstPersonCameraBounds;
  collide: boolean;
  radius: number;
  persistKey?: string;

  constructor(data: FirstPersonCameraInput = {}) {
    super();
    this.eyeHeight = data.eyeHeight ?? 1.7;
    this.startX = data.position?.[0] ?? 0;
    this.startZ = data.position?.[1] ?? 0;
    this.yaw = data.yaw ?? 0;
    this.moveSpeed = data.moveSpeed ?? 3;
    this.turnSpeed = data.turnSpeed ?? 1.8;
    this.approachDuration = data.approachDuration ?? 0.7;
    this.fov = data.fov ?? 1.1;
    this.near = data.near ?? 0.1;
    this.far = data.far ?? 200;
    this.bounds = data.bounds;
    this.collide = data.collide ?? true;
    this.radius = data.radius ?? 0.45;
    this.persistKey = data.persistKey;
  }

  serialize(): FirstPersonCameraInput {
    return {
      eyeHeight: this.eyeHeight,
      position: [this.startX, this.startZ],
      yaw: this.yaw,
      moveSpeed: this.moveSpeed,
      turnSpeed: this.turnSpeed,
      approachDuration: this.approachDuration,
      fov: this.fov,
      near: this.near,
      far: this.far,
      ...(this.bounds ? { bounds: { ...this.bounds } } : {}),
      collide: this.collide,
      radius: this.radius,
      ...(this.persistKey ? { persistKey: this.persistKey } : {}),
    };
  }
}
