import { describe, it, expect } from 'vitest';
import { createScore, DEFAULT_SCORE_PARAMS } from './Score.core';

describe('Score core', () => {
  it('starts with no players and returns zero for unknown entities', () => {
    const s = createScore();
    expect(s.getScore('player1')).toBe(0);
    expect(s.getAllScores()).toEqual({});
  });

  it('addScore applies defaultPoints when no amount is passed', () => {
    const s = createScore({ defaultPoints: 3 });
    const r = s.addScore('player1');
    expect(r.from).toBe(0);
    expect(r.to).toBe(3);
    expect(r.delta).toBe(3);
    expect(s.getScore('player1')).toBe(3);
  });

  it('addScore accumulates points for the same player across calls', () => {
    const s = createScore();
    s.addScore('player1', 10);
    const r = s.addScore('player1', 5);
    expect(r.from).toBe(10);
    expect(r.to).toBe(15);
    expect(s.getScore('player1')).toBe(15);
  });

  it('tracks multiple players independently', () => {
    const s = createScore();
    s.addScore('player1', 10);
    s.addScore('player2', 20);
    s.addScore('player1', 5);
    expect(s.getScore('player1')).toBe(15);
    expect(s.getScore('player2')).toBe(20);
    expect(s.getAllScores()).toEqual({ player1: 15, player2: 20 });
  });

  it('addScore with negative points subtracts from the running total', () => {
    const s = createScore();
    s.addScore('player1', 10);
    const r = s.addScore('player1', -3);
    expect(r.to).toBe(7);
    expect(r.delta).toBe(-3);
  });

  it('clamps additions against maxScore when one is configured', () => {
    const s = createScore({ maxScore: 100 });
    s.addScore('player1', 80);
    const r = s.addScore('player1', 50);
    expect(r.to).toBe(100);
    expect(r.delta).toBe(20);
  });

  it('clamps additions against minScore when one is configured', () => {
    const s = createScore({ minScore: 0 });
    s.addScore('player1', 5);
    const r = s.addScore('player1', -20);
    expect(r.to).toBe(0);
    expect(r.delta).toBe(-5);
  });

  it('getAllScores returns a fresh snapshot that does not alias internal state', () => {
    const s = createScore();
    s.addScore('player1', 10);
    const snap = s.getAllScores();
    snap.player1 = 999;
    expect(s.getScore('player1')).toBe(10);
  });

  it('resetScores clears every player bucket', () => {
    const s = createScore();
    s.addScore('player1', 10);
    s.addScore('player2', 20);
    s.resetScores();
    expect(s.getAllScores()).toEqual({});
    expect(s.getScore('player1')).toBe(0);
  });

  it('accepts initial scores on construction', () => {
    const s = createScore({}, { player1: 5, player2: 12 });
    expect(s.getScore('player1')).toBe(5);
    expect(s.getScore('player2')).toBe(12);
  });

  it('initial scores respect the configured bounds', () => {
    const s = createScore({ maxScore: 10 }, { player1: 99 });
    expect(s.getScore('player1')).toBe(10);
  });

  it('setParams re-clamps existing buckets when bounds tighten', () => {
    const s = createScore();
    s.addScore('player1', 50);
    s.setParams({ maxScore: 20 });
    expect(s.getScore('player1')).toBe(20);
  });

  it('same sequence of addScore calls produces the same state (deterministic)', () => {
    const a = createScore();
    const b = createScore();
    for (const [id, pts] of [
      ['p1', 10],
      ['p2', 5],
      ['p1', -2],
      ['p3', 7],
      ['p2', 10],
    ] as Array<[string, number]>) {
      a.addScore(id, pts);
      b.addScore(id, pts);
    }
    expect(a.getAllScores()).toEqual(b.getAllScores());
  });

  it('reset returns params to defaults and clears every bucket', () => {
    const s = createScore({ defaultPoints: 5, maxScore: 10 });
    s.addScore('player1', 7);
    s.reset();
    expect(s.getParams()).toEqual(DEFAULT_SCORE_PARAMS);
    expect(s.getAllScores()).toEqual({});
  });
});
