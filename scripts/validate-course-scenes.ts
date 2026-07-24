/**
 * validate-course-scenes.ts — load every course CATCH-UP scene through the ECS
 * SceneLoader and prove it instantiates cleanly, with NO browser, NO `bjs`
 * login, NO ffmpeg, and NO assets on disk.
 *
 * Each build-along lesson tells a student to catch up with
 *   `bjs download scene <Name> --all`
 * which pulls a committed scene snapshot from the library. Those snapshots live
 * at:
 *   CodeLibrary/Scenes/<Name>/scene.json                     (spaceshooter checkpoints, twinstick)
 *   CodeLibrary/Components/<Name>/example.scene.json          (poker sidecar: PokerTableDirector)
 *
 * The real end-to-end proof that a catch-up scene renders is the heavy
 * `asset-pipeline render-course` harness (scaffold + `bjs download` + Puppeteer +
 * ffmpeg). This is its fast, hermetic little sibling: for every scene a course
 * references — plus every snapshot under CodeLibrary/Scenes — it
 *   1. builds a World wired to a MockRendererAdapter,
 *   2. resolves EVERY component the scene names via a generic resolver
 *      (arcade free registry -> CodeLibrary/Components/<Name>/<Name>.ts -> a few
 *      game-local extras),
 *   3. instantiates the scene + backfills systems (the live ArcadeGame order),
 *   4. ticks a few frames,
 * and FAILS on: a component with no resolver (the "Component not registered" /
 * "No resolver" class the render harness catches at runtime), a component module
 * missing its `<Name>Component` export, a load/tick throw, or zero entities.
 *
 * It does NOT prove the GLB/texture assets exist (asset keys don't map cleanly to
 * on-disk paths — that's render-course's job); it proves the scene WIRES UP: every
 * component the student downloads actually resolves and the scene assembles.
 *
 * Run:
 *   npx tsx packages/arcade/scripts/validate-course-scenes.ts
 *   npx tsx packages/arcade/scripts/validate-course-scenes.ts SpaceshooterFlight1-lesson-6   # one
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

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
const SCENES_DIR = resolvePath(REPO_ROOT, 'CodeLibrary', 'Scenes');
const COMPONENTS_DIR = resolvePath(REPO_ROOT, 'CodeLibrary', 'Components');
const COURSES_DIR = resolvePath(REPO_ROOT, 'courses');

// Same `bjs download scene <name>` matcher the asset-pipeline scanner uses.
const DOWNLOAD_SCENE_RE = /bjs\s+download\s+scene\s+([A-Za-z0-9._-]+)/g;

// ----------------------------------------------------------------------------
// Component resolution — arcade free registry, then CodeLibrary components, then
// a few game-local extras (mirrors validate-example-scenes.ts).
// ----------------------------------------------------------------------------

const EXTRA_RESOLVERS: Record<string, LazyComponentResolver> = {
  // In the arcade package but intentionally off the lazy registry (no system).
  Obstacle: () =>
    import('../src/Components/Obstacle/Obstacle') as Promise<Record<string, unknown>>,
  // Game-local shooter components (not published as CodeLibrary components).
  MoneyField: () =>
    import(resolvePath(REPO_ROOT, 'games/src/games/arcade/shooter/MoneyField.ts')) as Promise<
      Record<string, unknown>
    >,
  PlayerWalkAnimator: () =>
    import(
      resolvePath(REPO_ROOT, 'games/src/games/arcade/shooter/PlayerWalkAnimator.ts')
    ) as Promise<Record<string, unknown>>,
};

/** Build a resolver for one component name, or null if nothing provides it. */
function resolverFor(name: string): LazyComponentResolver | null {
  if (ARCADE_COMPONENT_REGISTRY[name]) return ARCADE_COMPONENT_REGISTRY[name];
  for (const ext of ['.ts', '.tsx']) {
    const file = resolvePath(COMPONENTS_DIR, name, `${name}${ext}`);
    if (existsSync(file)) return () => import(file) as Promise<Record<string, unknown>>;
  }
  if (EXTRA_RESOLVERS[name]) return EXTRA_RESOLVERS[name];
  return null;
}

interface SceneJson {
  name: string;
  entities?: Record<string, { components?: Record<string, unknown> }>;
}

/**
 * Collect every component name a scene references, recursing into any nested
 * `components` block (EntityPool's per-slot set, a Pool blueprint's offspring,
 * etc.) so pooled/blueprinted components are resolved too.
 */
