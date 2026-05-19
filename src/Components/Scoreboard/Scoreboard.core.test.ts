import { describe, it, expect } from 'vitest';
import {
  createScoreboard,
  DEFAULT_SCOREBOARD_PARAMS,
  type ScoreboardPlayer,
} from './Scoreboard.core';

const PLAYERS: ScoreboardPlayer[] = [
  { entityId: 'p1', name: 'Alice', color: [1, 0, 0] },
  { entityId: 'p2', name: 'Bob', color: [0, 1, 0] },
];

describe('Scoreboard core', () => {
  it('starts with every player at zero before any scores are pushed', () => {
    const sb = createScoreboard({}, PLAYERS);
    const snap = sb.getSnapshot();
    expect(snap.rows).toHaveLength(2);
    expect(snap.rows[0].scoreText).toBe('0');
    expect(snap.rows[1].scoreText).toBe('0');
  });

  it('setScores pushes the latest totals into every matching row', () => {
    const sb = createScoreboard({}, PLAYERS);
    sb.setScores({ p1: 7, p2: 3 });
    const snap = sb.getSnapshot();
    expect(snap.rows[0].score).toBe(7);
    expect(snap.rows[0].scoreText).toBe('7');
    expect(snap.rows[1].score).toBe(3);
  });

  it('players missing from the score map display zero, not undefined', () => {
    const sb = createScoreboard({}, PLAYERS);
    sb.setScores({ p1: 5 });
    const snap = sb.getSnapshot();
    expect(snap.rows[0].scoreText).toBe('5');
    expect(snap.rows[1].scoreText).toBe('0');
    expect(snap.rows[1].score).toBe(0);
  });

  it('resetScores sends every row back to zero without forgetting the roster', () => {
    const sb = createScoreboard({}, PLAYERS);
    sb.setScores({ p1: 10, p2: 15 });
    sb.resetScores();
    const snap = sb.getSnapshot();
    expect(snap.rows.map((r) => r.scoreText)).toEqual(['0', '0']);
    expect(snap.rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('normalized RGB colors render as "rgb(r,g,b)" css on 0-255 ints', () => {
    const sb = createScoreboard({}, [
      { entityId: 'p1', name: 'Flame', color: [1, 0.5, 0] },
    ]);
    const snap = sb.getSnapshot();
    expect(snap.rows[0].colorCss).toBe('rgb(255, 128, 0)');
  });

  it('setParams updates fontSize and position on the next snapshot', () => {
    const sb = createScoreboard({}, PLAYERS);
    sb.setParams({ fontSize: 24, position: 'bottom-right' });
    const snap = sb.getSnapshot();
    expect(snap.fontSize).toBe(24);
    expect(snap.position).toBe('bottom-right');
  });

  it('setPlayers replaces the roster while preserving previously pushed scores', () => {
    const sb = createScoreboard({}, PLAYERS);
    sb.setScores({ p1: 9, p2: 4, p3: 11 });
    sb.setPlayers([{ entityId: 'p3', name: 'Carol', color: [0, 0, 1] }]);
    const snap = sb.getSnapshot();
    expect(snap.rows).toHaveLength(1);
    expect(snap.rows[0].name).toBe('Carol');
    expect(snap.rows[0].scoreText).toBe('11');
  });

  it('reset restores default params and clears all scores', () => {
    const sb = createScoreboard({ fontSize: 30, position: 'bottom-right' }, PLAYERS);
    sb.setScores({ p1: 42 });
    sb.reset();
    const snap = sb.getSnapshot();
    expect(snap.fontSize).toBe(DEFAULT_SCOREBOARD_PARAMS.fontSize);
    expect(snap.position).toBe(DEFAULT_SCOREBOARD_PARAMS.position);
    expect(snap.rows[0].scoreText).toBe('0');
  });
});
