/**
 * Scoreboard — definitions.
 *
 * The Scoreboard component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Scoreboard in a query or react to what it emits: this file carries no System, so
 * naming Scoreboard never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import { DEFAULT_SCOREBOARD_PARAMS, type ScoreboardInstance, type ScoreboardParams, type ScoreboardPlayer } from './Scoreboard.core';
// ============================================
// Events
// ============================================

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