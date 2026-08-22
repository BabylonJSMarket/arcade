/**
 * FirstPersonCamera — definitions.
 *
 * The FirstPersonCamera component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * FirstPersonCamera in a query or react to what it emits: this file carries no System, so
 * naming FirstPersonCamera never drags its behaviour into your bundle.
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
}

export class FirstPersonCameraComponent extends Component {
  eyeHeight: number;
  /** Start position `[x, z]`; the live pose lives on the System's runtime map. */
  startX: number;
  startZ: number;
  yaw: number;
  moveSpeed: number;
  turnSpeed: number;
  fov: number;
  near: number;
  far: number;
  bounds?: FirstPersonCameraBounds;

  constructor(data: FirstPersonCameraInput = {}) {
    super();
    this.eyeHeight = data.eyeHeight ?? 1.7;
    this.startX = data.position?.[0] ?? 0;
    this.startZ = data.position?.[1] ?? 0;
    this.yaw = data.yaw ?? 0;
    this.moveSpeed = data.moveSpeed ?? 3;
    this.turnSpeed = data.turnSpeed ?? 1.8;
    this.fov = data.fov ?? 1.1;
    this.near = data.near ?? 0.1;
    this.far = data.far ?? 200;
    this.bounds = data.bounds;
  }

  serialize(): FirstPersonCameraInput {
    return {
      eyeHeight: this.eyeHeight,
      position: [this.startX, this.startZ],
      yaw: this.yaw,
      moveSpeed: this.moveSpeed,
      turnSpeed: this.turnSpeed,
      fov: this.fov,
      near: this.near,
      far: this.far,
      ...(this.bounds ? { bounds: { ...this.bounds } } : {}),
    };
  }
}