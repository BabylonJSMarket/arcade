# Cameras

Two camera components ship in v0.1: `ArcCamera` (orbiting) and `CameraFollow` (trailing). Pick the one that fits — they're mutually exclusive on a given camera entity.

## ArcCamera

The classic third-person orbit camera. Stays a fixed radius from a target entity; the player can rotate around it with the mouse (or arrow keys).

```ts
export interface ArcCameraInput {
  target: string;       // entity name to orbit
  radius?: number;      // distance from target
  alpha?: number;       // horizontal angle in radians
  beta?: number;        // vertical angle in radians
  upperBetaLimit?: number;
  lowerBetaLimit?: number;
  enableMouseInput?: boolean;
}
```

### JSON

```json
"Camera": {
  "components": {
    "ArcCamera": {
      "target": "Player",
      "radius": 14,
      "alpha": 0,
      "beta": 1.1,
      "lowerBetaLimit": 0.4,
      "upperBetaLimit": 1.5
    }
  }
}
```

### What's `alpha` and `beta`?

Spherical coordinates around the target:
- **`alpha`** — horizontal angle (think yaw, looking left/right around the target)
- **`beta`** — vertical angle (think pitch, looking up/down)
- `beta = 0` is directly above the target, `beta = π/2` is at the horizon, `beta = π` is directly below

Most arcade scenes want `beta` between `0.4` (mostly looking down) and `1.5` (almost flat). Clamp it with the limit fields so the player can't rotate the camera into the ground.

### Mouse control

`"enableMouseInput": true` (default) lets the player click-drag to orbit. Disable it for cutscenes, menus, or when another component owns the camera angles.

### Camera-relative input

When `KeyboardMover` or `PlayerInput` is in camera-relative mode (the default), they read the active `ArcCamera`'s `alpha` to figure out which direction `W` should move. This is why most arcade scenes feel right out of the box — pressing forward goes forward relative to where the player is looking.

## CameraFollow

A trailing camera. Sits at a fixed offset from the target and lerps to keep up.

```ts
export interface CameraFollowInput {
  target: string;
  offset?: [number, number, number];  // local-space offset
  lag?: number;                        // 0 = instant snap, 1 = no movement, default ~0.1
  lookAtTarget?: boolean;              // always look at the target
}
```

### JSON

```json
"Camera": {
  "components": {
    "CameraFollow": {
      "target": "Player",
      "offset": [0, 5, -10],
      "lag": 0.15,
      "lookAtTarget": true
    }
  }
}
```

### When to pick which

- **ArcCamera** — third-person action games, MOBAs, anything where the player wants to look around the player character. Default for most arcades.
- **CameraFollow** — over-the-shoulder, top-down, side-scroller, or anything where the camera should feel like it's *attached* rather than orbiting. Use for cinematic chases or fixed perspectives.

## Switching cameras at runtime

Each scene typically has one active camera entity. You can have multiple camera components in a scene (e.g., a player ArcCamera and a SpectatorCamera for a spectator mode) but only the most-recently-active one drives rendering.

Emit `'camera.activate'` with the entity ID to swap:

```ts
world.getEventBus().emit('camera.activate', { entityId: spectatorCamId });
```

The active camera also drives the camera-relative coordinate system used by `KeyboardMover` and `PlayerInput`.

## Target lookup timing

Both components resolve `target` to an entity reference the first frame they tick. If the target entity doesn't exist yet (it's spawned later), the camera falls back to its current pose. Once the target appears in a later frame, the camera snaps to track it.

Most scenes load all entities together, so you won't see this — it only matters when entities are spawned dynamically.

## Where to next

- **[Lighting & Shadows](./lighting-and-shadows)** — DirectionalLight, HemisphericLight, Shadow
- **[Physics](./physics)** — collision-aware movement
