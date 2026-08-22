/**
 * HemisphericLight — definitions.
 *
 * Holds the `HemisphericLightComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name HemisphericLight in a query, or type an event it
 * listens for, without pulling HemisphericLight's behaviour into its own
 * bundle. Import from here, not from HemisphericLight.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, HemisphericLightSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface HemisphericLightInput {
  direction?: Vec3;
  intensity?: number;
  diffuse?: Color;
  groundColor?: Color;
  specular?: Color;
}

export function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export class HemisphericLightComponent extends Component {
  direction: Vec3;
  intensity: number;
  diffuse: Color;
  groundColor: Color;
  specular: Color;

  constructor(data: HemisphericLightInput = {}) {
    super();
    this.direction = data.direction ? normalize(cloneVec3(data.direction)) : [0, 1, 0];
    this.intensity = data.intensity ?? 0.3;
    this.diffuse = data.diffuse ? cloneVec3(data.diffuse) : [1, 1, 1];
    this.groundColor = data.groundColor ? cloneVec3(data.groundColor) : [0.2, 0.2, 0.2];
    this.specular = data.specular ? cloneVec3(data.specular) : [0, 0, 0];
  }

  toSpec(): HemisphericLightSpec {
    return {
      direction: cloneVec3(this.direction),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      groundColor: cloneVec3(this.groundColor),
      specular: cloneVec3(this.specular),
    };
  }

  serialize(): HemisphericLightInput {
    return {
      direction: cloneVec3(this.direction),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      groundColor: cloneVec3(this.groundColor),
      specular: cloneVec3(this.specular),
    };
  }
}