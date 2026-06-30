import { describe, it, expect } from 'vitest';
import { Component, System } from '@babylonjsmarket/ecs';
import {
  ARCADE_COMPONENT_REGISTRY,
  ARCADE_COMPONENT_NAMES,
  type LazyComponentResolver,
} from './registry';

const EXPECTED_NAMES = [
  // Core rendering / IO
  'MeshPrimitive',
  'Movement',
  'KeyboardMover',
  'PlayerInput',
  'ArcCamera',
  'CameraFollow',
  'DirectionalLight',
  'HemisphericLight',
  'Physics',
  'Score',
  'Scoreboard',
  'Health',
  'HealthBar',
  'Flash',
  'Shadow',
  'Skybox',
  'EnvironmentTexture',
  'Animation',
  'Mesh',
  // Pinball
  'Plunger',
  'PinballCamera',
  'PinballLayout',
  'PinballTable',
  'PinballBuilder',
  'PinballBuilderInput',
  'Bumper',
  'Flipper',
  'MouseHole',
  'Spinner',
  // Top-down shooter
  'BulletPool',
  'Bullet',
  'EntityPool',
  'Enemy',
  'SkeletonAnimator',
  'EnemySpawner',
  'ObstacleField',
  'LineOfSight',
  'TwinStickShooter',
  'ShooterCamera',
] as const;

/**
 * Pure-data components that intentionally ship WITHOUT their own System (the
 * consuming system lives in a sibling component's module) — exempt from the
 * "module exports <Name>System" assertion. Empty now that the premium 6-DOF
 * flight stack (the only data-only set) is vendored per-game instead of shipped
 * in the free registry.
 */
const DATA_ONLY_NAMES = new Set<string>([]);

type ComponentClass = new (...args: never[]) => Component;
type SystemClass = new (...args: never[]) => System;

describe('ARCADE_COMPONENT_REGISTRY', () => {
  it('contains exactly the expected component names', () => {
    const keys = Object.keys(ARCADE_COMPONENT_REGISTRY).sort();
    expect(keys).toEqual([...EXPECTED_NAMES].sort());
    expect(keys).toHaveLength(EXPECTED_NAMES.length);
  });

  it('exports ARCADE_COMPONENT_NAMES matching the registry keys', () => {
    expect([...ARCADE_COMPONENT_NAMES].sort()).toEqual(
      Object.keys(ARCADE_COMPONENT_REGISTRY).sort(),
    );
  });

  it('exposes a function resolver for every entry (no eager loading)', () => {
    for (const name of EXPECTED_NAMES) {
      const resolver = ARCADE_COMPONENT_REGISTRY[name] as LazyComponentResolver;
      expect(typeof resolver).toBe('function');
      // Function takes no arguments — it's a thunk around dynamic import.
      expect(resolver.length).toBe(0);
    }
  });

  it('every resolver returns a Promise', () => {
    for (const name of EXPECTED_NAMES) {
      const result = ARCADE_COMPONENT_REGISTRY[name]!();
      expect(result).toBeInstanceOf(Promise);
    }
  });

  it('every resolved module exports <Name>Component as a class extending Component', async () => {
    for (const name of EXPECTED_NAMES) {
      const mod = await ARCADE_COMPONENT_REGISTRY[name]!();
      const componentExportName = `${name}Component`;
      const ComponentCtor = mod[componentExportName] as ComponentClass | undefined;
      expect(
        ComponentCtor,
        `Module for "${name}" must export ${componentExportName}`,
      ).toBeDefined();
      expect(typeof ComponentCtor).toBe('function');
      expect(ComponentCtor!.prototype).toBeInstanceOf(Component);
    }
    // Bumped — 39 modules x dynamic import + Solid transform can exceed the
    // default 5 s under parallel-suite contention.
  }, 30_000);

  it('every resolved module exports <Name>System as a class extending System', async () => {
    for (const name of EXPECTED_NAMES) {
      if (DATA_ONLY_NAMES.has(name)) continue; // pure-data components own no System
      const mod = await ARCADE_COMPONENT_REGISTRY[name]!();
      const systemExportName = `${name}System`;
      const SystemCtor = mod[systemExportName] as SystemClass | undefined;
      expect(
        SystemCtor,
        `Module for "${name}" must export ${systemExportName}`,
      ).toBeDefined();
      expect(typeof SystemCtor).toBe('function');
      expect(SystemCtor!.prototype).toBeInstanceOf(System);
    }
  }, 30_000);

  it('caches the import so repeated resolver calls return the same module instance', async () => {
    const resolver = ARCADE_COMPONENT_REGISTRY.MeshPrimitive!;
    const first = await resolver();
    const second = await resolver();
    const third = await resolver();
    expect(second).toBe(first);
    expect(third).toBe(first);
    // And the exported class references are identical too.
    expect(second.MeshPrimitiveComponent).toBe(first.MeshPrimitiveComponent);
    expect(second.MeshPrimitiveSystem).toBe(first.MeshPrimitiveSystem);
  });

  it('MeshPrimitiveComponent can be instantiated and inherits from Component', async () => {
    const mod = await ARCADE_COMPONENT_REGISTRY.MeshPrimitive!();
    const Ctor = mod.MeshPrimitiveComponent as new (input?: unknown) => Component;
    const instance = new Ctor({ kind: 'box' });
    expect(instance).toBeInstanceOf(Component);
  });

  it('MovementComponent can be instantiated and inherits from Component', async () => {
    const mod = await ARCADE_COMPONENT_REGISTRY.Movement!();
    const Ctor = mod.MovementComponent as new (input?: unknown) => Component;
    const instance = new Ctor();
    expect(instance).toBeInstanceOf(Component);
  });
});
