/**
 * DirectionalLight.core.ts — pure data Component for directional lighting.
 * Zero imports from @babylonjs, three, or the DOM.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, DirectionalLightSpec, LightHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

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
  autoCreate?: boolean;
}

function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, -1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export class DirectionalLightComponent extends Component {
  direction: Vec3;
  position: Vec3;
  intensity: number;
  diffuse: Color;
  specular: Color;
  shadowEnabled: boolean;
  shadowMinZ: number;
  shadowMaxZ: number;
  shadowMapSize: number;
  autoCreate: boolean;

  handle?: LightHandle;
  initialized = false;

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
      autoCreate: this.autoCreate,
    };
  }
}
