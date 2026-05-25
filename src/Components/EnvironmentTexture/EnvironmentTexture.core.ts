/**
 * EnvironmentTexture.core.ts — pure data Component for image-based lighting.
 *
 * Points the scene at a prefiltered cubemap URL (Babylon `.env`, Three
 * `.hdr` + PMREM, etc.). The system applies it on init and clears it on
 * detach. Most PBR materials in the scene then reflect the environment
 * (metallic balls, polished floors). Without this, PBR meshes look flat.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface EnvironmentTextureInput {
  /** URL of the prefiltered cubemap (one per renderer; see adapter docs). */
  url: string;
  /** Reflection strength multiplier. 1.0 = neutral; higher = brighter IBL. */
  level?: number;
}

export class EnvironmentTextureComponent extends Component {
  url: string;
  level: number;

  constructor(data: EnvironmentTextureInput = { url: '' }) {
    super();
    this.url = data.url ?? '';
    this.level = data.level ?? 1.0;
  }

  serialize(): EnvironmentTextureInput {
    return { url: this.url, level: this.level };
  }
}
