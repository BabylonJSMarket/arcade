# Basics — User Guide

Curated arcade-style components for the `@babylonjsmarket/ecs` framework, plus a lazy JSON scene loader that ships only the components your scene actually uses.

## Installation

```bash
npm install @babylonjsmarket/arcade @babylonjsmarket/ecs
```

Pick a renderer:

```bash
# For BabylonJS
npm install @babylonjs/core @babylonjs/loaders @babylonjs/havok

# For Three.js
npm install three
```

(Optional, for debug viz panels:)

```bash
npm install solid-js
```

## Quick Start

The fast path: describe your scene in JSON, hand it to `ArcadeGame`.

```ts
import { ArcadeGame } from '@babylonjsmarket/arcade';
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';

const game = new ArcadeGame(new BabylonAdapter());
await game.init(canvas);
await game.loadSceneFromUrl('/scenes/level1.json');
game.start();
```

That's the whole loop. The next sections explain what `level1.json` looks like and what each component does.

---

## Scene JSON Format

A scene is an `entities` map. Each entity has optional `tags` and a `components` object. Component keys are the **component name** (`"MeshPrimitive"`, `"ArcCamera"`, etc.) and the values are the **initial component data**.

```json
{
  "name": "Level1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2, "diameter": 1 },
        "KeyboardMover":  { "speed": 8 },
        "Physics":        { "shapeType": "capsule", "mass": 1, "lockRotation": true }
      }
    },
    "Camera": {
      "components": {
        "ArcCamera": { "target": "Player", "radius": 12, "alpha": 0, "beta": 1.2 }
      }
    },
    "Sun": {
      "components": {
        "DirectionalLight": { "direction": [-1, -2, -1], "intensity": 0.9 }
      }
    },
    "Sky": {
      "components": {
        "HemisphericLight": { "intensity": 0.3 }
      }
    }
  }
}
```

When you call `loadSceneFromUrl`, `ArcadeGame`:

1. Fetches and parses the JSON
2. Walks the entities, collects every unique component name
3. Lazily imports each component module in parallel (one `() => import(...)` per name)
4. Registers the resulting classes with the underlying `SceneLoader`
5. Instantiates the scene into the World, adds the systems

If a scene only uses `MeshPrimitive`, `ArcCamera`, and `DirectionalLight`, those are the **only** component modules the bundler pulls in.

---

## The 14 Components

### MeshPrimitive

Spawn a mesh from a primitive shape. Required by anything visual.

```json
"MeshPrimitive": {
  "primitive": "capsule",
  "height": 2,
  "diameter": 1,
  "position": [0, 1, 0]
}
```

Supported primitives: `box`, `sphere`, `cylinder`, `capsule`, `ground`, `torus`, `disc`, `plane`.

### Mesh

Load a `.glb` or `.gltf` asset and attach it to the entity.

```json
"Mesh": {
  "url": "/models/character.glb",
  "scale": 0.5
}
```

### Movement

Adds velocity-driven movement to an entity with `MeshPrimitive`. Listens for movement events (typically emitted by `KeyboardMover` or `PlayerInput`) and integrates position each frame.

```json
"Movement": {
  "maxSpeed": 10,
  "acceleration": 30
}
```

### KeyboardMover

WASD + arrow-key driver. Emits movement events the `Movement` component listens to.

```json
"KeyboardMover": { "speed": 8 }
```

### PlayerInput

Higher-level input mapping (move, jump, action). Use instead of `KeyboardMover` when you need more than directional movement.

```json
"PlayerInput": {
  "moveSpeed": 8,
  "jumpForce": 12
}
```

### Physics

Rigid-body physics. Under BabylonAdapter, this is Havok. Under ThreeAdapter, this is the pluggable physics integrator you injected.

```json
"Physics": {
  "shapeType": "capsule",
  "motionType": "dynamic",
  "mass": 1,
  "friction": 0.5,
  "restitution": 0.1,
  "lockRotation": true
}
```

`shapeType`: `sphere`, `box`, `capsule`. `motionType`: `dynamic` (moves with forces), `static` (immovable), `kinematic` (moves programmatically).

### ArcCamera

Orbiting camera around a target entity.

```json
"ArcCamera": {
  "target": "Player",
  "radius": 12,
  "alpha": 0,
  "beta": 1.2
}
```

`target` is the entity name; the camera follows that entity automatically.

### CameraFollow

Camera that trails behind a target with configurable lag.

```json
"CameraFollow": {
  "target": "Player",
  "offset": [0, 5, -10],
  "lag": 0.15
}
```

