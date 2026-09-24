/**
 * The Physics adapter plugins, driven through fake hosts. The Babylon plugin
 * gets a stand-in Havok plugin that answers casts, so the two traps its header
 * warns about (a body that is not one of ours, and the hitPoint/hitNormal
 * fields) are checked without loading WASM.
 */

import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { ShapeCastResult } from '@babylonjs/core/Physics/shapeCastResult';
import { PHYSICS_EXTENSION } from '../Physics.defs';
import { createBabylonExtension, type BabylonExtensionHost } from './Physics.babylon';
import { createThreeExtension } from './Physics.three';
import { createMockExtension } from './Physics.mock';
import { registerPhysicsExtension } from './register';

const OURS = { tag: 'our body' };
const STRANGER = { tag: 'not registered' };

function fakeHavok(hit: { body: object; point: number[]; normal: number[] } | null) {
  const fill = (res: PhysicsRaycastResult | ShapeCastResult) => {
    res.reset();
    if (!hit) return;
    res.setHitData(new Vector3(...(hit.normal as [number, number, number])), new Vector3(...(hit.point as [number, number, number])));
    res.body = hit.body as never;
  };
  return {
    raycast: vi.fn((_from: Vector3, _to: Vector3, res: PhysicsRaycastResult) => {
      fill(res);
      if (hit) res.setHitDistance(4);
    }),
    shapeCast: vi.fn((_q: unknown, _input: ShapeCastResult, res: ShapeCastResult) => {
      fill(res);
      if (hit) res.setHitFraction(0.25);
    }),
    initShape: vi.fn(),
    disposeShape: vi.fn(),
  };
}

function babylonHost(havok: ReturnType<typeof fakeHavok> | null, body: Record<string, unknown> | null = null) {
  const scene = {
    getPhysicsEngine: () => ({ getPluginVersion: () => 2, getPhysicsPlugin: () => havok }),
  };
  const host: BabylonExtensionHost = {
    getScene: () => scene as never,
    getPhysicsBody: () => body as never,
    getHavokPlugin: () => havok as never,
    getMeshIdForBody: (b) => (b === (OURS as never) ? 'rock-1' : undefined),
  };
  return host;
}

describe('Physics.babylon', () => {
  it('cannot query until Havok has loaded, and casts miss meanwhile', () => {
    const ext = createBabylonExtension(babylonHost(null));
    expect(ext.canQuery()).toBe(false);
    expect(ext.raycast([0, 0, 0], [0, 0, 10])).toBeNull();
    expect(ext.sphereCast([0, 0, 0], [0, 0, 10], 0.5)).toBeNull();
  });

  it('a raycast that hits one of our bodies reports its mesh id, point, normal and distance', () => {
    const havok = fakeHavok({ body: OURS, point: [0, 0, 4], normal: [0, 0, -1] });
    const ext = createBabylonExtension(babylonHost(havok));
    expect(ext.canQuery()).toBe(true);
    expect(ext.raycast([0, 0, 0], [0, 0, 10])).toEqual({
      meshId: 'rock-1',
      point: [0, 0, 4],
      normal: [0, 0, -1],
      distance: 4,
    });
  });

  it('a hit on a body that is not ours is a miss, not a hit on a nearby id', () => {
    const ext = createBabylonExtension(babylonHost(fakeHavok({ body: STRANGER, point: [1, 2, 3], normal: [0, 1, 0] })));
    expect(ext.raycast([0, 0, 0], [0, 0, 10])).toBeNull();
  });

  it('a raycast that hits nothing is a miss', () => {
    expect(createBabylonExtension(babylonHost(fakeHavok(null))).raycast([0, 0, 0], [0, 0, 10])).toBeNull();
  });

  it('a sphere cast turns the hit fraction into a distance and reuses one shape per radius', () => {
    const havok = fakeHavok({ body: OURS, point: [0, 0, 2.5], normal: [0, 0, -1] });
    const ext = createBabylonExtension(babylonHost(havok));
    expect(ext.sphereCast([0, 0, 0], [0, 0, 10], 0.5)?.distance).toBeCloseTo(2.5);
    ext.sphereCast([0, 0, 0], [0, 0, 10], 0.501); // rounds to the same centimetre
    ext.sphereCast([0, 0, 0], [0, 0, 10], 0.75);
    expect(havok.initShape).toHaveBeenCalledTimes(2);
  });

  it('a sphere cast with no scene is a miss', () => {
    const host = { ...babylonHost(fakeHavok(null)), getScene: () => null };
    expect(createBabylonExtension(host).sphereCast([0, 0, 0], [0, 0, 1], 1)).toBeNull();
  });

  it('resizeBoxBody swaps in a new box shape and disposes the old one', () => {
    const havok = fakeHavok(null);
    const old = { dispose: vi.fn() };
    const body: Record<string, unknown> = { shape: old };
    createBabylonExtension(babylonHost(havok, body)).resizeBoxBody('paddle', [1, 0.5, 2]);
    expect(body.shape).not.toBe(old);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(havok.initShape).toHaveBeenCalledOnce();
  });

  it('the body controls do nothing for a mesh with no body', () => {
    const ext = createBabylonExtension(babylonHost(fakeHavok(null), null));
    expect(() => {
      ext.resizeBoxBody('none', [1, 1, 1]);
      ext.setBodyAngularVelocity('none', 1, 2, 3);
      ext.setBodyDrivenByMesh('none', true);
    }).not.toThrow();
  });

  it('sets angular velocity and flips pre-step for "driven by mesh"', () => {
    const body: Record<string, unknown> = { setAngularVelocity: vi.fn(), disablePreStep: true };
    const ext = createBabylonExtension(babylonHost(fakeHavok(null), body));
    ext.setBodyAngularVelocity('plunger', 1, 2, 3);
    expect((body.setAngularVelocity as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ x: 1, y: 2, z: 3 });
    ext.setBodyDrivenByMesh('plunger', true);
    expect(body.disablePreStep).toBe(false);
    ext.setBodyDrivenByMesh('plunger', false);
    expect(body.disablePreStep).toBe(true);
  });
});

