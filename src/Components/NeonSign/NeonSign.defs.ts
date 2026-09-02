/**
 * NeonSign — definitions.
 *
 * Holds the `NeonSignComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name NeonSign in a query, or type an event it listens for, without pulling
 * NeonSign's behaviour into its own bundle. Import from here, not from
 * NeonSign.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { spotDirection } from './NeonSign.core';

/** What throws the sign's wash into the room. */
export type NeonSignLightKind = 'point' | 'spot';

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
  /**
   * The light's shape. `'point'` (default) radiates every way from in front
   * of the sign; `'spot'` is a cone aimed along the sign's facing and tilted
   * down, so the wash lands on the cabinets and floor rather than the ceiling
   * and the wall the sign hangs on.
   */
  lightKind?: NeonSignLightKind;
  /** Spot only: full cone aperture, radians. Default 0.95π — almost a hemisphere. */
  spotAngle?: number;
  /** Spot only: edge falloff sharpness. Default 2, a soft rim. */
  spotExponent?: number;
  /**
   * Real extruded lettering instead of a rasterised quad. Needs the
   * `neonText` adapter plugin registered on the renderer
   * (`registerBabylonNeonTextExtension`); without one the sign quietly draws
   * the quad instead. Default false.
   */
  extruded?: boolean;
  /** Extruded only: slab depth in metres. Default 0.08. */
  depth?: number;
  /** Extruded only: URL of a facetype.js font JSON. Default `/fonts/neon.json`. */
  fontUrl?: string;
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
  lightKind: NeonSignLightKind;
  spotAngle: number;
  spotExponent: number;
  extruded: boolean;
  depth: number;
  fontUrl: string;

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
    this.lightKind = data.lightKind ?? 'point';
    this.spotAngle = data.spotAngle ?? Math.PI * 0.95;
    this.spotExponent = data.spotExponent ?? 2;
    this.extruded = data.extruded ?? false;
    this.depth = data.depth ?? 0.08;
    this.fontUrl = data.fontUrl ?? '/fonts/neon.json';
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

  /** Where a spot aims: along the facing, tilted 0.4 down, unit length. */
  spotDirection(): Vec3 {
    return spotDirection(this.rotation[1]);
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
      lightKind: this.lightKind,
      spotAngle: this.spotAngle,
      spotExponent: this.spotExponent,
      extruded: this.extruded,
      depth: this.depth,
      fontUrl: this.fontUrl,
    };
  }
}
