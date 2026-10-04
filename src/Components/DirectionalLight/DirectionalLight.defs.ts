/**
 * DirectionalLight — definitions.
 *
 * Holds the `DirectionalLightComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name DirectionalLight in a query, or type an event it
 * listens for, without pulling DirectionalLight's behaviour into its own
 * bundle. Import from here, not from DirectionalLight.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, DirectionalLightSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface DirectionalLightInput {
  direction?: Vec3;
  position?: Vec3;
  intensity?: number;
  diffuse?: Color;
  specular?: Color;
  shadowEnabled?: boolean;
  shadowMinZ?: number;
  shadowMaxZ?: number;
  shadowMapSize?: number;
  /**
   * Half-width, world units, of the square the shadow map covers. Omit it for
   * the renderer's default (Babylon ±25). Set it to about the size of what
   * casts shadows: the map's texels are spread over 2·shadowExtent, so a
   * 2.5 m table under the default gets shadows a centimetre per texel.
   */
  shadowExtent?: number;
  autoCreate?: boolean;
}

export function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, -1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export class DirectionalLightComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in DirectionalLight must still match a copy in the project.
  static componentType = 'DirectionalLight';

  direction: Vec3;
  position: Vec3;
  intensity: number;
  diffuse: Color;
  specular: Color;
  shadowEnabled: boolean;
  shadowMinZ: number;
  shadowMaxZ: number;
  shadowMapSize: number;
  shadowExtent?: number;
  autoCreate: boolean;

  constructor(data: DirectionalLightInput = {}) {
    super();
    this.direction = data.direction ? normalize(cloneVec3(data.direction)) : normalize([-1, -3, -1]);
    this.position = data.position ? cloneVec3(data.position) : [15, 30, 15];
    this.intensity = data.intensity ?? 0.8;
    this.diffuse = data.diffuse ? cloneVec3(data.diffuse) : [1, 1, 1];
    this.specular = data.specular ? cloneVec3(data.specular) : [1, 1, 1];
    this.shadowEnabled = data.shadowEnabled ?? true;
    this.shadowMinZ = data.shadowMinZ ?? 0;
    this.shadowMaxZ = data.shadowMaxZ ?? 100;
    this.shadowMapSize = data.shadowMapSize ?? 1024;
    this.shadowExtent = data.shadowExtent;
    this.autoCreate = data.autoCreate ?? true;
  }

  toSpec(): DirectionalLightSpec {
    return {
      direction: cloneVec3(this.direction),
      position: cloneVec3(this.position),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      shadow: {
        enabled: this.shadowEnabled,
        mapSize: this.shadowMapSize,
        minZ: this.shadowMinZ,
        maxZ: this.shadowMaxZ,
        ...(this.shadowExtent !== undefined ? { extent: this.shadowExtent } : {}),
      },
    };
  }

  serialize(): DirectionalLightInput {
    return {
      direction: cloneVec3(this.direction),
      position: cloneVec3(this.position),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      shadowEnabled: this.shadowEnabled,
      shadowMinZ: this.shadowMinZ,
      shadowMaxZ: this.shadowMaxZ,
      shadowMapSize: this.shadowMapSize,
      ...(this.shadowExtent !== undefined ? { shadowExtent: this.shadowExtent } : {}),
      autoCreate: this.autoCreate,
    };
  }
}