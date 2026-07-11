/**
 * validate-example-scenes.ts — load every catalog component's sidecar
 * `example.scene.json` through the ECS SceneLoader and prove it instantiates
 * cleanly with no real graphics engine.
 *
 * For each of the 28 catalog components in
 *   CodeLibrary/Components/<Name>/example.scene.json
 * the validator:
 *   1. Builds a World wired to a MockRendererAdapter.
 *   2. Resolves + registers every component the scene names (arcade registry +
 *      the three off-registry extras: Obstacle, MoneyField, PlayerWalkAnimator).
 *   3. Instantiates the scene via SceneLoader and backfills systems via
 *      world.addSystem — the same "entities first, then systems" order the live
 *      ArcadeGame path uses.
 *   4. Runs a few world.update(1/60) ticks.
 *   5. Asserts: no throw, the scene's entities exist, and the TARGET component's
 *      System is present (Obstacle is the documented exception — it ships no
 *      system, so we assert its Component is present instead).
 *
 * Run:
 *   npx tsx packages/arcade/scripts/validate-example-scenes.ts
 *   npx tsx packages/arcade/scripts/validate-example-scenes.ts ArcCamera   # one
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

import {
  World,
  EventBus,
  SceneLoader,
  MockRendererAdapter,
  type Component,
  type System,
} from '@babylonjsmarket/ecs';

import {
  ARCADE_COMPONENT_REGISTRY,
  type LazyComponentResolver,
} from '../src/registry';

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/arcade/scripts -> repo root
const REPO_ROOT = resolvePath(__dirname, '..', '..', '..');
const COMPONENTS_DIR = resolvePath(REPO_ROOT, 'CodeLibrary', 'Components');

/**
 * The full catalog (28). Order groups by tier for a readable report.
 */
const CATALOG: string[] = [
  // core
  'ArcCamera', 'EntityPool', 'Mesh', 'MeshPrimitive', 'Physics', 'Score',
  // pinball
  'Bumper', 'Flipper', 'MouseHole', 'PinballBuilder', 'PinballBuilderInput',
  'PinballCamera', 'PinballLayout', 'PinballTable', 'Plunger', 'Spinner',
  // shooter
  'Bullet', 'Enemy', 'EnemySpawner', 'Health', 'LineOfSight',
  'MoneyField', 'Obstacle', 'PlayerWalkAnimator', 'ShooterCamera',
  'SkeletonAnimator', 'TwinStickShooter',
];
// (BulletPool retired — no component dir / example.scene.json — so it's not in
// the catalog anymore. Pooling is the generic Pool blueprint now.)

/**
 * Components that ship no System (validated on Component presence instead).
 */
const SYSTEMLESS = new Set<string>(['Obstacle']);

/**
 * Off-registry resolvers, merged on top of ARCADE_COMPONENT_REGISTRY:
 *   - Obstacle: in the arcade package but intentionally absent from the lazy
 *     registry (no system, static collision data).
 *   - MoneyField / PlayerWalkAnimator: game-local (games/src/games/arcade/shooter).
 */
const EXTRA_RESOLVERS: Record<string, LazyComponentResolver> = {
  Obstacle: () =>
    import('../src/Components/Obstacle/Obstacle') as Promise<Record<string, unknown>>,
  MoneyField: () =>
    import(
      resolvePath(REPO_ROOT, 'games/src/games/arcade/shooter/MoneyField.ts')
    ) as Promise<Record<string, unknown>>,
  PlayerWalkAnimator: () =>
    import(
      resolvePath(REPO_ROOT, 'games/src/games/arcade/shooter/PlayerWalkAnimator.ts')
    ) as Promise<Record<string, unknown>>,
};

const RESOLVERS: Record<string, LazyComponentResolver> = {
  ...ARCADE_COMPONENT_REGISTRY,
  ...EXTRA_RESOLVERS,
};

/**
 * Resolve a component by name: the arcade free registry / extras first, then
 * fall back to its published home under CodeLibrary/Components/<Name>/<Name>.ts.
 * The pinball + shooter kits (Bumper, Flipper, TwinStickShooter, ShooterCamera,
 * …) were vendored OUT of packages/arcade into the marketplace, so their modules
 * no longer live in ../src/Components — but their example.scene.json sidecars
 * still do, and the CATALOG still validates them. Without this fallback every
 * premium component reads as "no resolver" and its system never registers.
 */
function resolverFor(name: string): LazyComponentResolver | undefined {
  if (RESOLVERS[name]) return RESOLVERS[name];
  for (const ext of ['.ts', '.tsx']) {
    const file = resolvePath(COMPONENTS_DIR, name, `${name}${ext}`);
    if (existsSync(file)) return () => import(file) as Promise<Record<string, unknown>>;
  }
  return undefined;
}

interface SceneJson {
  name: string;
  entities?: Record<string, { components?: Record<string, unknown> }>;
}

