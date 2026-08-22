/**
 * EnvironmentTexture — definitions.
 *
 * The EnvironmentTexture component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * EnvironmentTexture in a query or react to what it emits: this file carries no System, so
 * naming EnvironmentTexture never drags its behaviour into your bundle.
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