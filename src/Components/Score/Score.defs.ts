/**
 * Score — definitions.
 *
 * Holds the `ScoreComponent` class and the shapes its data and events travel
 * in. No System lives here, which is the point: another component can name
 * Score in a query, or type an event it listens for, without pulling Score's
 * behaviour into its own bundle. Import from here, not from Score.ts.
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
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Score must still match a copy in the project.
  static componentType = 'Score';

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