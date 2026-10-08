# @babylonjsmarket/arcade

The game runner for [@babylonjsmarket/ecs](https://www.npmjs.com/package/@babylonjsmarket/ecs). You give it a scene as JSON. It loads the components the scene names, starts their systems, and runs the loop.

Arcade ships no components of its own (since 0.13.0). The free core set — meshes, lights, cameras, input, physics, scoring, pooling — comes as source into your project's `src/components/`, from `npx arcade core` or `bjs download <Name>`.

## What's in the package

| Piece | What it does |
| --- | --- |
| `ArcadeGame` | Wraps `World` + `EventBus` + `SceneLoader`. Loads a scene, imports each named component on first use, runs the loop. |
| `mountControlsHud`, `hintsFromSceneTitle` | The small key-hint box players see. Plain DOM, safe in a production build. |
| Event names | `KeyboardInputEvents`, `MouseInputEvents`, `BulletEvents`, `SkeletonAnimatorEvents`, `SkeletonAnimatorInputEvents`. Names no single component owns. Every other component keeps its names in its own `<Name>.events.ts`. |
| `@babylonjsmarket/arcade/viz` | `mountArcadeViz` (Entities panel, EventBus debugger, FPS counter) for dev builds. |
| `arcade` CLI | Scaffolds a project (`npm create @babylonjsmarket/arcade`) and fills in core components (`npx arcade core`). |

## Start a project

```bash
npm create @babylonjsmarket/arcade my-game
cd my-game
npm install
npm run dev
```

The scaffold downloads the core components into `src/components/`. Its `src/registry.ts` finds every folder there, and its `main.ts` installs each component's engine plugin (`adapter/register.ts`) before the first scene loads.

Missed the download, or used `--no-core`? Run this in the project:

```bash
npx arcade core
```

It fills in missing files and never overwrites one you changed. For a marketplace component, use the member CLI: `bjs download <Name>`.

## Run a scene by hand

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
import { REGISTRY } from './registry'; // name → () => import('./components/<Name>/<Name>')

const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY });
await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

`componentRegistry` is the only place `ArcadeGame` looks up a name. A scene that names a component you don't have logs one warning, telling you to run `npx arcade core` or `bjs download <Name>`, and loads without it.

A scene:

```json
{
  "name": "Level1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2 },
        "KeyboardMover": { "speed": 8 }
      }
    },
    "Camera": { "components": { "ArcCamera": { "target": "Player", "radius": 12 } } },
    "Sun": { "components": { "DirectionalLight": { "direction": [-1, -2, -1] } } }
  }
}
```

Each resolver is `() => Promise<module>`. The module must export `<Name>Component`, and may export any number of `<Name>…System` classes.

## Install

```bash
npm install @babylonjsmarket/arcade @babylonjsmarket/ecs
npm install @babylonjs/core @babylonjs/loaders @babylonjs/havok   # or: three
```

## The `/viz` subpath

`@babylonjsmarket/arcade/viz` ships TypeScript source, because Solid's JSX needs a Solid-aware compiler (`vite-plugin-solid`). `solid-js` and `@babylonjsmarket/viz` are optional peers; install them only if you import `/viz`. The main entry is plain built JS with no Solid dependency.

Each component's own debug panel (`<Name>.viz.tsx`) ships with the component in `src/components/`, not here.

## Upgrading from 0.12

1. Run `npx arcade core` in your project. That puts the core components in `src/components/`.
2. Pass your registry: `new ArcadeGame(adapter, { componentRegistry: REGISTRY })`.
3. Replace `registerArcadePlugins(adapter)` from `@babylonjsmarket/arcade/babylon` with the `adapter/register.ts` glob the scaffold's `main.ts` uses.
4. Import a core component's event names from `./components/<Name>/<Name>.events`, not from `@babylonjsmarket/arcade`.
5. `arcade eject` is gone. The components are already source in your project.

## See also

- [@babylonjsmarket/ecs](https://www.npmjs.com/package/@babylonjsmarket/ecs) — the ECS framework.
- [BabylonJS Market](https://babylonjsmarket.com) — the component library, courses and example games.

ESM only. TypeScript declarations included. Tests run against `MockRendererAdapter`, so `npm test` needs no Babylon or Three.
