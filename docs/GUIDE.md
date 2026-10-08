# Arcade — User Guide

`@babylonjsmarket/arcade` runs games built on `@babylonjsmarket/ecs`. You describe a scene in JSON. `ArcadeGame` imports the components the scene names, starts their systems, and runs the loop.

The package holds the runner, not the parts. The free core components — meshes, lights, cameras, input, physics, scoring, pooling — live as source in your project's `src/components/`. The scaffold downloads them, `npx arcade core` fills in any that are missing, and `bjs download <Name>` adds more from the marketplace.

## Start a project

```bash
npm create @babylonjsmarket/arcade my-game
cd my-game
npm install
npm run dev
```

You get:

| File | Job |
| --- | --- |
| `src/components/` | Every component the game uses, as source. The core set lands here on create. |
| `src/registry.ts` | Maps each folder in `src/components/` to a lazy import. You rarely edit it. |
| `src/main.ts` | Boots the renderer, installs each component's engine plugin, loads the scene. |
| `src/scenes/` | Your scenes, as TS modules listed in `src/scenes/index.ts`. |

Pick a single game with `--kind game`, or the default multigame arcade room. Pick an engine with `--renderer babylon | babylon-lite | three`.

## Get the core components

The scaffold downloads them when it creates the project. If that failed, or you passed `--no-core`, run this inside the project:

```bash
npx arcade core
```

It writes only the files that are missing, so it is safe to run again. `--core-from <dir>` copies from a local CodeLibrary checkout instead of downloading.

For a marketplace component, use the member CLI:

```bash
bjs download Health
```

Both drop a folder into `src/components/`, and `src/registry.ts` picks it up with no edit.

## Run a scene

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
import { REGISTRY } from './registry';

const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY });
await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

`componentRegistry` is the only place `ArcadeGame` looks a name up. Arcade has no built-in list.

## Scene JSON

A scene is a map of entities. Each entity has optional `tags` and a `components` object. A key is a component name, and its value is that component's starting data.

```json
{
  "name": "Level1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2, "position": [0, 1, 0] },
        "KeyboardMover": { "speed": 8 },
        "Physics": { "shapeType": "capsule", "mass": 1, "lockRotation": true }
      }
    },
    "Floor": {
      "components": {
        "MeshPrimitive": { "primitive": "ground", "width": 50, "depth": 50 },
        "Physics": { "shapeType": "box", "motionType": "static" }
      }
    },
    "Camera": { "components": { "ArcCamera": { "target": "Player", "radius": 14 } } },
    "Sun": { "components": { "DirectionalLight": { "direction": [-1, -2, -1] } } }
  }
}
```

Each component's fields are in its own guide on [babylonjsmarket.com/library](https://babylonjsmarket.com/library), and in the source in `src/components/<Name>/`.

## What loadScene does

1. Collects every component name the entities use.
2. Calls each name's resolver once, in parallel. Each becomes its own lazy chunk.
3. Registers `<Name>Component` and every `<Name>…System` the module exports.
4. Adds and starts every system, then creates the entities. So a one-shot event a system sends from `onEntityAdded` reaches every other system.

`loadScene(data, { replace: true })` tears the current scene's entities and systems down first. Systems you added yourself stay.

## A missing component

If a scene names a component your registry doesn't have, `ArcadeGame` logs one warning for that name and loads the scene without it:

```
[ArcadeGame] The scene uses component "Physics", but this project does not have it, so entities skip it.
Core components: run `npx arcade core`. Marketplace components: run `bjs download Physics`. …
```

It warns once per name, however many scenes use it.

## Your own components

Put a folder in `src/components/`:

```ts
// src/components/Spin/Spin.ts
import { Component, System } from '@babylonjsmarket/ecs';

export class SpinComponent extends Component {
  speed = 1;
}

export class SpinSystem extends System {
  protected query = { required: [SpinComponent] };
  protected onUpdate(dt: number): void {
    for (const e of this.entities) {
      // turn e by e.get(SpinComponent)!.speed * dt through this.world!.renderer
    }
  }
}
```

The registry finds it by folder name, so `"Spin": { "speed": 2 }` works in a scene right away. Outside a scaffold, pass it yourself: `componentRegistry: { Spin: () => import('./Spin') }`, or later with `game.addComponentResolver('Spin', …)`.

## Event names

A component's event names live beside it in `<Name>.events.ts`. A listener imports `../Other/Other.events`, never the other component's System.

Arcade keeps only the names that no single component owns:

| Export | Names |
| --- | --- |
| `KeyboardInputEvents` | `keyboard.keydown`, `keyboard.keyup` |
| `MouseInputEvents` | `mouse.move`, `mouse.down`, `mouse.up`, `mouse.lockchanged` |
| `BulletEvents` | `bullet.hit` |
| `SkeletonAnimatorInputEvents`, `SkeletonAnimatorEvents` | `skeletonAnimator.setLoop`, `.playOnce`, `.completed` |

## Controls HUD and debug panels

`mountControlsHud(hintsFromSceneTitle(title))` shows the key-hint box. It is plain DOM, so it is safe in a production build.

In dev, `mountArcadeViz(world, { sceneName })` from `@babylonjsmarket/arcade/viz` mounts the Entities panel (F1), the EventBus debugger (F2) and an FPS counter. The `/viz` subpath ships TypeScript source and needs `vite-plugin-solid`. A component's own panel ships with it, in `src/components/<Name>/<Name>.viz.tsx`.

## Upgrading from 0.12

1. Run `npx arcade core` in the project.
2. Pass `componentRegistry: REGISTRY` to `ArcadeGame`.
3. Drop `registerArcadePlugins` (and the `/babylon` import). Glob `./components/*/adapter/register.ts` the way the scaffold's `main.ts` does.
4. Import a core component's event names from `./components/<Name>/<Name>.events`.
5. `arcade eject` is gone. Core components are already source in your project.

## License

MIT.
