/**
 * Jump — definitions.
 *
 * The Jump component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Jump in a query or react to what it emits: this file carries no System, so
 * naming Jump never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
// ============================================
// Events
// ============================================

export interface JumpStartedEvent {
  entityId: string;
  /** Air time in seconds — an animator syncs a clip to this so it lands on touchdown. */
  duration: number;
  /** Peak height in world units. */
  height: number;
}

export interface JumpInput {
  /** KeyboardEvent.code that triggers a jump. Default `"Space"`. */
  key?: string;
  /** Peak height in world units. Default `1.6`. */
  height?: number;
  /** Total air time in seconds (ascent + descent). Default `0.7`. */
  duration?: number;
  /**
   * Apex dwell. `0` = a plain parabola; toward `0.9` flattens the top so the
   * character floats at the peak (a game-y, less physical jump). Default `0.35`.
   */
  hang?: number;
}

// ============================================
// Component
// ============================================

export class JumpComponent extends Component {
  key: string;
  height: number;
  duration: number;
  hang: number;
  /** True while airborne. Owned by the System. */
  airborne = false;
  /** Seconds into the current jump. Owned by the System. */
  elapsed = 0;

  constructor(data: JumpInput = {}) {
    super();
    this.key = data.key ?? 'Space';
    this.height = data.height ?? 1.6;
    this.duration = data.duration ?? 0.7;
    this.hang = clamp(data.hang ?? 0.35, 0, 0.9);
  }

  /**
   * Normalized height in `[0, 1]` at jump progress `p` in `[0, 1]`. A parabola
   * `4p(1-p)` lerped toward the fuller `sin(πp)` by `hang`; both peak at `1.0`
   * when `p === 0.5`, so the apex is `height` regardless of hang, and the curve
   * is symmetric — ascent and descent mirror, which is what lets a jump clip's
   * midpoint line up with the apex.
   */
  arc(p: number): number {
    const parabola = 4 * p * (1 - p);
    const full = Math.sin(Math.PI * p);
    return parabola * (1 - this.hang) + full * this.hang;
  }

  serialize(): JumpInput {
    return { key: this.key, height: this.height, duration: this.duration, hang: this.hang };
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}