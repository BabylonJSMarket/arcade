# Installation & Quick Start

`@babylonjsmarket/arcade` is the game runner for `@babylonjsmarket/ecs`: `ArcadeGame`, the controls HUD, a few shared event names, and the `arcade` scaffolder. It ships no components. The core set comes as source into your project's `src/components/`.

## Scaffold a project

```bash
npm create @babylonjsmarket/arcade my-game
cd my-game
npm install
npm run dev
```

The scaffold downloads the free core components into `src/components/`. Its `src/registry.ts` maps each folder there to a lazy import, and its `main.ts` installs each component's engine plugin (`src/components/<Name>/adapter/register.ts`) before the scene loads.

Options worth knowing:

| Flag | Effect |
| --- | --- |
| `--kind game` / `--kind arcade` | One starter scene, or the multigame arcade room (default) |
| `--renderer babylon \| babylon-lite \| three` | The engine for the whole project |
| `--no-core` | Skip the core download (run `npx arcade core` later) |
| `--core-from <dir>` | Copy the core set from a local CodeLibrary checkout |

## Fill in the core components

```bash
npx arcade core            # inside the project
```

Writes only missing files, never overwrites one you changed. Add a marketplace component with `bjs download <Name>`.

## Install by hand

```bash
npm install @babylonjsmarket/arcade @babylonjsmarket/ecs
npm install @babylonjs/core @babylonjs/loaders @babylonjs/havok   # or: three
```

Then run `npx arcade core` in the project to get the components, and pass a registry to `ArcadeGame`:

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';

const game = new ArcadeGame(new BabylonAdapter(), {
  componentRegistry: {
    MeshPrimitive: () => import('./components/MeshPrimitive/MeshPrimitive'),
    ArcCamera: () => import('./components/ArcCamera/ArcCamera'),
  },
});
await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

A scaffold's `src/registry.ts` builds that map for you with `import.meta.glob`.

## Where to next

- **[Scene JSON Format](./scene-json)** — what `level1.json` looks like
- **[ArcadeGame walkthrough](./arcade-game)** — what the loader does
