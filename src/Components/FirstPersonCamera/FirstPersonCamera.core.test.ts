import { describe, expect, it, vi } from 'vitest';
import type { BoxBounds } from '../Obstacle/Obstacle.defs';
import { circleOverlapsBox, readPose, resolveWalk, writePose } from './FirstPersonCamera.core';

const R = 0.45;
/** A cabinet-sized box: 1 m wide (x ∈ [0, 1]) and 1 m deep (z ∈ [0, 1]). */
const box: BoxBounds = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
/** A long wall across the room at z ∈ [1, 2]. */
const wall: BoxBounds = { minX: -5, maxX: 5, minZ: 1, maxZ: 2 };

describe('resolveWalk — the walk-collision sweep', () => {
  it('with no boxes, the step lands exactly where it was aimed', () => {
    expect(resolveWalk([0, 0], [1.5, -2], R, [])).toEqual([1.5, -2]);
  });

  it('a step that touches nothing is untouched', () => {
    expect(resolveWalk([-3, -3], [-2.5, -2.5], R, [box, wall])).toEqual([-2.5, -2.5]);
  });

  it('head-on: stops one radius short of the face it walked into', () => {
    // Walking +Z straight at the wall from z = 0; the wall's near face is z = 1.
    const [x, z] = resolveWalk([0, 0], [0, 3], R, [wall]);
    expect(x).toBe(0);
    expect(z).toBeCloseTo(1 - R, 10);
  });

  it('head-on from the far side stops at the far face, not the near one', () => {
    const [, z] = resolveWalk([0, 3], [0, 0], R, [wall]);
    expect(z).toBeCloseTo(2 + R, 10);
  });

  it('glancing: slides along the face instead of stopping dead', () => {
    // Diagonal into the wall: the Z axis is stopped at the face, the X axis
    // keeps the sideways part of the step — the slide.
    const [x, z] = resolveWalk([0, 0], [0.5, 3], R, [wall]);
    expect(x).toBe(0.5);
    expect(z).toBeCloseTo(1 - R, 10);
  });

  it('glancing along a box: X is stopped at the side, Z carries on', () => {
    const [x, z] = resolveWalk([-1, 0.5], [0.5, 0.8], R, [box]);
    expect(x).toBeCloseTo(-R, 10);
    expect(z).toBeCloseTo(0.8, 10);
  });

  it('corner: the circle rounds the corner rather than catching on it', () => {
    // Coming diagonally at the (0, 0) corner. X passes clean (at z = -1 the
    // circle is a full metre off the box); Z then finds the circle clipping
    // the corner and pushes it back out along the corner's normal — so it
    // ends exactly one radius from the corner, on the diagonal it came in on.
    const [x, z] = resolveWalk([-1, -1], [-0.2, -0.2], R, [box]);
    expect(x).toBeLessThan(0);
    expect(z).toBeLessThan(0);
    expect(x).toBeCloseTo(z, 10);
    expect(Math.hypot(x - box.minX, z - box.minZ)).toBeCloseTo(R, 10);
  });

  it('corner: a step aimed into a corner slides round it instead of wedging', () => {
    // Tangent to the (0.6, 1.9) corner and pushing up-and-right into it.
    // Axis by axis both moves would be refused; the normal push turns them
    // into a slide along the corner — x gains, z gives a touch — and the
    // circle stays exactly one radius off the corner.
    const b: BoxBounds = { minX: 0.6, maxX: 1.2, minZ: 1.9, maxZ: 2.5 };
    const start: [number, number] = [0.537, 1.9 - Math.sqrt(R * R - 0.063 * 0.063)];
    expect(Math.hypot(start[0] - b.minX, start[1] - b.minZ)).toBeCloseTo(R, 10);
    const [x, z] = resolveWalk(start, [start[0] + 0.037, start[1] + 0.093], R, [b]);
    expect(x).toBeGreaterThan(start[0] + 0.02);
    expect(z).toBeLessThanOrEqual(start[1] + 1e-9);
    expect(Math.hypot(x - b.minX, z - b.minZ)).toBeCloseTo(R, 10);
  });

  it('corner: a long step that clips a corner is deflected round it, never through it', () => {
    // Skimming past the box's -Z side with 0.2 of the radius inside the
    // corner, 5 m in one step. The corner turns the circle aside (z gives)
    // and it carries on; at no point is it inside the box.
    const [x, z] = resolveWalk([-2, -0.25], [3, -0.25], R, [box]);
    expect(z).toBeLessThan(-0.25);
    expect(x).toBeGreaterThan(-2);
    expect(circleOverlapsBox(x, z, R, box)).toBe(false);
  });

  it('corner: a step aimed straight at a corner point stops one radius from it', () => {
    const [x, z] = resolveWalk([-0.4, -0.4], [0, 0], R, [box]);
    expect(x).toBeLessThan(0);
    expect(z).toBeLessThan(0);
    expect(Math.hypot(x - box.minX, z - box.minZ)).toBeCloseTo(R, 10);
  });

  it('substeps a long diagonal step so it neither tunnels nor lands inside', () => {
    // 6 m in one go, through a cabinet-sized box on the diagonal.
    const [x, z] = resolveWalk([-2, -2], [4, 4], R, [box]);
    expect(circleOverlapsBox(x, z, R, box)).toBe(false);
    // Deflected off the near corner, not carried through the box.
    expect(x).toBeGreaterThan(-2);
    expect(z).toBeGreaterThan(-2);
  });

  it('touching is clear: standing exactly one radius off a face does not get pushed', () => {
    expect(resolveWalk([0, 1 - R], [0, 1 - R], R, [wall])).toEqual([0, 1 - R]);
  });

  it('keeps sliding on the frames AFTER first contact, rounding noise and all', () => {
    // The sweep parks the player at face - R; in floating point that is not
    // quite R off the face (1.9 - 0.45 → 1.4500000000000002), and a naive
    // cross-axis test sees a sliver of overlap and pins them to the wall.
    const b: BoxBounds = { minX: 0.6, maxX: 1.2, minZ: 1.9, maxZ: 2.5 };
    const parked = b.minZ - R;
    expect(R * R - (b.minZ - parked) ** 2).not.toBe(0); // the noise is real
    expect(circleOverlapsBox(0.62, parked, R, b)).toBe(false); // parked is touching, not inside
    const [x, z] = resolveWalk([0.62, parked], [0.66, parked + 0.1], R, [b]);
    expect(x).toBe(0.66); // the slide goes on…
    expect(z).toBeCloseTo(parked, 12); // …while the wall still holds
  });

  it('starting inside: can back out, cannot push deeper, is never displaced', () => {
    const inside: [number, number] = [0.5, 0.2]; // inside `box`, near its z = 0 face
    // Backing out toward the near face is allowed.
    expect(resolveWalk(inside, [0.5, 0.1], R, [box])).toEqual([0.5, 0.1]);
    // Pushing toward the centre is refused on that axis…
    expect(resolveWalk(inside, [0.5, 0.6], R, [box])).toEqual([0.5, 0.2]);
    // …while the other axis can still move away from the centre.
    expect(resolveWalk(inside, [0.3, 0.6], R, [box])).toEqual([0.3, 0.2]);
    // Standing still is standing still — no ejection out the far face.
    expect(resolveWalk(inside, inside, R, [box])).toEqual(inside);
  });

  it('a large step never tunnels through a thin wall', () => {
    // A hitched frame: 3 m in one step through a 20 cm wall.
    const thin: BoxBounds = { minX: -5, maxX: 5, minZ: 1, maxZ: 1.2 };
    const [, z] = resolveWalk([0, 0], [0, 3], R, [thin]);
    expect(z).toBeCloseTo(1 - R, 10);
  });

  it('two neighbours closer than the body is wide: the result does not depend on their order', () => {
    const a: BoxBounds = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };
    const b: BoxBounds = { minX: 2.3, maxX: 3, minZ: -1, maxZ: 1 };
    const ab = resolveWalk([0, 0], [2.7, 0], R, [a, b]);
    const ba = resolveWalk([0, 0], [2.7, 0], R, [b, a]);
    expect(ab).toEqual(ba);
    expect(ab[0]).toBeCloseTo(1 - R, 10);
  });

  it('passes a box it only skirts on the other axis', () => {
    // Walking +Z alongside the box, a full radius clear of its side.
    const [x, z] = resolveWalk([-0.5, -1], [-0.5, 2], R, [box]);
    expect(x).toBe(-0.5);
    expect(z).toBe(2);
  });
});

