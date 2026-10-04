/**
 * EnvironmentTexture — definitions.
 *
 * Holds the `EnvironmentTextureComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name EnvironmentTexture in a query, or type an event it
 * listens for, without pulling EnvironmentTexture's behaviour into its own
 * bundle. Import from here, not from EnvironmentTexture.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
/** Named lighting presets (url + level). Explicit url/level always win. */
export const PRESETS = {
  /** The neutral studio HDRI used by the marketplace figure-render pipeline. */
  studio: {
    url: 'https://assets.babylonjs.com/environments/studio.env',
    level: 1.15,
  },
} as const;

export type EnvironmentPreset = keyof typeof PRESETS;

export interface EnvironmentTextureInput {
  /** URL of the prefiltered cubemap (one per renderer). Optional with `preset`. */
  url?: string;
  /** Reflection strength multiplier. 1.0 = neutral; higher = brighter IBL. */
  level?: number;
  /** Named preset that fills url + level (e.g. 'studio'). */
  preset?: EnvironmentPreset;
}

export class EnvironmentTextureComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in EnvironmentTexture must still match a copy in the project.
  static componentType = 'EnvironmentTexture';

  url: string;
  level: number;
  preset?: EnvironmentPreset;

  constructor(data: EnvironmentTextureInput = {}) {
    super();
    const p = data.preset ? PRESETS[data.preset] : undefined;
    this.preset = data.preset;
    this.url = data.url ?? p?.url ?? '';
    this.level = data.level ?? p?.level ?? 1.0;
  }

  serialize(): EnvironmentTextureInput {
    const out: EnvironmentTextureInput = { url: this.url, level: this.level };
    if (this.preset) out.preset = this.preset;
    return out;
  }
}