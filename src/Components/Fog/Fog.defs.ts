/**
 * Fog — definitions.
 *
 * Holds the `FogComponent` class and the shapes its data and events travel
 * in. No System lives here, which is the point: another component can name
 * Fog in a query, or type an event it listens for, without pulling Fog's
 * behaviour into its own bundle. Import from here, not from Fog.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Color, FogSpec } from '@babylonjsmarket/ecs/renderer-types';

/** Falloff curve — see the notes on each in {@link FogInput.mode}. */
export type FogMode = 'linear' | 'exp' | 'exp2';

export interface FogInput {
  /**
   * `linear` fades between `start` and `end`; `exp` fades by e^-(d·density);
   * `exp2` by e^-(d·density)² — clear up close, then a faster roll-off, which
   * is the usual pick for an interior. Default 'exp2'.
   */
  mode?: FogMode;
  /**
   * What distant surfaces fade toward. Match the scene's clear colour and the
   * horizon dissolves instead of drawing a hard edge. Default black.
   */
  color?: Color;
  /** Thickness for the exp modes. Default 0.05; a 24 m room reads well near 0.1. */
  density?: number;
  /** Where `linear` fog begins. Default 10. */
  start?: number;
  /** Where `linear` fog is fully opaque. Default 100. */
  end?: number;
  /** Off switch that keeps the settings — a menu toggle. Default true. */
  enabled?: boolean;
}

function cloneColor(c: Color): Color {
  return [c[0], c[1], c[2]];
}

export class FogComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Fog must still match a copy in the project.
  static componentType = 'Fog';

  mode: FogMode;
  color: Color;
  density: number;
  start: number;
  end: number;

  constructor(data: FogInput = {}) {
    super();
    this.mode = data.mode ?? 'exp2';
    this.color = data.color ? cloneColor(data.color) : [0, 0, 0];
    this.density = data.density ?? 0.05;
    this.start = data.start ?? 10;
    this.end = data.end ?? 100;
    // `enabled` is the base Component accessor; setting it here (no bus yet) is silent.
    this.enabled = data.enabled ?? true;
  }

  /** The adapter's shape, detached so a later edit here doesn't alias it. */
  toSpec(): FogSpec {
    return {
      mode: this.mode,
      color: cloneColor(this.color),
      density: this.density,
      start: this.start,
      end: this.end,
    };
  }

  serialize(): FogInput {
    return {
      mode: this.mode,
      color: cloneColor(this.color),
      density: this.density,
      start: this.start,
      end: this.end,
      enabled: this.enabled,
    };
  }
}
