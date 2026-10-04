/**
 * SpotLight — definitions.
 *
 * Holds the `SpotLightComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name SpotLight in a query, or type an event it listens for, without
 * pulling SpotLight's behaviour into its own bundle. Import from here, not
 * from SpotLight.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, SpotLightSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface SpotLightInput {
  /** Where the cone starts. Default [0, 3, 0] — a ceiling can-light. */
  position?: Vec3;
  /** Which way it points (need not be unit). Default [0, -1, 0], straight down. */
  direction?: Vec3;
  /**
   * Full cone aperture in radians — the whole cone, not the half-angle. Default
   * π/3 (60°): a tidy puddle on one machine. Push it toward π for a wash that
   * lights the wall around a sign rather than a beam.
   */
  angle?: number;
  /**
   * How hard the edge of the pool is. Higher = a crisp circle, lower = a soft
   * fade from centre to rim. Default 2.
   */
  exponent?: number;
  intensity?: number;
  diffuse?: Color;
  specular?: Color;
  /**
   * Distance at which the light stops contributing. Default 10 — bounded on
   * purpose: a spot is a LOCAL accent, and an unbounded one would leak down
   * a whole corridor while still counting against every material's light cap.
   */
  range?: number;
}

function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export class SpotLightComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in SpotLight must still match a copy in the project.
  static componentType = 'SpotLight';

  position: Vec3;
  direction: Vec3;
  angle: number;
  exponent: number;
  intensity: number;
  diffuse: Color;
  specular: Color;
  range: number;

  constructor(data: SpotLightInput = {}) {
    super();
    this.position = data.position ? cloneVec3(data.position) : [0, 3, 0];
    this.direction = data.direction ? cloneVec3(data.direction) : [0, -1, 0];
    this.angle = data.angle ?? Math.PI / 3;
    this.exponent = data.exponent ?? 2;
    this.intensity = data.intensity ?? 1;
    this.diffuse = data.diffuse ? cloneVec3(data.diffuse) : [1, 1, 1];
    // A spot in a stylized room is a coloured pool on the floor, not a glint
    // on the cabinet's chrome, so specular defaults off — matching how the
    // other light components in this package default it.
    this.specular = data.specular ? cloneVec3(data.specular) : [0, 0, 0];
    this.range = data.range ?? 10;
  }

  toSpec(): SpotLightSpec {
    return {
      position: cloneVec3(this.position),
      direction: cloneVec3(this.direction),
      angle: this.angle,
      exponent: this.exponent,
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      range: this.range,
    };
  }

  serialize(): SpotLightInput {
    return {
      position: cloneVec3(this.position),
      direction: cloneVec3(this.direction),
      angle: this.angle,
      exponent: this.exponent,
      intensity: this.intensity,
      diffuse: cloneVec3(this.diffuse),
      specular: cloneVec3(this.specular),
      range: this.range,
    };
  }
}