### DirectionalLight

Sun-style directional lighting. Pair with `Shadow` for shadow casters.

```json
"DirectionalLight": {
  "direction": [-1, -2, -1],
  "intensity": 1.0,
  "color": [1, 1, 0.95]
}
```

### HemisphericLight

Ambient sky lighting with adjustable upper/lower colors.

```json
"HemisphericLight": {
  "direction": [0, 1, 0],
  "intensity": 0.3
}
```

### Shadow

Marks an entity (which must also have `MeshPrimitive`) as a shadow caster for a `DirectionalLight`.

```json
"Shadow": { "light": "Sun" }
```

`light` is the name of the entity with the `DirectionalLight` component.

### Animation

Plays / blends skeletal animation clips on a `Mesh`-loaded entity.

```json
"Animation": {
  "clips": { "idle": "Idle", "run": "Run" },
  "defaultClip": "idle"
}
```

### Score

Tracks numeric scores by player ID. Listens for score events.

```json
"Score": { "scores": {} }
```

### Scoreboard

DOM overlay that renders the current `Score` state.

```json
"Scoreboard": {
  "position": "top-right",
  "fontSize": 18,
  "players": [{ "id": "p1", "label": "Player 1" }]
}
```

---

## Mixing In Custom Components

`ArcadeGame` accepts an optional `componentRegistry` that merges with the built-in 14:

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    EnemySpawner: () => import('./components/EnemySpawner'),
    Health: () => import('@my-org/combat/Health'),
  },
});

// Now your scene JSON can reference "EnemySpawner" and "Health" just like
// any built-in component.
```

Each resolver returns a `Promise<Module>` where the module exports `<Name>Component` and (optionally) `<Name>System`.

You can also add a resolver after construction:

```ts
game.addComponentResolver('LateLoaded', () => import('./LateLoaded'));
```

---

## Writing Your Own Components

Every component in this package follows the same surface convention. Use it as a template:

```ts
// MyComponent.ts
import { Component, System, EventBus, type ISystemQuery } from '@babylonjsmarket/ecs';

export const MyComponentEvents = {
  TRIGGERED: 'mycomponent.triggered',
} as const;

export const MyComponentInputEvents = {
  ACTIVATE: 'mycomponent.activate',
} as const;

export class MyComponentComponent extends Component {
  threshold = 1.0;
  active = false;
}

export class MyComponentSystem extends System {
  query: ISystemQuery = { required: [MyComponentComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  onInitialize() {
    this.listen(MyComponentInputEvents.ACTIVATE, (data) => {
      // handle input — listen() auto-unsubscribes on System shutdown
    });
  }

  onUpdate(dt: number) {
    for (const entity of this.entities) {
      // per-frame logic
    }
  }
}
```

Required exports: `<Name>Component` (the data class) and `<Name>System` (the logic). Optional: `<Name>Events` / `<Name>InputEvents` for event-name constants.

---

## Debug Viz Panels

Each component ships with an optional Solid.js debug panel. Import them from the `/viz` subpath:

```ts
import { MeshPrimitiveDebugger } from '@babylonjsmarket/arcade/viz';

// Mount the panel inside your Solid app
<MeshPrimitiveDebugger world={world} />
```

The `/viz` subpath ships **TypeScript source** (not pre-built JS) because Solid's JSX transform isn't standard `react-jsx`. Your bundler must have `vite-plugin-solid` or an equivalent JSX compiler. `solid-js` is declared as an optional peer dependency — install it only if you use viz.

---

## Per-Component Imports

If you want maximum tree-shaking and don't need the lazy loader, import individual components by subpath:

```ts
import { MeshPrimitiveSystem, MeshPrimitiveComponent } from '@babylonjsmarket/arcade/MeshPrimitive';
import { MovementSystem } from '@babylonjsmarket/arcade/Movement';
```

Each component is its own dist file, so this gives bundlers the cleanest possible split.

---

## Where to Go Next

- **[@babylonjsmarket/ecs](/tools/bjs-ecs)** — The framework underneath this package. Read it to understand what components, systems, and the World do at a deeper level.
- **[@babylonjsmarket/create-arcade](https://www.npmjs.com/package/@babylonjsmarket/create-arcade)** — One-command scaffolder that bootstraps an arcade game using both packages.
- **[GitHub source](https://github.com/babylonjsmarket/bjsm)** — Read the components. Fork them. Replace what doesn't fit.

---

## License

MIT. The 14 components, the lazy loader, the viz panels — everything in this package is free forever.