/** Walk the scene (incl. nested EntityPool component sets) for component names. */
function collectComponentNames(scene: SceneJson): Set<string> {
  const names = new Set<string>();
  const visitComponents = (components: Record<string, unknown> | undefined) => {
    if (!components) return;
    for (const [name, data] of Object.entries(components)) {
      names.add(name);
      // EntityPool declares a nested per-entity component set.
      if (
        name === 'EntityPool' &&
        data &&
        typeof data === 'object' &&
        'components' in (data as Record<string, unknown>)
      ) {
        visitComponents(
          (data as { components?: Record<string, unknown> }).components,
        );
      }
    }
  };
  for (const entity of Object.values(scene.entities ?? {})) {
    visitComponents(entity.components);
  }
  return names;
}

async function registerNames(
  names: Iterable<string>,
  loader: SceneLoader,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const name of names) {
    const resolve = resolverFor(name);
    if (!resolve) {
      warnings.push(`no resolver for "${name}"`);
      continue;
    }
    const mod = await resolve();
    const ComponentClass = mod[`${name}Component`] as
      | (new (data?: unknown) => Component)
      | undefined;
    const SystemClass = mod[`${name}System`] as
      | (new (eventBus: EventBus) => System)
      | undefined;
    if (!ComponentClass) {
      warnings.push(`module for "${name}" missing ${name}Component export`);
      continue;
    }
    loader.registerComponent(name, ComponentClass, SystemClass);
  }
  return warnings;
}

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

async function validateOne(name: string): Promise<Result> {
  const scenePath = resolvePath(COMPONENTS_DIR, name, 'example.scene.json');
  if (!existsSync(scenePath)) {
    return { name, pass: false, detail: `missing ${scenePath}` };
  }

  let scene: SceneJson;
  try {
    scene = JSON.parse(readFileSync(scenePath, 'utf8'));
  } catch (e) {
    return { name, pass: false, detail: `bad JSON: ${(e as Error).message}` };
  }

  try {
    const eventBus = new EventBus();
    const loader = new SceneLoader(eventBus);
    const world = new World({
      eventBus,
      sceneLoader: loader,
      renderer: new MockRendererAdapter(),
      detectRaces: false,
    });

    const names = collectComponentNames(scene);
    if (!names.has(name)) {
      return {
        name,
        pass: false,
        detail: `scene never references the target component "${name}"`,
      };
    }

    const warnings = await registerNames(names, loader);

    loader.loadSceneFromData(
      scene as Parameters<SceneLoader['loadSceneFromData']>[0],
    );
    const { entities, systems } = loader.instantiateScene(scene.name, world);
    // Backfill systems the same way the live ArcadeGame path does.
    for (const system of systems) world.addSystem(system);

    // Tick a few frames — exercises onUpdate / lazy pool registration / etc.
    for (let i = 0; i < 5; i++) world.update(1 / 60);

    // ---- assertions ----
    if (entities.size === 0) {
      return { name, pass: false, detail: 'no entities created' };
    }
    if (world.getEntityCount() === 0) {
      return { name, pass: false, detail: 'world has no entities after load' };
    }

    if (SYSTEMLESS.has(name)) {
      // No system ships — assert the Component instead.
      const ComponentClass = loader.getComponentClass(name);
      const present =
        !!ComponentClass &&
        world.getEntitiesWithComponent(ComponentClass as never).length > 0;
      if (!present) {
        return {
          name,
          pass: false,
          detail: `${name}Component not present on any entity`,
        };
      }
      return {
        name,
        pass: true,
        detail: `systemless OK (component present)${warnings.length ? ` [warn: ${warnings.join('; ')}]` : ''}`,
      };
    }

    const sysName = `${name}System`;
    const hasSystem = world
      .getSystems()
      .some((s) => s.constructor.name === sysName);
    if (!hasSystem) {
      return {
        name,
        pass: false,
        detail: `${sysName} not present/active (systems: ${world
          .getSystems()
          .map((s) => s.constructor.name)
          .join(', ')})`,
      };
    }

    return {
      name,
      pass: true,
      detail: `OK (${world.getEntityCount()} entities, ${world.getSystems().length} systems)${warnings.length ? ` [warn: ${warnings.join('; ')}]` : ''}`,
    };
  } catch (e) {
    return {
      name,
      pass: false,
      detail: `THREW: ${(e as Error).stack ?? (e as Error).message}`,
    };
  }
}

async function main() {
  const only = process.argv.slice(2);
  const targets = only.length ? only : CATALOG;

  const results: Result[] = [];
  for (const name of targets) {
    results.push(await validateOne(name));
  }

  const pad = Math.max(...results.map((r) => r.name.length));
  let failed = 0;
  console.log('\n=== Example Scene Validation ===\n');
  for (const r of results) {
    if (!r.pass) failed++;
    const tag = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.name.padEnd(pad)}  ${r.detail}`);
  }
  console.log(
    `\n${results.length - failed}/${results.length} passed, ${failed} failed.\n`,
  );
  process.exit(failed ? 1 : 0);
}

main();
