/**
 * Scoreboard.ts — renderer-agnostic System.
 *
 * The core (`Scoreboard.core.ts`) owns the roster, the score map, and the
 * formatted row output. This System is the thin driver: it subscribes to the
 * public score events (`score.updated`, `score.reset`) and feeds them into
 * the core, then broadcasts a `scoreboard.updated` event carrying the fresh
 * snapshot so the overlay (panel viz) can repaint.
 *
 * No adapter calls — Scoreboard is a pure on-screen HUD. Its pixels are
 * painted by the renderer-free Solid panel that lives in
 * `Scoreboard.panel.tsx` and is mounted by the `Scoreboard.viz.tsx` ECS
 * wrapper. The same System works under both Babylon and Three because it
 * never touches the 3D layer.
 */

import { ScoreboardEvents, ScoreboardInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { createScoreboard, type ScoreboardPlayer, type ScoreboardPosition, type ScoreboardSnapshot } from './Scoreboard.core';
import { ScoreboardComponent, type ScoreboardScoreResetEvent, type ScoreboardScoreUpdateEvent } from './Scoreboard.defs';

// ============================================
// System — listens to Score events, rebuilds snapshot
// ============================================

export class ScoreboardSystem extends System {
  protected query = { required: [ScoreboardComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
    this._pauseable = false;
  }

  protected onInitialize(): void {
    this.listen(
      ScoreboardInputEvents.SCORE_CHANGED,
      (e: ScoreboardScoreUpdateEvent) => this.handleScoreChanged(e),
    );
    this.listen(
      ScoreboardInputEvents.SCORE_RESET,
      (e: ScoreboardScoreResetEvent) => this.handleScoreReset(e),
    );

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
    this.broadcastFromEntity(entity);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(ScoreboardComponent);
    if (!comp || comp.instance) return;
    comp.instance = createScoreboard(comp.params, comp.players);
  }

  private handleScoreChanged(e: ScoreboardScoreUpdateEvent): void {
    const all = e.allScores ?? {};
    for (const entity of this.entities) {
      const comp = entity.get(ScoreboardComponent);
      if (!comp?.instance) continue;
      comp.instance.setScores(all);
      this.broadcastFromEntity(entity);
    }
  }

  private handleScoreReset(e: ScoreboardScoreResetEvent): void {
    for (const entity of this.entities) {
      const comp = entity.get(ScoreboardComponent);
      if (!comp?.instance) continue;
      if (e.allScores) comp.instance.setScores(e.allScores);
      else comp.instance.resetScores();
      this.broadcastFromEntity(entity);
    }
  }

  private broadcastFromEntity(entity: Entity): void {
    const comp = entity.get(ScoreboardComponent);
    if (!comp?.instance) return;
    const snap: ScoreboardSnapshot = comp.instance.getSnapshot();
    this.eventBus.emit(ScoreboardEvents.UPDATED, {
      entityId: (entity as unknown as { id: string }).id,
      snapshot: snap,
    });
  }

  protected onUpdate(_dt: number): void {
    // Scoreboard is event-driven — no per-frame work.
  }
}

export type { ScoreboardPlayer, ScoreboardPosition };

// The definitions live in Scoreboard.defs.ts; re-exported so existing importers
// keep working. New code should import them from './Scoreboard.defs' directly.
export { ScoreboardComponent, type ScoreboardInput, type ScoreboardScoreResetEvent, type ScoreboardScoreUpdateEvent } from './Scoreboard.defs';
