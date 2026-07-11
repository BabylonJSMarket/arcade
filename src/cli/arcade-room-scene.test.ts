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
 * `ArcadeGame` wired to a `MockRendererAdapter`, which merges the built-in
 * `ARCADE_COMPONENT_REGISTRY` and resolves every component the same way the live
 * game does. No Babylon, no browser, no assets on disk — the components are
 * renderer-agnostic, so the Mock records the calls a real engine would receive.
 *
 * The four things a "cabinet + floor + walls" room must be true for:
 *   1. every component the scene names resolves (no `No resolver` warning),
 *   2. the room shell entities (floor, 4 walls, 5 cabinets, camera, lights) all
 *      instantiate,
 *   3. those entities reach the renderer — primitives for the floor/walls, a GLB
 *      load for the cabinets, a light, and a camera,
 *   4. the world ticks without throwing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';
import { ArcadeGame } from '../ArcadeGame';
import { ARCADE_ROOM } from '../../templates/arcade-room.scene';

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
  'Cabinet_2',
  'Cabinet_3',
  'Cabinet_4',
  'Cabinet_5',
  'Player',
];

describe('arcade-room starter scene — loads through the real free registry', () => {
  let renderer: MockRendererAdapter;
  let game: ArcadeGame;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
    // No componentRegistry override — this exercises the real built-in
    // ARCADE_COMPONENT_REGISTRY, exactly what a fresh scaffold ships with.
    game = new ArcadeGame(renderer);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('resolves every component the room references (no "No resolver" warning)', async () => {
    await game.loadScene(ROOM);
    const unresolved = warn.mock.calls
      .flat()
      .filter((a): a is string => typeof a === 'string' && a.includes('No resolver'));
    expect(unresolved, `unresolved components:\n${unresolved.join('\n')}`).toEqual([]);
  });

  it('instantiates the whole room shell: floor, four walls, five cabinets, camera, lights', async () => {
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
    // Cabinets are a GLB Mesh → a model load. The template ships them `instanced`,
    // so the load is `loadModelTemplate` (one shared template, cloned per cabinet);
    // a non-instanced Mesh would be `loadMesh`. Accept either so the test tracks
    // "the cabinet model was requested from the renderer", not the load strategy.
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
