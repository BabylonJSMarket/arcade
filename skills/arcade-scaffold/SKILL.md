---
name: arcade-scaffold
description: Scaffold a new arcade-style game using @babylonjsmarket/arcade. Use when the user asks to "create an arcade game", "start a new arcade project", "scaffold arcade", or names a classic arcade title to build (e.g. "make a breakout clone").
---

# Arcade scaffold

When the user wants to spin up a new arcade game powered by `@babylonjsmarket/arcade`:

1. Run the CLI in the directory the user wants:
   ```bash
   npx @babylonjsmarket/arcade init <project-name>
   ```
2. There is **no template choice** — every scaffold is a single multigame arcade. It ships one starter scene, the **arcade room** (a carpeted room with a row of cabinets, defined in `src/scenes/arcade-room.ts`), plus the multigame structure to grow it:
   - `src/scenes/index.ts` — the scene map (`SCENES` + `DEFAULT_SCENE`); this is the seam where you register more scenes.
   - `src/registry.ts` — shared component resolvers across all scenes.
   - `src/main.ts` — tiny boot that loads the default scene.
   Assets (carpet textures, cabinet GLB) stream from `https://babylonjsgames.com/arcade/...`, so a fresh scaffold runs with no local files.
3. After scaffolding:
   - `cd <project-name> && npm install && npm run dev`
   - Open the printed URL.
4. To **fill the arcade**, add a scene under `src/scenes/<my-game>.ts` (copy `arcade-room.ts`), register it in `src/scenes/index.ts`, and switch to it at runtime with `game.loadScene(SCENES['<my-game>'])` (e.g. when the player activates a cabinet). Components resolve by name from the scene — every built-in below is auto-registered by `@babylonjsmarket/arcade`; only custom components need an entry in `src/registry.ts`. Categories:
   - **Rendering**: MeshPrimitive, Mesh, ArcCamera, CameraFollow, DirectionalLight, HemisphericLight, Skybox, EnvironmentTexture, Shadow, Animation.
   - **Input/movement**: PlayerInput, KeyboardMover, Movement.
   - **Physics**: Physics.
   - **Scoring**: Score, Scoreboard.
   - **Health/FX**: Health, HealthBar, Flash.
   - **Pinball**: Plunger, Flipper, Bumper, Spinner, MouseHole, PinballTable, PinballLayout, PinballCamera, PinballBuilder, PinballBuilderInput.
   - **Top-down shooter**: TwinStickShooter, Bullet, Enemy, EnemySpawner.

## ECS conventions

- Components are pure data; Systems own per-frame logic.
- Systems declare a `query` (`required` / `excluded` / `tags`) in their constructor.
- Communicate between systems via `EventBus`, not direct references.
- Scene JSON declares entities and their components — see the arcade README for the format.
- **Pool anything that spawns/dies in gameplay** (bullets, enemies, particles) via `world.registerPool` / `acquire` / `release` — don't `createEntity`/`removeEntity` per occurrence. A `{Kind}Pool` component carries the size. See the `ecs-api` skill's "Pooling spawned entities".

## Canonical event names — don't invent synonyms

Before emitting or listening for an event, **grep for the noun** (`score.`, `enemy.`, `physics.`) and reuse the exact existing name. Synonyms silently break cross-system communication.

Names you'll touch most often in an arcade game:

| Concern    | Emitter         | Listener(s)           | Canonical name        |
|------------|-----------------|-----------------------|-----------------------|
| Award pts  | gameplay code   | `ScoreSystem`         | `score.add`           |
| Score moved | `ScoreSystem`  | `ScoreboardSystem` + HUD | `score.changed`    |
| Score wiped | `ScoreSystem`  | HUD                   | `score.reset`         |
| Reset req  | reset button    | `ScoreSystem`         | `score.resetRequest`  |
| Goal       | `GoalSystem`    | `ScoreSystem`         | `goal.scored`         |
| Hit reg    | `BulletSystem`  | `EnemySystem`         | `enemy.hit`           |
| Kill       | `EnemySystem`   | `EnemySpawnerSystem`, scoring | `enemy.killed` |
| Bumper hit | `BumperSystem`  | scoring               | `bumper.hit`          |
| Body ready | `PhysicsSystem` | gameplay init         | `physics.body.created` |
| Entity new | `World`         | viz / debuggers       | `world.entity.created` |
| Entity gone | `World`        | viz / debuggers       | `world.entity.removed` |
| Input      | input layer     | every input system    | `keyboard.keydown`, `keyboard.keyup` |

**Rule of thumb:** state changes are past-tense (`changed`, `killed`, `hit`, `created`); direct requests are imperative (`add`, `resetRequest`). `score.updated` ≠ `score.changed` — they look like synonyms but only the second one fires. Declare the name once in `{Name}Events` / `{Name}InputEvents` and import the constant; never hardcode the string literal across files.

## Viz UI — panels, FPS, persistence

Booting the viz layer is one line per game host:

```ts
import { mountArcadeViz } from '@babylonjsmarket/arcade/viz'

const viz = mountArcadeViz(game.world, { sceneName: 'pinball' })
// → registers the Entities panel (` to toggle) + EventBus debugger (F4) +
//   a pinned FPS counter at the top of the screen. dispose() on unmount.
```

`sceneName` namespaces localStorage so panels in different scenes don't
collide. Opts you may need:
- `fpsOverlay: false` — disable the always-visible FPS pill.
- `eventBusDebugger: false` — skip the F4 panel.
- `toggleKey: 'Backquote'` — keybinding for the Entities panel.

### Adding a per-game tuning panel

Use the `{Name}DebuggerComponent` + `{Name}DebuggerSystem` convention
(see the `ecs-api` skill for the full template):

```ts
// games/.../pinball/PinballPanel.viz.tsx
import { vizStore } from '@babylonjsmarket/arcade/viz'

// In tryRegisterPanel():
vizStore.registerPanel({
  id: PANEL_ID, title: 'Pinball', position: 'top-left', titleColor: '#c4a8ff',
  content: () => <PinballPanelView world={world} />,
})

// In PinballPanelView — slider values that persist across reload:
const seed = vizStore.getPanelData<number>(PANEL_ID, 'flipSpeed', 24)
const [flipSpeed, setFlipSpeed] = createSignal(seed)
const setAndSave = (v: number) => {
  setFlipSpeed(v); vizStore.setPanelData(PANEL_ID, 'flipSpeed', v)
}
```

Declare the panel component in scene JSON:
```json
"PinballPanel": { "visible": false, "activationKey": "Digit5", "position": "top-left" }
```

### Game-local panels and template sync

The current scaffold (the arcade room) is authored directly in
`packages/arcade/templates/` — there is no live game it mirrors, so the
template-sync machinery (`scripts/sync-templates.js`, `PAIRS`) is dormant.

If you later add a CLI template that DOES track a live game under
`games/src/games/arcade/<game>/{scene,registry}.ts`, add a pair to `PAIRS`
and use `@sync-skip` markers to keep playground-only panels out of the
scaffolded template:

```ts
// scene.ts
// @sync-skip-begin
PinballPanel: { visible: false, activationKey: 'Digit5', position: 'top-left' },
// @sync-skip-end

// registry.ts
PinballPanel: async () => ({ PinballPanelComponent, PinballPanelSystem }), // @sync-skip
```

`npm run sync-templates` (in `packages/arcade`) strips marked blocks /
lines from the projected template while leaving the live games
untouched. The `templates-drift.test.ts` fails CI if you forget.
