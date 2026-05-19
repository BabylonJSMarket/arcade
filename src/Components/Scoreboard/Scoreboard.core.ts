/**
 * Scoreboard — pure core.
 *
 * The core owns two pieces of state: the list of players being displayed
 * (id, display name, tint color) and the live score map (`entityId → score`).
 * Every frame the System feeds new score totals in; the core renders a row
 * snapshot that the panel/overlay paints to the screen.
 *
 * Keeping the rendering data pure means the scoreboard reads identically
 * under BabylonJS, Three.js, or a headless test — the only thing that
 * changes is whoever consumes the snapshot. No `@babylonjs`, no `three`,
 * no `solid-js`, no DOM.
 *
 * Public surface:
 *   createScoreboard(params, players?)  — factory
 *   instance.setScores(map)             — push fresh scores from the Score system
 *   instance.resetScores()              — drop all scores back to 0
 *   instance.setPlayers(players)        — replace the row definitions
 *   instance.getPlayers()               — current row definitions
 *   instance.getSnapshot()              — { title, rows[] } ready for the overlay
 *   instance.setParams(partial)         — live tuning from the panel
 *   instance.getParams()                — current params
 *   instance.reset()                    — restore defaults (params + empty scores)
 */

import type { Color } from '@babylonjsmarket/ecs/renderer-types';

export type ScoreboardPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface ScoreboardPlayer {
  /** Matches the `ownerEntity` key used in `score.updated` payloads. */
  entityId: string;
  /** Human-facing label for the row. */
  name: string;
  /** RGB in [0,1]. Rendered as an `rgb(...)` swatch next to the name. */
  color: Color;
}

export interface ScoreboardParams {
  /** Overlay title. "SCORE" by default. */
  title: string;
  /** Base font size in CSS pixels. */
  fontSize: number;
  /** Which corner of the canvas container the overlay anchors to. */
  position: ScoreboardPosition;
}

export const DEFAULT_SCOREBOARD_PARAMS: ScoreboardParams = {
  title: 'SCORE',
  fontSize: 18,
  position: 'top-left',
};

export interface ScoreboardRow {
  entityId: string;
  name: string;
  /** "rgb(r, g, b)" formatted on 0-255 ints, ready for CSS. */
  colorCss: string;
  /** Raw RGB in [0,1] for renderers that prefer tuples. */
  color: Color;
  /** The current score as a string — always "0" for players with no entry. */
  scoreText: string;
  score: number;
}

export interface ScoreboardSnapshot {
  title: string;
  fontSize: number;
  position: ScoreboardPosition;
  rows: ScoreboardRow[];
}

export interface ScoreboardInstance {
  setScores(scores: Readonly<Record<string, number>>): void;
  resetScores(): void;
  setPlayers(players: ReadonlyArray<ScoreboardPlayer>): void;
  getPlayers(): ReadonlyArray<ScoreboardPlayer>;
  getSnapshot(): ScoreboardSnapshot;
  setParams(partial: Partial<ScoreboardParams>): void;
  getParams(): Readonly<ScoreboardParams>;
  reset(): void;
}

function toRgbCss(color: Color): string {
  const r = Math.max(0, Math.min(255, Math.round(color[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(color[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(color[2] * 255)));
  return `rgb(${r}, ${g}, ${b})`;
}

export function createScoreboard(
  params: Partial<ScoreboardParams> = {},
  players: ReadonlyArray<ScoreboardPlayer> = [],
): ScoreboardInstance {
  const active: ScoreboardParams = { ...DEFAULT_SCOREBOARD_PARAMS, ...params };
  let roster: ScoreboardPlayer[] = players.map((p) => ({
    entityId: p.entityId,
    name: p.name,
    color: [p.color[0], p.color[1], p.color[2]],
  }));
  let scores: Record<string, number> = {};

  const buildRows = (): ScoreboardRow[] =>
    roster.map((p) => {
      const score = scores[p.entityId] ?? 0;
      return {
        entityId: p.entityId,
        name: p.name,
        colorCss: toRgbCss(p.color),
        color: [p.color[0], p.color[1], p.color[2]],
        scoreText: String(score),
        score,
      };
    });

  return {
    setScores(map) {
      scores = { ...map };
    },

    resetScores() {
      scores = {};
    },

    setPlayers(players) {
      roster = players.map((p) => ({
        entityId: p.entityId,
        name: p.name,
        color: [p.color[0], p.color[1], p.color[2]],
      }));
    },

    getPlayers() {
      return roster;
    },

    getSnapshot() {
      return {
        title: active.title,
        fontSize: active.fontSize,
        position: active.position,
        rows: buildRows(),
      };
    },

    setParams(partial) {
      Object.assign(active, partial);
    },

    getParams() {
      return active;
    },

    reset() {
      Object.assign(active, DEFAULT_SCOREBOARD_PARAMS);
      scores = {};
    },
  };
}
