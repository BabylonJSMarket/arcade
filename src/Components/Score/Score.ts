/**
 * Score.ts — renderer-agnostic System.
 *
 * Pure math and state live in Score.core.ts. This System wires the core to
 * the event bus: it listens for `goal.scored` from the Goal mechanic and
 * for direct `score.add` requests, pipes the points into the core, and
 * rebroadcasts every change as `score.changed`. Full `score.reset` is
 * broadcast when a reset request clears the buckets.
 *
 * Zero adapter calls — Score is data-only. Presentation (scoreboard HUDs,
 * celebration VFX, end-match rankings) lives in sibling systems that listen
 * to the events emitted here.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import {
  createScore,
  DEFAULT_SCORE_PARAMS,
  type ScoreInstance,
  type ScoreParams,
} from './Score.core';

// ============================================
// Events
// ============================================

export const ScoreEvents = {
  /** Fired when any player's score changes. */
  CHANGED: 'score.changed',
  /** Fired once when every bucket is cleared. */
  RESET: 'score.reset',
} as const;

export const ScoreInputEvents = {
  /** Direct request to award points. `{ ownerEntity, points? }`. */
  ADD: 'score.add',
  /** External request to clear every player's score. `{}`. */
  RESET: 'score.resetRequest',
  /**
   * Score also listens to goal.scored so Goal mechanic scenes just work out
   * of the box — no middle-man system needed to route points from the net
   * into the scoreboard.
   */
  GOAL_SCORED: 'goal.scored',
} as const;

export interface ScoreAddRequest {
  ownerEntity: string;
  /** Omit to use the core's defaultPoints. */
  points?: number;
}

export interface ScoreResetRequest {}

/** Payload shape of the `goal.scored` event emitted by the Goal System. */
interface GoalScoredPayload {
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

// ============================================
// System — listens for score updates, rebroadcasts transitions
// ============================================

export class ScoreSystem extends System {
  private unsubscribes: Array<() => void> = [];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ScoreComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on(ScoreInputEvents.ADD, (e: ScoreAddRequest) => this.handleAdd(e)),
      this.eventBus.on(ScoreInputEvents.RESET, () => this.handleReset()),
      this.eventBus.on(ScoreInputEvents.GOAL_SCORED, (e: GoalScoredPayload) =>
        this.handleGoalScored(e),
      ),
    );

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(ScoreComponent);
    if (!comp || comp.instance) return;
    comp.instance = createScore(comp.params, comp.initialScores);
  }

  /** The single scoreboard entity (first match wins). */
  private getPrimary(): ScoreComponent | null {
    for (const entity of this.entities) {
      const comp = entity.get(ScoreComponent);
      if (comp?.instance) return comp;
    }
    return null;
  }

  private handleAdd(e: ScoreAddRequest): void {
    if (!e?.ownerEntity) return;
    const comp = this.getPrimary();
    if (!comp?.instance) return;

    const result = comp.instance.addScore(e.ownerEntity, e.points);
    this.eventBus.emit(ScoreEvents.CHANGED, {
      ownerEntity: result.ownerEntity,
      score: result.to,
      delta: result.delta,
      allScores: comp.instance.getAllScores(),
    });
  }

  private handleGoalScored(e: GoalScoredPayload): void {
    if (!e?.ownerEntity) return;
    this.handleAdd({ ownerEntity: e.ownerEntity, points: e.points });
  }

  private handleReset(): void {
    const comp = this.getPrimary();
    if (!comp?.instance) return;
    comp.instance.resetScores();
    this.eventBus.emit(ScoreEvents.RESET, {
      allScores: comp.instance.getAllScores(),
    });
  }

  protected onUpdate(_dt: number): void {
    // Score has no per-frame work — everything is event-driven.
  }
}