function collectComponentNames(scene: SceneJson): Set<string> {
  const names = new Set<string>();
  const visit = (components: Record<string, unknown> | undefined) => {
    if (!components) return;
    for (const [name, data] of Object.entries(components)) {
      names.add(name);
      if (data && typeof data === 'object' && 'components' in (data as Record<string, unknown>)) {
        visit((data as { components?: Record<string, unknown> }).components);
      }
    }
  };
  for (const entity of Object.values(scene.entities ?? {})) visit(entity.components);
  return names;
}

/**
 * A `<Name>Debugger` whose base component ships a `.viz.tsx` panel is a dev-only
 * viz debugger. Those are Solid/JSX panels (not headless-loadable here) and are
 * NOT downloadable components — a student's `bjs download scene` never pulls
 * them, and the arcade viz layer registers them separately. So we deliberately
 * skip them in this gameplay-wiring check (the full render-course browser
 * harness is what exercises panels). Precise: only skip if the panel file
 * actually exists, so a genuinely-missing component still fails.
 */
function isVizDebugPanel(name: string): boolean {
  if (!name.endsWith('Debugger')) return false;
  const base = name.replace(/Debugger$/, '');
  return existsSync(resolvePath(COMPONENTS_DIR, base, `${base}.viz.tsx`));
}

interface RegisterResult {
  /** Component names with no resolver / bad export — a real failure. */
  unresolved: string[];
  /** Viz debug panels intentionally skipped (see isVizDebugPanel). */
  skippedViz: string[];
}

/** Register each name against the loader. */
async function registerNames(names: Iterable<string>, loader: SceneLoader): Promise<RegisterResult> {
  const unresolved: string[] = [];
  const skippedViz: string[] = [];
  for (const name of names) {
    if (isVizDebugPanel(name)) {
      skippedViz.push(name);
      continue;
    }
    const resolve = resolverFor(name);
    if (!resolve) {
      unresolved.push(name);
      continue;
    }
    const mod = await resolve();
    const ComponentClass = mod[`${name}Component`] as (new (data?: unknown) => Component) | undefined;
    const SystemClass = mod[`${name}System`] as (new (eventBus: EventBus) => System) | undefined;
    if (!ComponentClass) {
      unresolved.push(`${name} (module has no ${name}Component export)`);
      continue;
    }
    loader.registerComponent(name, ComponentClass, SystemClass);
  }
  return { unresolved, skippedViz };
}

// ----------------------------------------------------------------------------
// Target enumeration
// ----------------------------------------------------------------------------

interface Target {
  /** Scene key, e.g. `SpaceshooterFlight1-lesson-6` or `PokerTableDirector`. */
  label: string;
  /** Absolute scene.json path, or null if the course references a scene with no source. */
  scenePath: string | null;
  /** Where this target came from (for the report). */
  origin: string;
}

/** Resolve a `bjs download scene <name>` name to its committed source file. */
function resolveSceneSource(name: string): string | null {
  const sceneFile = join(SCENES_DIR, name, 'scene.json');
  if (existsSync(sceneFile)) return sceneFile;
  const sidecar = join(COMPONENTS_DIR, name, 'example.scene.json');
  if (existsSync(sidecar)) return sidecar;
  return null;
}

/** Every `bjs download scene <name>` referenced by any course lesson. */
function courseSceneRefs(): Map<string, string> {
  const refs = new Map<string, string>(); // name -> "course/lesson.md"
  if (!existsSync(COURSES_DIR)) return refs;
  for (const course of readdirSync(COURSES_DIR)) {
    const articles = join(COURSES_DIR, course, 'articles');
    if (!existsSync(articles) || !statSync(articles).isDirectory()) continue;
    for (const file of readdirSync(articles)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const text = readFileSync(join(articles, file), 'utf8');
      for (const m of text.matchAll(DOWNLOAD_SCENE_RE)) {
        const name = m[1];
        if (!refs.has(name)) refs.set(name, `${course}/articles/${file}`);
      }
    }
  }
  return refs;
}

/** Every committed snapshot under CodeLibrary/Scenes. */
function allSceneSnapshots(): string[] {
  if (!existsSync(SCENES_DIR)) return [];
  return readdirSync(SCENES_DIR)
    .filter((d) => existsSync(join(SCENES_DIR, d, 'scene.json')))
    .sort();
}

