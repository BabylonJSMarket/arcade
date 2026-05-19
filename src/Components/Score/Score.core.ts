/**
 * Score — pure core.
 *
 * Tracks points per player (or any string entity id). No DOM, no 3D libs,
 * deterministic: same sequence of addScore / resetScores calls produces the
 * same state. The System is a thin driver that routes `goal.scored` and
 * `score.add` events into these methods and rebroadcasts changes as
 * `score.changed` / `score.reset`.
 *
 * Public surface:
 *   createScore(params)         — factory
 *   instance.addScore(id, pts?) — returns { from, to, ownerEntity }
 *   instance.getScore(id)       — scalar (0 if unknown)
 *   instance.getAllScores()     — plain record snapshot
 *   instance.resetScores()      — clear all buckets
 *   instance.getParams()        — current params
 *   instance.setParams(partial) — live-tune from the panel
 *   instance.reset()            — full reset back to defaults (and clear buckets)
 */

export interface ScoreParams {
  /** Default points awarded per add when none is passed. */
  defaultPoints: number;
  /** Lower bound a player's score can reach. `null` = no clamp. */
  minScore: number | null;
  /** Upper bound a player's score can reach. `null` = no clamp. */
  maxScore: number | null;
}

export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  defaultPoints: 1,
  minScore: null,
  maxScore: null,
};

export interface AddScoreResult {
  ownerEntity: string;
  from: number;
  to: number;
  /** Points actually applied after clamping (may differ from requested). */
  delta: number;
}

export interface ScoreInstance {
  addScore(ownerEntity: string, points?: number): AddScoreResult;
  getScore(ownerEntity: string): number;
  getAllScores(): Record<string, number>;
  resetScores(): void;
  getParams(): Readonly<ScoreParams>;
  setParams(partial: Partial<ScoreParams>): void;
  reset(): void;
}

function clamp(value: number, min: number | null, max: number | null): number {
  let v = value;
  if (min !== null && v < min) v = min;
  if (max !== null && v > max) v = max;
  return v;
}

export function createScore(
  params: Partial<ScoreParams> = {},
  initialScores: Record<string, number> = {},
): ScoreInstance {
  const active: ScoreParams = { ...DEFAULT_SCORE_PARAMS, ...params };
  const scores = new Map<string, number>();
  for (const [id, value] of Object.entries(initialScores)) {
    scores.set(id, clamp(value, active.minScore, active.maxScore));
  }

  return {
    addScore(ownerEntity, points) {
      const from = scores.get(ownerEntity) ?? 0;
      const delta = points ?? active.defaultPoints;
      const to = clamp(from + delta, active.minScore, active.maxScore);
      scores.set(ownerEntity, to);
      return { ownerEntity, from, to, delta: to - from };
    },

    getScore(ownerEntity) {
      return scores.get(ownerEntity) ?? 0;
    },

    getAllScores() {
      // Return a fresh object each call so callers can't mutate internal state.
      return Object.fromEntries(scores);
    },

    resetScores() {
      scores.clear();
    },

    getParams() {
      return active;
    },

    setParams(partial) {
      Object.assign(active, partial);
      // If the caller tightened the bounds, re-clamp existing buckets so the
      // next read is coherent.
      for (const [id, value] of scores) {
        scores.set(id, clamp(value, active.minScore, active.maxScore));
      }
    },

    reset() {
      Object.assign(active, DEFAULT_SCORE_PARAMS);
      scores.clear();
    },
  };
}
