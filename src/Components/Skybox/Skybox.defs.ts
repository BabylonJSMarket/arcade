/**
 * Skybox — definitions.
 *
 * Holds the `SkyboxComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Skybox in a query, or type an event it listens for, without pulling
 * Skybox's behaviour into its own bundle. Import from here, not from
 * Skybox.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, SkyboxSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface SkyboxInput {
  zenithColor?: Color;
  horizonColor?: Color;
  groundColor?: Color;
  sunColor?: Color;
  /**
   * Direction TO the sun (will be normalized). Defaults to a low golden-hour
   * angle. Ignored at runtime when `followLight` is set.
   */
  sunDirection?: Vec3;
  /** Disc sharpness in [0,1]. Higher = smaller, harder sun disc. */
  sunSize?: number;
  /** Halo falloff. Higher = tighter glow. */
  sunGlowSize?: number;
  /** Diameter of the dome in world units. */
  size?: number;
  /**
   * If set, the SkyboxSystem looks up an entity with the given tag (or with
   * a DirectionalLightComponent if `"auto"`) and uses the NEGATIVE of that
   * light's direction as the sun direction every frame — so sky and shadow
   * angle stay in sync as you fiddle with the sun.
   */
  followLight?: string | 'auto';
}

export function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export class SkyboxComponent extends Component {
  zenithColor: Color;
  horizonColor: Color;
  groundColor: Color;
  sunColor: Color;
  sunDirection: Vec3;
  sunSize: number;
  sunGlowSize: number;
  size: number;
  followLight?: string | 'auto';

  constructor(data: SkyboxInput = {}) {
    super();
    // Default palette: cinematic sunset — deep navy zenith, warm-amber horizon,
    // muted plum ground, golden sun. Looks good with the default
    // DirectionalLight angle in our templates.
    this.zenithColor = data.zenithColor ? cloneVec3(data.zenithColor) : [0.08, 0.12, 0.28];
    this.horizonColor = data.horizonColor ? cloneVec3(data.horizonColor) : [0.95, 0.55, 0.32];
    this.groundColor = data.groundColor ? cloneVec3(data.groundColor) : [0.12, 0.08, 0.16];
    this.sunColor = data.sunColor ? cloneVec3(data.sunColor) : [1.0, 0.85, 0.65];
    this.sunDirection = data.sunDirection ? cloneVec3(data.sunDirection) : [0.4, 0.18, 0.2];
    this.sunSize = data.sunSize ?? 0.9994;
    this.sunGlowSize = data.sunGlowSize ?? 80;
    this.size = data.size ?? 800;
    this.followLight = data.followLight;
  }

  toSpec(): SkyboxSpec {
    return {
      zenithColor: cloneVec3(this.zenithColor),
      horizonColor: cloneVec3(this.horizonColor),
      groundColor: cloneVec3(this.groundColor),
      sunColor: cloneVec3(this.sunColor),
      sunDirection: cloneVec3(this.sunDirection),
      sunSize: this.sunSize,
      sunGlowSize: this.sunGlowSize,
      size: this.size,
    };
  }

  serialize(): SkyboxInput {
    return {
      zenithColor: cloneVec3(this.zenithColor),
      horizonColor: cloneVec3(this.horizonColor),
      groundColor: cloneVec3(this.groundColor),
      sunColor: cloneVec3(this.sunColor),
      sunDirection: cloneVec3(this.sunDirection),
      sunSize: this.sunSize,
      sunGlowSize: this.sunGlowSize,
      size: this.size,
      followLight: this.followLight,
    };
  }
}