/** Build the deduped list of scenes to validate. */
function buildTargets(only?: string): Target[] {
  const byPath = new Map<string, Target>();
  const add = (label: string, scenePath: string | null, origin: string) => {
    const key = scenePath ?? `MISSING:${label}`;
    if (!byPath.has(key)) byPath.set(key, { label, scenePath, origin });
  };

  // 1. Every scene a course tells a student to download (the catch-up files).
  for (const [name, where] of courseSceneRefs()) {
    add(name, resolveSceneSource(name), `course ref (${where})`);
  }
  // 2. Every committed snapshot (catches snapshots not directly referenced).
  for (const dir of allSceneSnapshots()) {
    add(dir, join(SCENES_DIR, dir, 'scene.json'), 'CodeLibrary/Scenes sweep');
  }

  let targets = [...byPath.values()].sort((a, b) => a.label.localeCompare(b.label));
  if (only) targets = targets.filter((t) => t.label === only);
  return targets;
}

// ----------------------------------------------------------------------------
// Validate one scene
// ----------------------------------------------------------------------------

interface Result {
  label: string;
  catchup: boolean;
  pass: boolean;
  detail: string;
}

async function validateOne(target: Target): Promise<Result> {
  const { label, origin, scenePath } = target;
  const catchup = origin.startsWith('course ref');
  if (!scenePath) {
    return { label, catchup, pass: false, detail: 'course references this scene but NO source file exists' };
  }

  let scene: SceneJson;
  try {
    scene = JSON.parse(readFileSync(scenePath, 'utf8'));
  } catch (e) {
    return { label, catchup, pass: false, detail: `bad JSON: ${(e as Error).message}` };
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
    const { unresolved, skippedViz } = await registerNames(names, loader);
    if (unresolved.length > 0) {
      return {
        label,
        catchup,
        pass: false,
        detail: `${unresolved.length} unresolved component(s): ${unresolved.join(', ')}`,
      };
    }

    // Silence the framework's own console during load/tick. We've already
    // determined resolution above; a skipped viz panel makes SceneLoader log
    // "Component not registered: <Name>Debugger" and a headless mock makes some
    // systems warn about missing adapter extensions — both are expected here and
    // would just be confusing noise in CI. Our explicit checks are the verdict.
    const { warn, error } = console;
    console.warn = () => {};
    console.error = () => {};
    let entityCount: number;
    let systemCount: number;
    try {
      loader.loadSceneFromData(scene as Parameters<SceneLoader['loadSceneFromData']>[0]);
      const { entities, systems } = loader.instantiateScene(scene.name, world);
      for (const system of systems) world.addSystem(system);
      for (let i = 0; i < 5; i++) world.update(1 / 60);
      entityCount = entities.size === 0 ? 0 : world.getEntityCount();
      systemCount = world.getSystems().length;
    } finally {
      console.warn = warn;
      console.error = error;
    }

    if (entityCount === 0) {
      return { label, catchup, pass: false, detail: 'no entities created' };
    }

    const vizNote = skippedViz.length ? `, skipped ${skippedViz.length} viz panel(s)` : '';
    return {
      label,
      catchup,
      pass: true,
      detail: `OK (${names.size} components, ${entityCount} entities, ${systemCount} systems${vizNote})`,
    };
  } catch (e) {
    return { label, catchup, pass: false, detail: `THREW: ${(e as Error).message}` };
  }
}

function printSection(title: string, results: Result[]): number {
  if (results.length === 0) return 0;
  const pad = Math.max(...results.map((r) => r.label.length));
  let failed = 0;
  console.log(`\n${title}\n`);
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.label.padEnd(pad)}  ${r.detail}`);
  }
  return failed;
}

async function main() {
  const only = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const targets = buildTargets(only);

  if (targets.length === 0) {
    console.error(only ? `No catch-up scene named "${only}".` : 'No catch-up scenes found.');
    process.exit(1);
  }

  const results: Result[] = [];
  for (const t of targets) results.push(await validateOne(t));

  const catchups = results.filter((r) => r.catchup);
  const library = results.filter((r) => !r.catchup);

  console.log('\n=== Course Catch-Up Scene Validation ===');
  // Both sections gate the exit code — a committed library scene that no longer
  // loads is a real regression too — but the catch-up total is called out first
  // because those are the files a student actually downloads per lesson.
  const catchupFailed = printSection('— Lesson catch-up scenes (bjs download scene <name>) —', catchups);
  const libraryFailed = printSection('— Other committed library scenes (sweep) —', library);

  const failed = catchupFailed + libraryFailed;
  console.log(
    `\n${catchups.length - catchupFailed}/${catchups.length} catch-up scenes passed` +
      ` · ${library.length - libraryFailed}/${library.length} library scenes passed` +
      ` · ${failed} failed.\n`,
  );
  process.exit(failed ? 1 : 0);
}

main();
