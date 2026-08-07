/**
 * PointLight.core.ts — pure data Component for a positioned, falling-off light.
 *
 * The lamp in the room: a bulb, a fire, the glow bleeding off a neon sign. It
 * has a PLACE and a REACH, which is what separates it from HemisphericLight
 * (ambient everywhere) and DirectionalLight (parallel rays, no position).
 *
 * Zero imports from @babylonjs, three, or the DOM. The System drives the
 * adapter with this data.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, PointLightSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface PointLightInput {
  position?: Vec3;
  intensity?: number;
  diffuse?: Color;
  specular?: Color;
  /**
   * Distance at which this light stops contributing. Leave at the default
   * rather than 0 unless you want unbounded falloff: a bounded light is what
   * lets a room hold many small lamps without every one of them being
   * evaluated for every surface.
   */
  range?: number;
}

function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export class PointLightComponent extends Component {
  position: Vec3;
  intensity: number;
  diffuse: Color;
  specular: Color;
  range: number;

  constructor(data: PointLightInput = {}) {
    super();
    this.position = data.position ? cloneVec3(data.position) : [0, 2, 0];
    this.intensity = data.intensity ?? 1;
    this.diffuse = data.diffuse ? cloneVec3(data.diffuse) : [1, 1, 1];
    // Point lights in a stylized room are usually about COLOR BOUNCE, not
    // glinting highlights, so specular defaults off — matching how the other
    // light components in this package default it.
    this.specular = data.specular ? cloneVec3(data.specular) : [0, 0, 0];
    this.range = data.range ?? 10;
  }

  toSpec(): PointLightSpec {
    return {
      position: cloneVec3(this.position),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      range: this.range,
    };
  }

  serialize(): PointLightInput {
    return {
      position: cloneVec3(this.position),
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      range: this.range,
    };
  }
}
