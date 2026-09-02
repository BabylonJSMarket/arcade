/**
 * AmbientOcclusion — definitions.
 *
 * Holds the `AmbientOcclusionComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name AmbientOcclusion in a query, or type an event it
 * listens for, without pulling AmbientOcclusion's behaviour into its own
 * bundle. Import from here, not from AmbientOcclusion.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { AmbientOcclusionSettings } from './AmbientOcclusion.core';

export interface AmbientOcclusionInput {
  /** World-space radius the occlusion is sampled over. Default 0.8 — cabinet-foot scale. */
  radius?: number;
  /** How dark the corners get; 1 = the engine's full strength. Default 1. */
  strength?: number;
  /** Samples per pixel. 8 is a quiet, cheap pass; 16–32 for a still render. Default 8. */
  samples?: number;
  /** Depth beyond which nothing is occluded, so the far wall stays clean. Default 40. */
  maxZ?: number;
  /** Floor under the darkening — shadows never go fully black. Default 0.1. */
  base?: number;
  /** Blur pass resolution relative to the screen. Default 1. */
  blurRatio?: number;
  /** Occlusion pass resolution relative to the screen — half-res is the usual trade. Default 0.5. */
  ssaoRatio?: number;
  /** Off switch that keeps the settings. Default true. */
  enabled?: boolean;
}

export class AmbientOcclusionComponent extends Component {
  radius: number;
  strength: number;
  samples: number;
  maxZ: number;
  base: number;
  blurRatio: number;
  ssaoRatio: number;

  constructor(data: AmbientOcclusionInput = {}) {
    super();
    this.radius = data.radius ?? 0.8;
    this.strength = data.strength ?? 1.0;
    this.samples = data.samples ?? 8;
    this.maxZ = data.maxZ ?? 40;
    this.base = data.base ?? 0.1;
    this.blurRatio = data.blurRatio ?? 1.0;
    this.ssaoRatio = data.ssaoRatio ?? 0.5;
    // `enabled` is the base Component accessor; setting it here (no bus yet) is silent.
    this.enabled = data.enabled ?? true;
  }

  /** The values the plugin needs, in one object. */
  settings(): AmbientOcclusionSettings {
    return {
      radius: this.radius,
      strength: this.strength,
      samples: this.samples,
      maxZ: this.maxZ,
      base: this.base,
      blurRatio: this.blurRatio,
      ssaoRatio: this.ssaoRatio,
    };
  }

  serialize(): AmbientOcclusionInput {
    return {
      radius: this.radius,
      strength: this.strength,
      samples: this.samples,
      maxZ: this.maxZ,
      base: this.base,
      blurRatio: this.blurRatio,
      ssaoRatio: this.ssaoRatio,
      enabled: this.enabled,
    };
  }
}