describe('circleOverlapsBox', () => {
  it('overlaps a face, clears when a radius away, and rounds the corners', () => {
    expect(circleOverlapsBox(0.5, -0.2, R, box)).toBe(true);
    expect(circleOverlapsBox(0.5, -R, R, box)).toBe(false);
    // Corner: 0.4 off in both axes is 0.566 away — clear; 0.3 is 0.42 — overlap.
    expect(circleOverlapsBox(-0.4, -0.4, R, box)).toBe(false);
    expect(circleOverlapsBox(-0.3, -0.3, R, box)).toBe(true);
    // Centre inside the box.
    expect(circleOverlapsBox(0.5, 0.5, R, box)).toBe(true);
    // Past the +X / +Z faces too (the other arm of each clamp).
    expect(circleOverlapsBox(1.2, 1.2, R, box)).toBe(true);
    expect(circleOverlapsBox(1.5, 0.5, R, box)).toBe(false);
  });
});

describe('pose persistence codec', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  it('round-trips a pose', () => {
    const store = memory();
    expect(writePose(store, 'room', { x: 1.5, z: -2, yaw: Math.PI })).toBe(true);
    expect(readPose(store, 'room')).toEqual({ x: 1.5, z: -2, yaw: Math.PI });
  });

  it('reads nothing when nothing was stored, or the store is missing', () => {
    expect(readPose(memory(), 'room')).toBeNull();
    expect(readPose(null, 'room')).toBeNull();
    expect(readPose(undefined, 'room')).toBeNull();
    expect(writePose(null, 'room', { x: 0, z: 0, yaw: 0 })).toBe(false);
  });

  it('rejects anything that is not three finite numbers', () => {
    const store = memory();
    store.setItem('room', 'not json');
    expect(readPose(store, 'room')).toBeNull();
    store.setItem('room', 'null');
    expect(readPose(store, 'room')).toBeNull();
    store.setItem('room', '"a string"');
    expect(readPose(store, 'room')).toBeNull();
    store.setItem('room', JSON.stringify({ x: 1, z: 'two', yaw: 0 }));
    expect(readPose(store, 'room')).toBeNull();
    store.setItem('room', JSON.stringify({ x: 1, z: 2 }));
    expect(readPose(store, 'room')).toBeNull();
  });

  it('a store that throws reads as empty and writes as refused', () => {
    const angry = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    };
    expect(readPose(angry, 'room')).toBeNull();
    expect(writePose(angry, 'room', { x: 0, z: 0, yaw: 0 })).toBe(false);
  });
});
