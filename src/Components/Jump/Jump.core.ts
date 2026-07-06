/**
 * Jump — pure core.
 *
 * A self-contained vertical arc: press the jump key (or emit `jump.request`)
 * and the character rises then falls along a tunable parabola-with-hang over a
 * fixed air time, back to where it left the ground. The System owns the actual
 * vertical drive + the airborne state machine; this file is serializable config
 * plus the arc math and the event contracts.
 *
 * The arc is scripted, not physics-integrated — `height`, `duration`, and
 * `hang` fully describe it, so it composes with any mover (KeyboardMover, AI)
 * and needs no physics engine. `jump.started` carries the duration so an
 * animator can play a jump clip that lands exactly on touchdown (first half
 * ascending, second half descending).
 *
 * Zero imports from @babylonjs, three, solid-js or the DOM.
 */

import { Component } from '@babylonjsmarket/ecs';

// ============================================
// Events
// ============================================

export const JumpEvents = {
  /** Fired the frame the character leaves the ground. Payload: {@link JumpStartedEvent}. */
  STARTED: 'jump.started',
  /** Fired the frame the character lands. Payload: `{ entityId }`. */
  LANDED: 'jump.landed',
} as const;

export const JumpInputEvents = {
  /** Request a jump for an entity (alongside the configured key). Payload: `{ entityId? }`. */
  JUMP: 'jump.request',
} as const;

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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
