/**
 * NeonSign — definitions.
 *
 * The NeonSign component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * NeonSign in a query or react to what it emits: this file carries no System, so
 * naming NeonSign never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
export interface NeonSignInput {
  /** The words. */
  text?: string;
  /** Tube colour — drives BOTH the lettering and the light it casts. */
  color?: Color;
  /** World position of the sign face. */
  position?: Vec3;
  /** Euler rotation (radians). A sign on a wall faces into the room. */
  rotation?: Vec3;
  /** World height of the lettering, in metres. */
  size?: number;
  /** Brightness of the light it throws. 0 turns the glow off (tube only). */
  glow?: number;
  /** How far that light reaches, in metres. */
  range?: number;
  /**
   * How far in FRONT of the sign face the light sits. A light exactly on the
   * wall mostly lights the wall's back face.
   */
  glowOffset?: number;
  /** Text resolution in CSS pixels. Bigger = crisper up close. */
  fontSize?: number;
}

export function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export class NeonSignComponent extends Component {
  text: string;
  color: Color;
  position: Vec3;
  rotation: Vec3;
  size: number;
  glow: number;
  range: number;
  glowOffset: number;
  fontSize: number;

  constructor(data: NeonSignInput = {}) {
    super();
    this.text = data.text ?? '';
    this.color = data.color ? cloneVec3(data.color) : [1, 0.15, 0.55];
    this.position = data.position ? cloneVec3(data.position) : [0, 2.5, 0];
    this.rotation = data.rotation ? cloneVec3(data.rotation) : [0, 0, 0];
    this.size = data.size ?? 0.45;
    this.glow = data.glow ?? 6;
    this.range = data.range ?? 7;
    this.glowOffset = data.glowOffset ?? 0.35;
    this.fontSize = data.fontSize ?? 96;
  }

  /**
   * Where the glow light sits: `glowOffset` metres out along the sign's facing.
   * Rotation Y of 0 means the sign faces +Z, matching the rest of the package.
   */
  glowPosition(): Vec3 {
    const yaw = this.rotation[1];
    return [
      this.position[0] + Math.sin(yaw) * this.glowOffset,
      this.position[1],
      this.position[2] + Math.cos(yaw) * this.glowOffset,
    ];
  }

  serialize(): NeonSignInput {
    return {
      text: this.text,
      color: cloneVec3(this.color),
      position: cloneVec3(this.position),
      rotation: cloneVec3(this.rotation),
      size: this.size,
      glow: this.glow,
      range: this.range,
      glowOffset: this.glowOffset,
      fontSize: this.fontSize,
    };
  }
}