# Lighting & Shadows

Three components — `DirectionalLight`, `HemisphericLight`, `Shadow`. Most scenes use exactly one of each plus Shadow on every entity that should cast.

## DirectionalLight

Sun-style light. Parallel rays from one direction. Pair with `Shadow` components to get shadow casters.

```ts
export interface DirectionalLightInput {
  direction: [number, number, number];  // direction the light travels
  intensity?: number;                    // 0-1, default 1
  color?: [number, number, number];      // RGB 0-1, default [1, 1, 1]
}
```

### JSON

```json
"Sun": {
  "components": {
    "DirectionalLight": {
      "direction": [-1, -2, -1],
      "intensity": 0.9,
      "color": [1, 0.98, 0.92]
    }
  }
}
```

### Direction conventions

The vector points **the way the light travels**, not at the light source. `[-1, -2, -1]` is light coming from upper-right-front, hitting the ground at a downward slant — typical late-afternoon sun.

Negative-Y components mean the light shines downward (most common). Make the X and Z components small to keep shadows long and dramatic, or larger to make shadows shorter.

## HemisphericLight

Ambient sky/ground lighting. Adds a wash of color that fills shadows so they don't look pitch black.

```ts
export interface HemisphericLightInput {
  direction?: [number, number, number];  // default [0, 1, 0]
  intensity?: number;                     // default 0.3
  color?: [number, number, number];       // upper hemisphere color
  groundColor?: [number, number, number]; // lower hemisphere color
}
```

### JSON

```json
"Sky": {
  "components": {
    "HemisphericLight": {
      "intensity": 0.35,
      "color": [0.6, 0.7, 1.0],
      "groundColor": [0.2, 0.18, 0.15]
    }
  }
}
```

### Use it for ambient fill

Without a hemispheric light, shadowed areas in your scene are nearly black. That looks dramatic in screenshots and bad in gameplay — players can't see anything in the shade. Add a low-intensity hemispheric (0.2-0.4) tinted to match your scene's mood.

## Shadow

Marks an entity as a shadow caster for a `DirectionalLight`. The entity must also have `MeshPrimitive` (or `Mesh`).

```ts
export interface ShadowInput {
  light: string;  // entity name with a DirectionalLight
}
```

### JSON

```json
"Player": {
  "components": {
    "MeshPrimitive": { "primitive": "capsule" },
    "Shadow":        { "light": "Sun" }
  }
}
```

Every entity that should cast a shadow needs its own `Shadow` component pointing at the same `DirectionalLight` entity name. The Shadow System looks up the light, registers the mesh as a shadow caster on the renderer, done.

### Performance: shadow caster count

Shadow casting isn't free. Each caster runs through the depth pass for the light. For a typical arcade scene with 5-30 visible characters, you're fine. For 200+ entities, audit which ones really need shadows (players, projectiles, key props yes; clutter, distant scenery no).

## Putting it all together

```json
{
  "name": "BasicScene",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2 },
        "KeyboardMover": { "speed": 8 },
        "Movement":      {},
        "Shadow":        { "light": "Sun" }
      }
    },
    "Floor": {
      "components": {
        "MeshPrimitive": { "primitive": "ground", "width": 50, "depth": 50 }
      }
    },
    "Camera": {
      "components": {
        "ArcCamera": { "target": "Player", "radius": 14 }
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

Player capsule, sunlit, casting a shadow on a ground plane, ambient fill from above, orbit camera. Full minimum scene.

## What's not in v0.1

- **Point lights** and **spot lights** — coming in a later release
- **Light animation** (color shifts, intensity pulse) — wire your own System on the EventBus
- **Multiple directional lights** — supported by the renderer, not yet exposed via this package
- **Real-time shadow tuning** (cascades, bias) — uses adapter defaults

## Where to next

- **[Physics](./physics)** — collision-aware movement
- **[Score & UI](./score-and-ui)** — score tracking and HUD overlays
