/**
 * Score — definitions.
 *
 * The Score component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Score in a query or react to what it emits: this file carries no System, so
 * naming Score never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import { DEFAULT_SCORE_PARAMS, type ScoreInstance, type ScoreParams } from './Score.core';
// ============================================
// Events
// ============================================

export interface ScoreAddRequest {
  ownerEntity: string;
  /** Omit to use the core's defaultPoints. */
  points?: number;
}

export interface ScoreResetRequest {}

/** Payload shape of the `goal.scored` event emitted by the Goal System. */
export interface GoalScoredPayload {
  ownerEntity?: string;
  points?: number;
}

export interface ScoreInput extends Partial<ScoreParams> {
  /** Seeded scores keyed by player/entity id. Empty by default. */
  scores?: Record<string, number>;
}

// ============================================
// Component — params + live core instance
// ============================================

export class ScoreComponent extends Component {
  params: ScoreParams;
  initialScores: Record<string, number>;
  /** Populated lazily by the System. */
  instance: ScoreInstance | null = null;

  constructor(data: ScoreInput = {}) {
    super();
    const { scores, ...paramsPartial } = data;
    this.params = { ...DEFAULT_SCORE_PARAMS, ...paramsPartial };
    this.initialScores = scores ? { ...scores } : {};
  }

  serialize(): ScoreInput {
    // If the live instance has been attached, prefer its current state over
    // the stale seed — that way a save/load round-trip preserves gameplay.
    const scores = this.instance ? this.instance.getAllScores() : { ...this.initialScores };
    return {
      ...this.params,
      scores,
    };
  }
}