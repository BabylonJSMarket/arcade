import { describe, it, expect } from 'vitest';
import { createAnimation, DEFAULT_ANIMATION_PARAMS } from './Animation.core';

describe('Animation core', () => {
  it('starts with full idle weight and zero locomotion weights', () => {
    const a = createAnimation();
    const s = a.getState();
    expect(s.idleWeight).toBe(1);
    expect(s.walkWeight).toBe(0);
    expect(s.runWeight).toBe(0);
    expect(s.state).toBe('idle');
  });

  it('stays in idle when speed is below the speedThreshold', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6, speedThreshold: 0.5 });
    // Feed a slow enough speed for long enough that smoothing doesn't matter.
    for (let i = 0; i < 100; i++) a.update(0.2, 1 / 60);
    const out = a.update(0.2, 1 / 60);
    expect(out.state).toBe('idle');
    expect(out.idleWeight).toBeCloseTo(1, 5);
  });

  it('blends from idle toward walk as speed crosses the threshold', () => {
    const a = createAnimation({ walkSpeed: 3, blendSpeed: 8 });
    // Target: halfway between threshold (0.5) and walkSpeed (3).
    const speed = (0.5 + 3) / 2;
    // Run long enough for smoothing + blending to converge.
    for (let i = 0; i < 300; i++) a.update(speed, 1 / 60);
    const out = a.update(speed, 1 / 60);
    expect(out.idleWeight).toBeGreaterThan(0.1);
    expect(out.walkWeight).toBeGreaterThan(0.1);
    // With run not engaged, weights are approximately complementary.
    expect(out.idleWeight + out.walkWeight).toBeCloseTo(1, 3);
  });

  it('blends from walk toward run as speed crosses walkSpeed', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6, blendSpeed: 8 });
    const speed = 5; // between walk and run
    for (let i = 0; i < 300; i++) a.update(speed, 1 / 60);
    const out = a.update(speed, 1 / 60);
    expect(out.walkWeight).toBeGreaterThan(0.1);
    expect(out.runWeight).toBeGreaterThan(0.1);
    expect(out.idleWeight).toBeCloseTo(0, 2);
  });

  it('pins run weight at 1 when speed exceeds runSpeed', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6, blendSpeed: 8 });
    for (let i = 0; i < 400; i++) a.update(10, 1 / 60);
    const out = a.update(10, 1 / 60);
    expect(out.runWeight).toBeCloseTo(1, 3);
    expect(out.walkWeight).toBeCloseTo(0, 3);
    expect(out.state).toBe('run');
  });

  it('emits stateChanged only the frame dominant weight flips', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6, blendSpeed: 50 });
    // Start at idle, then jump to run.
    let sawChange = false;
    for (let i = 0; i < 300; i++) {
      const out = a.update(10, 1 / 60);
      if (out.stateChanged) sawChange = true;
    }
    expect(sawChange).toBe(true);
    // Once we've fully settled on pure run, no further flips.
    let laterFlip = false;
    for (let i = 0; i < 60; i++) {
      const out = a.update(10, 1 / 60);
      if (out.stateChanged) laterFlip = true;
    }
    expect(laterFlip).toBe(false);
  });

  it('scales speedRatio with movement speed, clamped to [minSpeedRatio, maxSpeedRatio]', () => {
    const a = createAnimation({
      walkSpeed: 3,
      runSpeed: 6,
      minSpeedRatio: 0.5,
      maxSpeedRatio: 3,
    });
    // Absurdly high speed — ratio must still clamp.
    for (let i = 0; i < 400; i++) a.update(1000, 1 / 60);
    const out = a.update(1000, 1 / 60);
    expect(out.speedRatio).toBeLessThanOrEqual(3);
    expect(out.speedRatio).toBeGreaterThanOrEqual(0.5);
  });

  it('speedRatio holds at 1 while the character is idle', () => {
    const a = createAnimation();
    // Let smoothed speed sit below threshold.
    for (let i = 0; i < 60; i++) a.update(0, 1 / 60);
    const out = a.update(0, 1 / 60);
    expect(out.speedRatio).toBeCloseTo(1, 5);
  });

  it('same sequence of speed/dt inputs produces the same outputs (deterministic)', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6 });
    const b = createAnimation({ walkSpeed: 3, runSpeed: 6 });
    const script = [0, 1, 2, 4, 8, 5, 2, 0.3, 0, 0];
    let la = a.update(0, 0);
    let lb = b.update(0, 0);
    for (const speed of script) {
      la = a.update(speed, 0.1);
      lb = b.update(speed, 0.1);
      expect(la).toEqual(lb);
    }
  });

  it('setParams updates behavior on the next frame', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6, blendSpeed: 8 });
    for (let i = 0; i < 300; i++) a.update(4, 1 / 60);
    // At speed 4, we're in walk->run; walkWeight should dominate.
    const before = a.update(4, 1 / 60);
    expect(before.walkWeight).toBeGreaterThan(before.runWeight);
    // Shrink runSpeed so 4 now sits above the run cutoff.
    a.setParams({ runSpeed: 3.5 });
    for (let i = 0; i < 300; i++) a.update(4, 1 / 60);
    const after = a.update(4, 1 / 60);
    expect(after.runWeight).toBeGreaterThan(after.walkWeight);
  });

  it('reset returns params to defaults and collapses back to pure idle', () => {
    const a = createAnimation({ walkSpeed: 3, runSpeed: 6 });
    for (let i = 0; i < 100; i++) a.update(10, 1 / 60);
    a.reset();
    expect(a.getParams()).toEqual(DEFAULT_ANIMATION_PARAMS);
    const s = a.getState();
    expect(s.idleWeight).toBe(1);
    expect(s.walkWeight).toBe(0);
    expect(s.runWeight).toBe(0);
    expect(s.state).toBe('idle');
  });

  it('handles a zero walkSpeed config without throwing', () => {
    const a = createAnimation({ walkSpeed: 0, runSpeed: 0, speedThreshold: 0.5 });
    expect(() => {
      for (let i = 0; i < 10; i++) a.update(2, 1 / 60);
    }).not.toThrow();
  });

  it('treats negative dt as zero (never unwinds weights)', () => {
    const a = createAnimation();
    const before = a.getState();
    const out = a.update(5, -0.1);
    expect(out.idleWeight).toBe(before.idleWeight);
    expect(out.walkWeight).toBe(before.walkWeight);
    expect(out.runWeight).toBe(before.runWeight);
  });
});
