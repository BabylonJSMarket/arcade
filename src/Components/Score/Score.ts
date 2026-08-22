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

import { ScoreEvents, ScoreInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { createScore } from './Score.core';
import { type GoalScoredPayload, type ScoreAddRequest, ScoreComponent } from './Score.defs';

// ============================================
// System — listens for score updates, rebroadcasts transitions
// ============================================

export class ScoreSystem extends System {
  protected query = { required: [ScoreComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(ScoreInputEvents.ADD, (e: ScoreAddRequest) => this.handleAdd(e));
    this.listen(ScoreInputEvents.RESET, () => this.handleReset());
    this.listen(ScoreInputEvents.GOAL_SCORED, (e: GoalScoredPayload) =>
      this.handleGoalScored(e),
    );

    for (const entity of this.entities) this.ensureInstance(entity);
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

// The definitions live in Score.defs.ts; re-exported so existing importers
// keep working. New code should import them from './Score.defs' directly.
export { type ScoreAddRequest, ScoreComponent, type ScoreInput, type ScoreResetRequest } from './Score.defs';
