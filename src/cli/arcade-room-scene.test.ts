/**
 * arcade-room-scene.test.ts — prove the STARTER SCENE actually LOADS.
 *
 * `index.test.ts` already asserts the scaffolded `arcade-room.ts` *text*
 * contains the words `Floor`, `Wall_N`, `Cabinet_1`, … — but a grep can't catch
 * a scene that references a renamed component, drops a required field, or leaves
 * an entry the free registry can no longer resolve. That class of breakage
 * compiles green and only shows up when a student runs `npm create` and stares
 * at an empty room.
 *
 * So here we load the REAL template (`templates/arcade-room.scene.ts` — the exact
 * module the CLI copies into `src/scenes/arcade-room.ts`) through a REAL
 * `ArcadeGame` wired to a `MockRendererAdapter`. Its registry is the CORE SET a
 * new project downloads into src/components — read here from the monorepo's
 * CodeLibrary by the same code the CLI's `--core-from` uses — and nothing from
 * arcade itself. No Babylon, no browser, no assets on disk — the components are
 * renderer-agnostic, so the Mock records the calls a real engine would receive.
 *
 * Outside the monorepo (arcade's own repo) there is no CodeLibrary to read, so
 * the suite skips.
 *
 * The four things a "cabinet + floor + walls" room must be true for:
 *   1. every component the scene names resolves (no `No resolver` warning),
 *   2. the room shell entities (floor, 4 walls, one cabinet, camera, lights) all
 *      instantiate,
 *   3. those entities reach the renderer — primitives for the floor/walls, a GLB
 *      load for the cabinet, a light, and a camera,
 *   4. the world ticks without throwing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import { ArcadeGame } from '../ArcadeGame';
import { ARCADE_ROOM } from '../../templates/arcade-room.scene';
import { GAME } from '../../templates/game.scene';
import { readLocalCoreBundle } from './core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = path.resolve(HERE, '..', '..', '..', '..', 'CodeLibrary');
const HAVE_LIBRARY = fs.existsSync(path.join(LIBRARY_DIR, 'Components'));

type Resolver = () => Promise<Record<string, unknown>>;

/** The registry a fresh scaffold ends up with: one entry per core component. */
function coreRegistry(): Record<string, Resolver> {
  const bundle = readLocalCoreBundle(LIBRARY_DIR);
  return Object.fromEntries(
    bundle.components.map((c) => [
      c.name,
      (() => import(path.join(LIBRARY_DIR, c.path, `${c.name}.ts`))) as Resolver,
    ]),
  );
}

// The template is plain scene data; cast to whatever loadScene accepts so the
// test tracks the real signature without importing an internal type.
type SceneArg = Parameters<ArcadeGame['loadScene']>[0];
const ROOM = ARCADE_ROOM as unknown as SceneArg;

// Every entity the starter room must create. If the scene or a component drifts
// so one of these never instantiates, the room a student sees is broken.
const ROOM_ENTITIES = [
  'Sun',
  'Fill',
  'Floor',
  'Ceiling',
  'Wall_N',
  'Wall_S',
  'Wall_E',
  'Wall_W',
  'Cabinet_1',
  'Player',
];

describe.skipIf(!HAVE_LIBRARY)('arcade-room starter scene — loads through the downloaded core set', () => {
  let renderer: MockRendererAdapter;
  let game: ArcadeGame;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
    // The core set, exactly what a fresh scaffold downloads into src/components.
    game = new ArcadeGame(renderer, { componentRegistry: coreRegistry() });
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('names only components the core set carries (arcade built-ins are going away)', () => {
    const core = new Set(Object.keys(coreRegistry()));
    for (const scene of [ARCADE_ROOM, GAME]) {
      const names = new Set(
        Object.values(scene.entities).flatMap((e) => Object.keys((e as { components: object }).components)),
      );
      const outside = [...names].filter((n) => !core.has(n));
      expect(outside, `${scene.name} names components outside the core set`).toEqual([]);
    }
  });

  it('resolves every component the room references (no "No resolver" warning)', async () => {
    await game.loadScene(ROOM);
    const unresolved = warn.mock.calls
      .flat()
      .filter((a): a is string => typeof a === 'string' && a.includes('No resolver'));
    expect(unresolved, `unresolved components:\n${unresolved.join('\n')}`).toEqual([]);
  });

  it('instantiates the whole room shell: floor, four walls, one cabinet, camera, lights', async () => {
    await game.loadScene(ROOM);
    const missing = ROOM_ENTITIES.filter((id) => !game.world.getEntity(id));
    expect(missing, `entities that never instantiated: ${missing.join(', ')}`).toEqual([]);
    // The room should be more than the shell (nothing silently dropped).
    expect(game.world.getEntityCount()).toBeGreaterThanOrEqual(ROOM_ENTITIES.length);
  });

  it('drives the renderer: mesh primitives, a cabinet GLB, a light, and a camera', async () => {
    await game.loadScene(ROOM);
    for (let i = 0; i < 5; i++) game.world.update(1 / 60);

    const methods = renderer.calls.map((c) => c.method);
    // Floor / walls / ceiling are MeshPrimitive → createMesh.
    expect(methods, 'floor/walls never reached the renderer (no createMesh)').toContain('createMesh');
    // The cabinet is a GLB Mesh → a model load. The template ships it `instanced`,
    // so the load is `loadModelTemplate` (a shared template, cloned per instance —
    // ready for you to add more cabinets); a non-instanced Mesh would be `loadMesh`.
    // Accept either so the test tracks "the cabinet model was requested from the
    // renderer", not the load strategy.
    expect(
      methods.some((m) => m === 'loadModelTemplate' || m === 'loadMesh'),
      'cabinet GLB never requested (no loadModelTemplate/loadMesh)',
    ).toBe(true);
    // Lighting + a walk camera reached the adapter.
    expect(
      methods.some((m) => /Light$/.test(m)),
      'no light reached the renderer',
    ).toBe(true);
    expect(
      methods.some((m) => /Camera$/.test(m)),
      'no camera reached the renderer',
    ).toBe(true);
  });

  it('ticks several frames without throwing', async () => {
    await game.loadScene(ROOM);
    expect(() => {
      for (let i = 0; i < 10; i++) game.world.update(1 / 60);
    }).not.toThrow();
  });
});

describe.skipIf(!HAVE_LIBRARY)('game starter scene — loads through the downloaded core set', () => {
  it('resolves every component and instantiates every entity', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const renderer = new MockRendererAdapter();
      const game = new ArcadeGame(renderer, { componentRegistry: coreRegistry() });
      await game.loadScene(GAME as unknown as SceneArg);
      const unresolved = warn.mock.calls
        .flat()
        .filter((a): a is string => typeof a === 'string' && a.includes('No resolver'));
      expect(unresolved).toEqual([]);
      for (const id of Object.keys(GAME.entities)) {
        expect(game.world.getEntity(id), id).toBeDefined();
      }
      expect(() => game.world.update(1 / 60)).not.toThrow();
    } finally {
      warn.mockRestore();
    }
  });
});
