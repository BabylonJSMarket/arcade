/**
 * Sound — definitions.
 *
 * Holds the `SoundComponent` class and the shapes its data and events travel
 * in. No System lives here, which is the point: another component can name
 * Sound in a query, or type an event it listens for, without pulling Sound's
 * behaviour into its own bundle. Import from here, not from Sound.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { SoundSpec } from '@babylonjsmarket/ecs/renderer-types';

/** WebAudio distance model — how volume falls off between min and max distance. */
export type SoundDistanceModel = 'linear' | 'inverse' | 'exponential';

export interface SoundInput {
  /** App-resolved URL of the clip. Empty = nothing to play (a placeholder slot). */
  src?: string;
  /** Loop the clip. Default false. */
  loop?: boolean;
  /**
   * Start as soon as the clip is loaded. Default true. Browsers hold audio
   * behind a user gesture, so an autoplay may sit silent until the first
   * click — the System retries then, nothing throws.
   */
  autoplay?: boolean;
  /** Gain. 1 = as recorded; the engine may allow more. Default 1. */
  volume?: number;
  /**
   * Positional: the sound has a place in the world — its own entity's mesh —
   * and pans and attenuates from it, so a cabinet's attract loop gets louder
   * as you walk up. Default false: a flat bed heard everywhere at once.
   */
  spatial?: boolean;
  /** Inside this distance the sound plays at full volume. Default 1. */
  minDistance?: number;
  /** Beyond this it attenuates no further (or, for `linear`, is silent). Default 100. */
  maxDistance?: number;
  /** How fast volume falls between the two. Default 1; a hall of cabinets wants ~3. */
  rolloff?: number;
  /** Falloff curve between min and max. Default 'inverse'. */
  distanceModel?: SoundDistanceModel;
  /**
   * Live control. Leave unset and `autoplay` decides; set true/false from a
   * panel or another system and the System plays/stops to match.
   */
  playing?: boolean;
}

export class SoundComponent extends Component {
  src: string;
  loop: boolean;
  autoplay: boolean;
  volume: number;
  spatial: boolean;
  minDistance: number;
  maxDistance: number;
  rolloff: number;
  distanceModel: SoundDistanceModel;
  playing?: boolean;

  constructor(data: SoundInput = {}) {
    super();
    this.src = data.src ?? '';
    this.loop = data.loop ?? false;
    this.autoplay = data.autoplay ?? true;
    this.volume = data.volume ?? 1;
    this.spatial = data.spatial ?? false;
    this.minDistance = data.minDistance ?? 1;
    this.maxDistance = data.maxDistance ?? 100;
    this.rolloff = data.rolloff ?? 1;
    this.distanceModel = data.distanceModel ?? 'inverse';
    this.playing = data.playing;
  }

  /** The adapter's shape: the spatial block is present only for a positional sound. */
  toSpec(): SoundSpec {
    const spec: SoundSpec = {
      url: this.src,
      loop: this.loop,
      autoplay: this.autoplay,
      volume: this.volume,
    };
    if (this.spatial) {
      spec.spatial = {
        minDistance: this.minDistance,
        maxDistance: this.maxDistance,
        rolloff: this.rolloff,
        distanceModel: this.distanceModel,
      };
    }
    return spec;
  }

  serialize(): SoundInput {
    const out: SoundInput = {
      src: this.src,
      loop: this.loop,
      autoplay: this.autoplay,
      volume: this.volume,
      spatial: this.spatial,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      rolloff: this.rolloff,
      distanceModel: this.distanceModel,
    };
    if (this.playing !== undefined) out.playing = this.playing;
    return out;
  }
}
