/**
 * ToneMapping — definitions.
 *
 * Holds the `ToneMappingComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name ToneMapping in a query, or type an event it listens for, without
 * pulling ToneMapping's behaviour into its own bundle. Import from here, not
 * from ToneMapping.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
/** Tone-mapping curve. 'aces' is the filmic default; 'none' disables it. */
export type ToneMappingMode = 'aces' | 'standard' | 'none';

export interface ToneMappingInput {
  /** Curve applied to HDR colour. Default 'aces'. */
  mode?: ToneMappingMode;
  /** Linear exposure multiplier before the curve. Default 1.05. */
  exposure?: number;
  /** Post-curve contrast; 1 = neutral. Default 1.05. */
  contrast?: number;
}

/** Resolved settings the adapter plugin consumes. */
export interface ToneMappingSettings {
  mode: ToneMappingMode;
  exposure: number;
  contrast: number;
}

/** Name the plugin registers under and the System looks up. */
export const TONE_MAPPING_EXTENSION = 'toneMapping';

/** Shape of the registered adapter plugin. */
export interface ToneMappingExtension {
  apply(settings: ToneMappingSettings): void;
  clear(): void;
}

export class ToneMappingComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in ToneMapping must still match a copy in the project.
  static componentType = 'ToneMapping';

  mode: ToneMappingMode;
  exposure: number;
  contrast: number;

  constructor(data: ToneMappingInput = {}) {
    super();
    this.mode = data.mode ?? 'aces';
    this.exposure = data.exposure ?? 1.05;
    this.contrast = data.contrast ?? 1.05;
  }

  /** The values the plugin needs, in one object. */
  settings(): ToneMappingSettings {
    return { mode: this.mode, exposure: this.exposure, contrast: this.contrast };
  }

  serialize(): ToneMappingInput {
    return { mode: this.mode, exposure: this.exposure, contrast: this.contrast };
  }
}