describe('Physics.three', () => {
  it('answers no queries and forwards the body controls to Rapier', () => {
    const backend = { setAngularVelocity: vi.fn(), setDrivenByMesh: vi.fn(), resizeBoxBody: vi.fn() };
    const ext = createThreeExtension({ getRapierBackend: () => backend });
    expect(ext.canQuery()).toBe(false);
    expect(ext.raycast([0, 0, 0], [0, 0, 1])).toBeNull();
    expect(ext.sphereCast([0, 0, 0], [0, 0, 1], 1)).toBeNull();
    ext.resizeBoxBody('a', [1, 2, 3]);
    ext.setBodyAngularVelocity('a', 4, 5, 6);
    ext.setBodyDrivenByMesh('a', true);
    expect(backend.resizeBoxBody).toHaveBeenCalledWith('a', 1, 2, 3);
    expect(backend.setAngularVelocity).toHaveBeenCalledWith('a', 4, 5, 6);
    expect(backend.setDrivenByMesh).toHaveBeenCalledWith('a', true);
  });

  it('does nothing on the pure-core path with no backend', () => {
    const ext = createThreeExtension({ getRapierBackend: () => null });
    expect(() => ext.setBodyDrivenByMesh('a', false)).not.toThrow();
  });
});

describe('Physics.mock', () => {
  it('reports no queries by default and records every call', () => {
    const ext = createMockExtension();
    expect(ext.canQuery()).toBe(false);
    expect(ext.raycast([0, 0, 0], [1, 0, 0])).toBeNull();
    expect(ext.sphereCast([0, 0, 0], [1, 0, 0], 2)).toBeNull();
    ext.resizeBoxBody('b', [1, 1, 1]);
    ext.setBodyAngularVelocity('b', 0, 1, 0);
    ext.setBodyDrivenByMesh('b', true);
    expect(ext.calls.map((c) => c.method)).toEqual([
      'raycast', 'sphereCast', 'resizeBoxBody', 'setBodyAngularVelocity', 'setBodyDrivenByMesh',
    ]);
  });

  it('returns the scripted hit when a test supplies one', () => {
    const hit = { meshId: 'x', point: [0, 0, 1] as [number, number, number], normal: [0, 0, -1] as [number, number, number], distance: 1 };
    const ext = createMockExtension({ raycast: () => hit, sphereCast: () => hit });
    expect(ext.canQuery()).toBe(true);
    expect(ext.raycast([0, 0, 0], [0, 0, 2])).toBe(hit);
    expect(ext.sphereCast([0, 0, 0], [0, 0, 2], 1)).toBe(hit);
  });
});

describe('registerPhysicsExtension', () => {
  it.each(['babylon', 'three'])('registers a plugin on a %s adapter', (kind) => {
    const registerExtension = vi.fn();
    registerPhysicsExtension({ kind, registerExtension });
    expect(registerExtension).toHaveBeenCalledWith(PHYSICS_EXTENSION, expect.any(Object));
  });

  it('registers nothing on babylon-lite or mock', () => {
    const registerExtension = vi.fn();
    registerPhysicsExtension({ kind: 'babylon-lite', registerExtension });
    registerPhysicsExtension({ kind: 'mock', registerExtension });
    expect(registerExtension).not.toHaveBeenCalled();
  });
});
