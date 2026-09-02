/**
 * GlowLayer — definitions.
 *
 * Holds the `GlowLayerComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name GlowLayer in a query, or type an event it listens for, without
 * pulling GlowLayer's behaviour into its own bundle. Import from here, not
 * from GlowLayer.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { GlowSpec } from '@babylonjsmarket/ecs/renderer-types';

export interface GlowLayerInput {
  /** How far the bloom bleeds. Default 0.45 — enough for a CRT, short of a smear. */
  intensity?: number;
  /**
   * Size of the glow's render target relative to the screen. Lower is cheaper
   * and blurrier — 0.25 is plenty for tubes and screens. Default 0.25.
   */
  textureRatio?: number;
  /** MSAA samples on the glow target. Leave unset for the engine default (1). */
  samples?: number;
  /** Off switch that keeps the settings. Default true. */
  enabled?: boolean;
  /**
   * Enrol every mesh the scene creates (MeshPrimitive boxes, loaded GLBs) so
   * anything with an emissive material blooms. Default true. Set false to run
   * an empty layer and whitelist meshes yourself from another system.
   */
  includeEmissive?: boolean;
}

export class GlowLayerComponent extends Component {
  intensity: number;
  textureRatio: number;
  samples?: number;
  includeEmissive: boolean;

  constructor(data: GlowLayerInput = {}) {
    super();
    this.intensity = data.intensity ?? 0.45;
    this.textureRatio = data.textureRatio ?? 0.25;
    this.samples = data.samples;
    // `enabled` is the base Component accessor; setting it here (no bus yet) is silent.
    this.enabled = data.enabled ?? true;
    this.includeEmissive = data.includeEmissive ?? true;
  }

  toSpec(): GlowSpec {
    const spec: GlowSpec = { intensity: this.intensity, textureRatio: this.textureRatio };
    if (this.samples !== undefined) spec.samples = this.samples;
    return spec;
  }

  serialize(): GlowLayerInput {
    const out: GlowLayerInput = {
      intensity: this.intensity,
      textureRatio: this.textureRatio,
      enabled: this.enabled,
      includeEmissive: this.includeEmissive,
    };
    if (this.samples !== undefined) out.samples = this.samples;
    return out;
  }
}
