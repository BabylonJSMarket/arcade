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
2. The CLI presents four templates (basic, first-person, top-down, side-scroller). Pick the one matching the user's request, or ask if ambiguous.
3. After scaffolding:
   - `cd <project-name> && npm install && npm run dev`
   - Open the printed URL.
4. To add a component to an existing arcade project:
   ```bash
   npx @babylonjsmarket/arcade add <ComponentName>
   ```
   Components ship in `@babylonjsmarket/arcade` and resolve by name from the scene. Categories:
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

### Game-local panels that don't ship in the CLI template

If a panel is still a playground prototype, keep it out of the
scaffolded template using `@sync-skip` markers in the games-side
`scene.ts` and `registry.ts`:

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
