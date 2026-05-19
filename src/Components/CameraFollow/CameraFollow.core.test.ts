import { describe, it, expect } from 'vitest';
import { createCameraFollow, DEFAULT_CAMERA_FOLLOW_PARAMS } from './CameraFollow.core';

describe('CameraFollow core', () => {
  it('produces its seeded position when dt is zero', () => {
    const f = createCameraFollow({ smoothing: 10, offsetY: 0 }, { camX: 5, camY: 2, camZ: 3 });
    const out = f.update({ targetX: 100, targetY: 100, targetZ: 100 }, 0);
    expect(out.camX).toBe(5);
    expect(out.camY).toBe(2);
    expect(out.camZ).toBe(3);
  });

  it('moves toward the target but never past it', () => {
    const f = createCameraFollow({ smoothing: 6, offsetY: 0 });
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      const out = f.update({ targetX: 10, targetY: 0, targetZ: 0 }, 1 / 60);
      expect(out.camX).toBeLessThanOrEqual(10 + 1e-9);
      expect(out.camX).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = out.camX;
    }
    expect(prev).toBeGreaterThan(9.9);
  });

  it('adds the configured offset on top of the target position', () => {
    const f = createCameraFollow({ smoothing: 1000, offsetX: 1, offsetY: 2, offsetZ: -3 });
    const out = f.update({ targetX: 10, targetY: 5, targetZ: 7 }, 1);
    expect(out.camX).toBeCloseTo(11, 2);
    expect(out.camY).toBeCloseTo(7, 2);
    expect(out.camZ).toBeCloseTo(4, 2);
  });

  it('is frame-rate independent: same total time converges to the same value', () => {
    const fine = createCameraFollow({ smoothing: 4, offsetX: 0, offsetY: 0, offsetZ: 0 });
    const coarse = createCameraFollow({ smoothing: 4, offsetX: 0, offsetY: 0, offsetZ: 0 });
    const input = { targetX: 100, targetY: 0, targetZ: 0 };
    for (let i = 0; i < 600; i++) fine.update(input, 1 / 600);
    for (let i = 0; i < 60; i++) coarse.update(input, 1 / 60);
    const a = fine.update(input, 0);
    const b = coarse.update(input, 0);
    expect(a.camX).toBeCloseTo(b.camX, 2);
  });

  it('setParams changes smoothing on the next update', () => {
    const f = createCameraFollow({ smoothing: 0.001, offsetY: 0 });
    f.update({ targetX: 100, targetY: 0, targetZ: 0 }, 1 / 60);
    f.setParams({ smoothing: 1000 });
    const out = f.update({ targetX: 100, targetY: 0, targetZ: 0 }, 1);
    expect(out.camX).toBeCloseTo(100, 1);
  });

  it('reset places the camera at the supplied position', () => {
    const f = createCameraFollow({ smoothing: 100, offsetY: 0 });
    f.update({ targetX: 50, targetY: 0, targetZ: 0 }, 1);
    f.reset({ camX: -3, camY: 4, camZ: 5 });
    const out = f.update({ targetX: 0, targetY: 0, targetZ: 0 }, 0);
    expect(out.camX).toBe(-3);
    expect(out.camY).toBe(4);
    expect(out.camZ).toBe(5);
  });

  it('zero smoothing locks the camera in place even with a moving target', () => {
    const f = createCameraFollow({ smoothing: 0, offsetY: 0 }, { camX: 1, camY: 2, camZ: 3 });
    for (let i = 0; i < 10; i++) {
      const out = f.update({ targetX: 99, targetY: 99, targetZ: 99 }, 1 / 60);
      expect(out.camX).toBe(1);
      expect(out.camY).toBe(2);
      expect(out.camZ).toBe(3);
    }
  });

  it('getParams reflects defaults when none are supplied', () => {
    const f = createCameraFollow();
    expect(f.getParams()).toEqual(DEFAULT_CAMERA_FOLLOW_PARAMS);
  });
});
