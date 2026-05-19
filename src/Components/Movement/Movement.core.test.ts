import { describe, it, expect } from 'vitest';
import {
  createMovement,
  clampMoveInput,
  stepYaw,
  DEFAULT_MOVEMENT_PARAMS,
} from './Movement.core';

describe('Movement core', () => {
  it('starts grounded, still, with zero velocity', () => {
    const m = createMovement();
    const s = m.getState();
    expect(s.velX).toBe(0);
    expect(s.velY).toBe(0);
    expect(s.velZ).toBe(0);
    expect(s.isGrounded).toBe(true);
    expect(s.isMoving).toBe(false);
  });

  it('horizontal input translates the character at speed units per second', () => {
    const m = createMovement({ speed: 10, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const tick = m.update({ moveX: 1, moveZ: 0, jumpPressed: false, groundY: 0 }, 0.1);
    expect(tick.posX).toBeCloseTo(1, 5);
    expect(tick.isMoving).toBe(true);
  });

  it('diagonal input is normalized so W+D does not exceed speed', () => {
    const m = createMovement({ speed: 10, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const tick = m.update({ moveX: 1, moveZ: 1, jumpPressed: false, groundY: 0 }, 1);
    const dist = Math.hypot(tick.posX, tick.posZ);
    expect(dist).toBeCloseTo(10, 5);
  });

  it('jump sets upward velocity to jumpForce and lifts the character off the ground', () => {
    const m = createMovement({ jumpForce: 8, gravity: 20, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const tick = m.update({ moveX: 0, moveZ: 0, jumpPressed: true, groundY: 0 }, 0.1);
    // velY = 8 - 20*0.1 = 6 (gravity applied this same frame after jump).
    expect(tick.velY).toBeCloseTo(6, 5);
    expect(tick.jumpedThisFrame).toBe(true);
    expect(tick.isGrounded).toBe(false);
  });

  it('jump is ignored while already airborne', () => {
    const m = createMovement({ jumpForce: 8, gravity: 20, feetOffset: 1 });
    m.setPosition(0, 5, 0);
    // Kick off the ground first.
    m.update({ moveX: 0, moveZ: 0, jumpPressed: true, groundY: null }, 0.016);
    // Try to double-jump mid-air — should have no effect.
    const before = m.getState().velY;
    const tick = m.update({ moveX: 0, moveZ: 0, jumpPressed: true, groundY: null }, 0.016);
    expect(tick.jumpedThisFrame).toBe(false);
    // velY strictly decreases under gravity, never snaps back up to jumpForce.
    expect(tick.velY).toBeLessThan(before);
  });

  it('gravity accumulates on velY while airborne', () => {
    const m = createMovement({ gravity: 20, jumpForce: 8, feetOffset: 1 });
    m.setPosition(0, 5, 0);
    // Jump to kick off the ground — now airborne.
    m.update({ moveX: 0, moveZ: 0, jumpPressed: true, groundY: null }, 0.016);
    const t1 = m.update({ moveX: 0, moveZ: 0, jumpPressed: false, groundY: null }, 0.1);
    const t2 = m.update({ moveX: 0, moveZ: 0, jumpPressed: false, groundY: null }, 0.1);
    expect(t2.velY).toBeLessThan(t1.velY);
  });

  it('lands when feet touch groundY on the way down', () => {
    const m = createMovement({ gravity: 20, feetOffset: 1 });
    m.setPosition(0, 3, 0);
    m.setVelocity(0, -10, 0);
    // Manually clear grounded so the fall registers.
    m.update({ moveX: 0, moveZ: 0, jumpPressed: false, groundY: -100 }, 0.0001);
    // Now feed a real ground and step; feet should snap to groundY.
    const tick = m.update({ moveX: 0, moveZ: 0, jumpPressed: false, groundY: 0 }, 0.2);
    expect(tick.isGrounded).toBe(true);
    expect(tick.posY).toBeCloseTo(1, 5); // groundY(0) + feetOffset(1)
    expect(tick.velY).toBe(0);
  });

  it('groundedChanged fires on the frame the grounded state flips', () => {
    const m = createMovement({ jumpForce: 8, gravity: 20, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const leave = m.update({ moveX: 0, moveZ: 0, jumpPressed: true, groundY: 0 }, 0.016);
    expect(leave.groundedChanged).toBe(true);
    expect(leave.isGrounded).toBe(false);

    // Hanging mid-air: grounded state is stable, no change.
    const hang = m.update({ moveX: 0, moveZ: 0, jumpPressed: false, groundY: null }, 0.016);
    expect(hang.groundedChanged).toBe(false);
  });

  it('faceMotion rotates yaw toward the direction of motion', () => {
    const m = createMovement({ rotationSpeed: Math.PI, faceMotion: true, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const tick = m.update({ moveX: 1, moveZ: 0, jumpPressed: false, groundY: 0 }, 1);
    // Target is atan2(1, 0) = PI/2. With rotationSpeed=PI and dt=1 we step up
    // to PI, so we fully reach the target.
    expect(tick.yaw).toBeCloseTo(Math.PI / 2, 5);
  });

  it('setParams updates behavior on the next frame', () => {
    const m = createMovement({ speed: 5, feetOffset: 1 });
    m.setPosition(0, 1, 0);
    const a = m.update({ moveX: 1, moveZ: 0, jumpPressed: false, groundY: 0 }, 0.1);
    expect(a.posX).toBeCloseTo(0.5, 5);
    m.setParams({ speed: 20 });
    const b = m.update({ moveX: 1, moveZ: 0, jumpPressed: false, groundY: 0 }, 0.1);
    expect(b.posX - a.posX).toBeCloseTo(2, 5);
  });

  it('reset returns the character to the origin, grounded, at rest', () => {
    const m = createMovement();
    m.setPosition(5, 10, -3);
    m.setVelocity(1, 2, 3);
    m.setYaw(1.5);
    m.reset();
    const s = m.getState();
    expect(s.posX).toBe(0);
    expect(s.posY).toBe(0);
    expect(s.posZ).toBe(0);
    expect(s.velY).toBe(0);
    expect(s.yaw).toBe(0);
    expect(s.isGrounded).toBe(true);
    expect(m.getParams()).toEqual(DEFAULT_MOVEMENT_PARAMS);
  });

  it('clampMoveInput normalizes magnitudes above 1 and preserves the direction', () => {
    const r = clampMoveInput(3, 4);
    expect(r.len).toBe(1);
    expect(r.x).toBeCloseTo(0.6, 5);
    expect(r.z).toBeCloseTo(0.8, 5);
  });

  it('stepYaw takes the short arc across the PI wrap', () => {
    // From -3.1 (just past -PI) to 3.1 (just before +PI). The long way round
    // is 6.2 radians; the short way is 2*PI - 6.2 ≈ 0.083 radians through -PI.
    // With maxStep = 0.1, we cover the short arc in one step — the result
    // wraps around -PI and lands near -3.183 (same angle as 3.1, mod 2PI).
    const next = stepYaw(-3.1, 3.1, 10, 0.01);
    const shortArc = 2 * Math.PI - (3.1 - -3.1); // ≈ 0.0832
    expect(next).toBeCloseTo(-3.1 - shortArc, 5);
  });
});
