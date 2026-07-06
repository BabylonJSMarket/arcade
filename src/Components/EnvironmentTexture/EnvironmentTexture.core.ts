/**
 * EnvironmentTexture.core.ts — pure data Component for image-based lighting.
 *
 * Points the scene at a prefiltered cubemap URL (Babylon `.env`, Three
 * `.hdr` + PMREM, etc.). The system applies it on init and clears it on
 * detach. Most PBR materials in the scene then reflect the environment
 * (metallic balls, polished floors). Without this, PBR meshes look flat.
 *
 * A `preset` fills url + level from a named lighting setup, so a scene can say
 * `{ preset: 'studio' }` and get the marketplace asset-render HDRI without
 * knowing the URL. Pair with a ToneMapping component for the full filmic look.
 */

import { Component } from '@babylonjsmarket/ecs';

/** Named lighting presets (url + level). Explicit url/level always win. */
const PRESETS = {
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
