# Installation & Quick Start

`@babylonjsmarket/arcade` is a curated bundle of 14 game components plus a lazy JSON scene loader, all built on `@babylonjsmarket/ecs`.

## Install

```bash
npm install @babylonjsmarket/arcade @babylonjsmarket/ecs
```

Pick a renderer:

```bash
# Babylon (with Havok physics)
npm install @babylonjs/core @babylonjs/loaders @babylonjs/havok

# Three.js
npm install three
```

Optional, for the debug viz panels:

```bash
npm install solid-js
```

## The fast path: ArcadeGame

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { registerArcadePlugins } from '@babylonjsmarket/arcade/babylon';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const adapter = new BabylonAdapter();
registerArcadePlugins(adapter);
const game = new ArcadeGame(adapter);

await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

That's a fully wired game. `registerArcadePlugins` installs the engine code a few built-in components need (ToneMapping, AmbientOcclusion, NeonSign, Physics casts). Leave it out and those components load but do nothing. A project made with `bjs create` already has this call in `src/main.ts`, along with a loop that installs the `adapter/register.ts` of every component you `bjs download`.

The next section ([Scene JSON](./scene-json)) covers what `level1.json` should look like. The section after ([ArcadeGame](./arcade-game)) is a code walkthrough of the wrapper class itself — what it does, what it doesn't.

## Or wire systems by hand

If you don't need the JSON scene loader and you'd rather instantiate Systems directly:

```ts
import { World } from '@babylonjsmarket/ecs';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
import {
  MeshPrimitiveSystem,
  KeyboardMoverSystem,
  ArcCameraSystem,
  HemisphericLightSystem,
} from '@babylonjsmarket/arcade';

const renderer = new BabylonAdapter();
await renderer.init(canvas);

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.getEventBus()));
world.addSystem(new KeyboardMoverSystem(world.getEventBus()));
world.addSystem(new ArcCameraSystem(world.getEventBus()));
world.addSystem(new HemisphericLightSystem(world.getEventBus()));

renderer.startLoop((dt) => world.update(dt));
```

You'd then create entities and add components in code. The JSON path is just sugar over this.

## Per-component imports

If you want maximum tree-shaking and don't need the lazy loader:

```ts
import { MeshPrimitiveSystem, MeshPrimitiveComponent } from '@babylonjsmarket/arcade/MeshPrimitive';
import { MovementSystem, MovementComponent } from '@babylonjsmarket/arcade/Movement';
```

Each component has its own dist file, so bundlers get the cleanest possible split.

## What ships in v0.1

| Component | What it does |
|---|---|
| MeshPrimitive | Spawn meshes from primitive shapes |
| Mesh | Load .glb/.gltf assets |
| Movement | Velocity-driven movement |
| KeyboardMover | WASD + arrow keys |
| PlayerInput | Higher-level input mapping |
| ArcCamera | Orbiting camera around a target |
| CameraFollow | Trailing camera with lag |
| DirectionalLight | Sun-style lighting |
| HemisphericLight | Ambient sky lighting |
| Shadow | Shadow casting |
| Physics | Rigid bodies (Havok via Babylon) |
| Score | Numeric scores per player |
| Scoreboard | DOM overlay |
| Animation | Skeletal animation playback |

The rest of these docs walk through each one — what data they carry, what events they emit and listen to, what to put in the JSON.

## Where to next

- **[Scene JSON Format](./scene-json)** — the file the loader reads
- **[ArcadeGame walkthrough](./arcade-game)** — what the wrapper class actually does
