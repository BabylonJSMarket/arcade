# @babylonjsmarket/arcade

A curated bundle of reusable arcade-style components — mesh primitives, cameras, lights, input, physics, scoring, animation — built on the [@babylonjsmarket/ecs](https://www.npmjs.com/package/@babylonjsmarket/ecs) framework.

## Where this fits

```
@babylonjsmarket/ecs                  ← the framework: World, Component, System, EventBus, renderer adapters
        ▲
        │ depends on
        │
@babylonjsmarket/arcade               ← you are here: 14 ready-to-use components
        ▲
        │ scaffolded by
        │
@babylonjsmarket/create-arcade        ← CLI that bootstraps a game using both packages
```

This is the **starter bundle** for the [BabylonJS Market](https://babylonjsmarket.com) ecosystem. The full marketplace ships 50+ components covering AI behaviors, combat, cameras, level generation, and game directors; this package gives you the 14 components every arcade game needs.

If you want to build a playable scene without writing the basics from scratch — install this package, install `@babylonjsmarket/ecs` plus a renderer, and you have movement, input, physics, and a score on screen.

## What's included

| Component         | What it does                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `MeshPrimitive`   | Spawn meshes from primitive shapes (box, sphere, capsule, ground, ...)      |
| `Mesh`            | Load `.glb`/`.gltf` assets and attach them to entities                      |
| `Movement`        | Velocity-driven movement on `MeshPrimitive` entities                        |
| `KeyboardMover`   | WASD + arrow-key driver that feeds `Movement`                               |
| `PlayerInput`     | Higher-level input mapping (move, jump, action)                             |
| `Physics`         | Dynamic/static/kinematic rigid bodies (Havok via Babylon, pure-JS via Three) |
| `ArcCamera`       | Orbiting camera around a target entity                                      |
| `CameraFollow`    | Tracks a target with configurable lag/lead                                  |
| `DirectionalLight`| Sun-style directional lighting                                              |
| `HemisphericLight`| Ambient sky lighting with adjustable color                                  |
| `Shadow`          | Adds a `MeshPrimitive` to a `DirectionalLight`'s shadow caster set          |
| `Animation`       | Plays/blends skeletal animation clips on loaded meshes                      |
| `Score`           | Tracks numeric scores per player ID                                         |
| `Scoreboard`      | DOM overlay that renders `Score` state                                      |

Every component ships with the same surface convention from the framework:

- `{Name}Component` — the data class
- `{Name}System` — the logic
- `{Name}Events` — event names the system emits
- `{Name}InputEvents` — event names the system listens to

## Install

```bash
npm install @babylonjsmarket/arcade @babylonjsmarket/ecs

# pick a renderer
npm install @babylonjs/core @babylonjs/loaders @babylonjs/havok
# …or
npm install three
```

## Entry points

| Import                                  | Contents                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `@babylonjsmarket/arcade`               | All 14 components and systems. **No** Solid.js viz panels.                        |
| `@babylonjsmarket/arcade/viz`           | Solid.js debug panels for every component (see notes below)                       |
| `@babylonjsmarket/arcade/<ComponentName>` | Single-component import — e.g. `@babylonjsmarket/arcade/MeshPrimitive`            |

The per-component subpaths let bundlers tree-shake unused components even without aggressive dead-code elimination. Use them when bundle size matters; use the top-level `import { ... } from '@babylonjsmarket/arcade'` when convenience matters.

## Quick start

The fast path: describe your scene in JSON, hand it to `ArcadeGame`. Components are imported lazily, so bundlers split them per chunk and only ship what your scene uses.

```json
// scenes/level1.json
{
  "name": "Level1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2 },
        "KeyboardMover": { "speed": 8 },
        "Physics":  { "shapeType": "capsule", "mass": 1, "lockRotation": true }
      }
    },
    "Camera": {
      "components": { "ArcCamera": { "target": "Player", "radius": 12 } }
    },
    "Sun": {
      "components": { "DirectionalLight": { "direction": [-1, -2, -1] } }
    }
  }
}
```

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';

const game = new ArcadeGame(new BabylonAdapter());
await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

That's the whole loop. `MeshPrimitive`, `KeyboardMover`, `Physics`, `ArcCamera`, `DirectionalLight` are the only modules pulled in — the other 9 components stay tree-shaken out.

### Or wire systems yourself

If you'd rather skip the JSON layer and instantiate systems directly:

```ts
import { World } from '@babylonjsmarket/ecs';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
import {
  MeshPrimitiveSystem,
  KeyboardMoverSystem,
  ArcCameraSystem,
  HemisphericLightSystem,
  ScoreSystem,
} from '@babylonjsmarket/arcade';

const renderer = new BabylonAdapter();
await renderer.init(canvas);

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new KeyboardMoverSystem(world.eventBus));
world.addSystem(new ArcCameraSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));
world.addSystem(new ScoreSystem(world.eventBus));

renderer.startLoop((dt) => world.update(dt));
```

### Mixing in custom components

`ArcadeGame` accepts an optional `componentRegistry` that merges with the built-in 14 resolvers. Use it to add components from another package or your own project:

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    EnemySpawner: () => import('./components/EnemySpawner'),
    Health: () => import('@my-org/combat/Health'),
  },
});
```

Each resolver is `() => Promise<{ [Name]Component: ..., [Name]System: ... }>` — same shape as the components in this package.

For a fully scaffolded starting project that wires this together — keyboard controls, a camera that follows a player capsule, a light, and a score overlay — use:

```bash
npx @babylonjsmarket/create-arcade my-game
```

## Notes on the `/viz` subpath

Each component has a `.viz.tsx` Solid.js debug panel that surfaces its live state in a side panel — useful during development for tuning movement curves, light angles, physics parameters, etc.

These panels ship as **TypeScript source**, not pre-compiled JS, because Solid's JSX transform isn't standard `react-jsx`. To use `@babylonjsmarket/arcade/viz`, your build pipeline must have a Solid-aware compiler (e.g. `vite-plugin-solid`, Solid's Vite preset, or `babel-preset-solid`). `solid-js` is declared as an **optional** peer dependency — install it only if you import from `/viz`.

The plain `@babylonjsmarket/arcade` entry has **no Solid dependency** and is pre-built JS — it works in any ESM bundler.

## What's not in this package (yet)

The full BJSM component library has more. These are intentionally out of v0.1:

- **AI behaviors** — `AISeek`, `AIShoot`, `AIGoalSeek`, `AISteering`, `AIAvoidance`, `AICoach`, `AIBrakeNearBall`, `AIKick`, `AIZone`, `CoverSeek`
- **Combat** — `Bullet`, `BulletPool`, `Hitscan`, `BlastRadius`, `Health`, `FloatingDamageNumbers`, `Shooter`, `AimIndicator`, `Stamina`
- **Camera polish** — `CameraShake`, `AutoDollyCamera`, `SnapOrbitCamera`, `SpectatorCamera`, `OrbitMover`, `Stride`
- **Game directors** — `PongDirector`, `MissileCommand3DDirector`, `PuckBouncer`, `BallPossession`, `BallReset`, `Goal`, `TeamSpawner`, `PillarSpawner`
- **Debug** — `BehaviorInspector`, `CollisionDebugger`, `PlaybackControl`

These live in the broader [BabylonJS Market](https://babylonjsmarket.com) catalog and may ship as additional npm packages (`@babylonjsmarket/arcade-ai`, etc.) in future releases.

## See also

- **[@babylonjsmarket/ecs](https://www.npmjs.com/package/@babylonjsmarket/ecs)** — The ECS framework this package is built on.
- **[@babylonjsmarket/create-arcade](https://www.npmjs.com/package/@babylonjsmarket/create-arcade)** — CLI scaffolder for new arcade games.
- **[BabylonJS Market](https://babylonjsmarket.com)** — The full component catalog, courses, and example games.

## Notes

- ESM only. `"type": "module"`.
- TypeScript declarations included.
- Tests run against the `MockRendererAdapter` from `@babylonjsmarket/ecs` — no Babylon or Three required for `npm test`.
