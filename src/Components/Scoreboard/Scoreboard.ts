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

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import {
  createScoreboard,
  DEFAULT_SCOREBOARD_PARAMS,
  type ScoreboardInstance,
  type ScoreboardParams,
  type ScoreboardPlayer,
  type ScoreboardPosition,
  type ScoreboardSnapshot,
} from './Scoreboard.core';

// ============================================
// Events
// ============================================

export const ScoreboardEvents = {
  /** Emitted after the core rebuilds its rows; payload carries the snapshot. */
  UPDATED: 'scoreboard.updated',
} as const;

export const ScoreboardInputEvents = {
  /** Public Score-system event — `{ ownerEntity, score, allScores }`. */
  SCORE_CHANGED: 'score.updated',
  /** Public Score-system event — clears every row to zero. */
  SCORE_RESET: 'score.reset',
} as const;

export interface ScoreboardScoreUpdateEvent {
  ownerEntity?: string;
  score?: number;
  allScores?: Record<string, number>;
}

export interface ScoreboardScoreResetEvent {
  allScores?: Record<string, number>;
}

export interface ScoreboardInput extends Partial<ScoreboardParams> {
  players?: ScoreboardPlayer[];
}

// ============================================
// Component — params + roster + core instance
// ============================================

export class ScoreboardComponent extends Component {
  params: ScoreboardParams;
  players: ScoreboardPlayer[];
  /** Populated lazily by the System on attach. */
  instance: ScoreboardInstance | null = null;

  constructor(data: ScoreboardInput = {}) {
    super();
    const { players, ...paramInput } = data;
    this.params = { ...DEFAULT_SCOREBOARD_PARAMS, ...paramInput };
    this.players = (players ?? []).map((p) => ({
      entityId: p.entityId,
      name: p.name,
      color: [p.color[0], p.color[1], p.color[2]],
    }));
  }

  serialize(): ScoreboardInput {
    return {
      ...this.params,
      players: this.players.map((p) => ({
        entityId: p.entityId,
        name: p.name,
        color: [p.color[0], p.color[1], p.color[2]],
      })),
    };
  }
}

// ============================================
// System — listens to Score events, rebuilds snapshot
// ============================================

export class ScoreboardSystem extends System {
  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ScoreboardComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    this.eventBus.on(
      ScoreboardInputEvents.SCORE_CHANGED,
      (e: ScoreboardScoreUpdateEvent) => this.handleScoreChanged(e),
    );
    this.eventBus.on(
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
