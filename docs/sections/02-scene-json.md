# Scene JSON Format

A scene is an `entities` map. Each entity has optional `tags` and a required `components` object. Component keys are the **component name** (matching the lazy registry); values are the **initial data** for that component.

## Minimum complete scene

```json
{
  "name": "Hello",
  "entities": {
    "Player": {
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2 }
      }
    },
    "Camera": {
      "components": {
        "ArcCamera": { "target": "Player", "radius": 12 }
      }
    },
    "Sky": {
      "components": {
        "HemisphericLight": { "intensity": 0.6 }
      }
    }
  }
}
```

That's a complete, loadable scene. Three entities, three components, one camera that follows the player capsule under ambient lighting.

## Schema

```jsonc
{
  // Required. The name used in instantiateScene(name, world).
  "name": "Level1",

  // Optional. The entity name treated as the world-level entity.
  // Useful for global state (Score, save slots, etc.).
  "worldEntity": "World",

  // Required. Map of entity-name → entity definition.
  "entities": {
    "EntityName": {
      // Optional. String array applied via entity.addTag().
      "tags": ["player", "alive"],

      // Required. Map of component-name → component data.
      "components": {
        "ComponentName": { /* component-specific data */ }
      }
    }
  }
}
```

## What `ArcadeGame.loadScene` does with this

1. Reads the JSON
2. Walks `entities`, collects every unique key from any `components` block
3. For each unique name, calls the lazy resolver:
   - `MeshPrimitive` → `() => import('./Components/MeshPrimitive/MeshPrimitive')`
   - `ArcCamera`     → `() => import('./Components/ArcCamera/ArcCamera')`
   - …
4. Awaits all imports in parallel
5. Registers each module's `<Name>Component` and `<Name>System` with the underlying SceneLoader
6. Calls `sceneLoader.loadSceneFromData(json)` and `sceneLoader.instantiateScene(name, world)`
7. Adds the auto-created Systems to the World

The first time a scene references `Physics`, the Physics module is fetched. The second scene that references `Physics` reuses the already-cached module. Component names not in the registry produce a console warning but don't throw.

## A more realistic scene

A capsule the player controls with WASD, an orbiting camera, a sun, a floor with shadows:

```json
{
  "name": "Level1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive":  { "primitive": "capsule", "height": 2, "diameter": 1, "position": [0, 1, 0] },
        "KeyboardMover":  { "speed": 8 },
        "Physics":        { "shapeType": "capsule", "mass": 1, "lockRotation": true },
        "Shadow":         { "light": "Sun" }
      }
    },
    "Floor": {
      "components": {
        "MeshPrimitive":  { "primitive": "ground", "width": 50, "depth": 50 },
        "Physics":        { "shapeType": "box", "motionType": "static" }
      }
    },
    "Camera": {
      "components": {
        "ArcCamera": { "target": "Player", "radius": 14, "alpha": 0, "beta": 1.1 }
      }
    },
    "Sun": {
      "components": {
        "DirectionalLight": { "direction": [-1, -2, -1], "intensity": 0.9 }
      }
    },
    "Sky": {
      "components": {
        "HemisphericLight": { "intensity": 0.35 }
      }
    }
  }
}
```

That JSON, with the 5-line `main.ts` from the installation page, is a complete playable scene.

## Per-component data shapes

Each component's data shape mirrors its public fields. See the component-specific sections of these docs:

- [MeshPrimitive](./mesh-primitive) — primitive kind, dimensions, position
- [Input & Movement](./input-and-movement) — `KeyboardMover`, `PlayerInput`, `Movement`
- [Cameras](./cameras) — `ArcCamera`, `CameraFollow`
- [Lighting & Shadows](./lighting-and-shadows) — `DirectionalLight`, `HemisphericLight`, `Shadow`
- [Physics](./physics) — shape, motion, mass, locks
- [Score & UI](./score-and-ui) — `Score`, `Scoreboard`
- [Animation & Mesh](./animation-and-mesh) — `.glb` loading and animation playback

## Referencing other entities

Some components hold a reference to another entity — by **name**, not by component:

```json
"Camera": {
  "components": {
    "ArcCamera": { "target": "Player", "radius": 12 }
  }
}
```

The string `"Player"` resolves to whichever entity in the same scene is named `"Player"`. The cross-reference is established when the scene instantiates — the camera's System looks up the target the first frame it ticks.

If the target doesn't exist yet at instantiation time (e.g., dynamically spawned), the camera will fall back to its current pose until the target appears, then snap.

## Tags

```json
"Player": {
  "tags": ["player", "alive"],
  "components": { /* ... */ }
}
```

Tags are first-class in System queries — `KeyboardMover` for example uses the `'player'` tag to know which entity to drive. Don't omit them when the docs say a component requires them.

## What's not in JSON

- **Functions / callbacks** — Components are data only. Behavior lives in the System; the JSON only sets the data.
- **Live entity references** — use entity names as strings; the runtime resolves them.
- **Renderer handles** — Systems create those at runtime; you don't author them.

## Where to next

- **[ArcadeGame walkthrough](./arcade-game)** — the loader internals
- **[MeshPrimitive](./mesh-primitive)** — the most-used component
