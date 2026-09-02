import { describe, expect, it } from 'vitest';
import {
  NEON_TEXT_EXTENSION,
  extrudedTextTransform,
  sameTriple,
  signNormal,
  spotDirection,
} from './NeonSign.core';

describe('NeonSign.core', () => {
  it('names the extension the System looks up', () => {
    expect(NEON_TEXT_EXTENSION).toBe('neonText');
  });

  it('signNormal faces +Z at yaw 0 and +X at yaw π/2', () => {
    expect(signNormal(0)).toEqual([0, 0, 1]);
    const n = signNormal(Math.PI / 2);
    expect(n[0]).toBeCloseTo(1, 10);
    expect(n[2]).toBeCloseTo(0, 10);
  });

  it('spotDirection aims along the facing, tilted 0.4 down, unit length', () => {
    const d = spotDirection(0);
    const len = Math.hypot(1, 0.4);
    expect(d[0]).toBeCloseTo(0, 10);
    expect(d[1]).toBeCloseTo(-0.4 / len, 10);
    expect(d[2]).toBeCloseTo(1 / len, 10);
    expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 10);
    // A sign on the right wall (facing -X) throws its light toward -X.
    const left = spotDirection(-Math.PI / 2);
    expect(left[0]).toBeCloseTo(-1 / len, 10);
    expect(left[1]).toBeCloseTo(-0.4 / len, 10);
  });

  it('extrudedTextTransform pushes the slab out by depth/2 + 1 cm and keeps the sign\'s own yaw', () => {
    const t = extrudedTextTransform([0, 2.75, -5.86], 0, 0.088);
    expect(t.position[0]).toBeCloseTo(0, 10);
    expect(t.position[1]).toBeCloseTo(2.75, 10);
    expect(t.position[2]).toBeCloseTo(-5.86 + 0.044 + 0.01, 10);
    // No half-turn: the extruded text's readable face is local +Z, the side
    // signNormal(yaw) points. A +π here shows the slab's back — mirrored
    // lettering in a right-handed scene (the old left-handed room's constant).
    expect(t.rotationY).toBeCloseTo(0, 10);
    const side = extrudedTextTransform([5.86, 1.95, 3.8], -Math.PI / 2, 0.088);
    expect(side.position[0]).toBeCloseTo(5.86 - 0.054, 10);
    expect(side.rotationY).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('sameTriple compares within an epsilon and treats undefined as different', () => {
    expect(sameTriple([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(sameTriple([1, 2, 3], [1, 2, 3.0000001])).toBe(true);
    expect(sameTriple([1, 2, 3], [1, 2, 3.1])).toBe(false);
    expect(sameTriple([1, 2, 3], [1, 2.1, 3])).toBe(false);
    expect(sameTriple([1, 2, 3], [1.1, 2, 3])).toBe(false);
    expect(sameTriple(undefined, [1, 2, 3])).toBe(false);
  });
});
