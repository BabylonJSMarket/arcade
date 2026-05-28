# Input & Movement

Three components form the typical input → motion pipeline:

- **`KeyboardMover`** — reads WASD/arrow keys, emits movement input events
- **`PlayerInput`** — higher-level input mapping (move + jump + action buttons)
- **`Movement`** — listens to movement events, integrates position on entities with `MeshPrimitive`

You usually combine `KeyboardMover` (or `PlayerInput`) with `Movement` on the same entity.

## KeyboardMover

The simplest input driver. Captures keyboard state, emits `MOVE` events to drive `Movement`.

```ts
export interface KeyboardMoverInput {
  speed: number;       // units/second
  cameraRelative?: boolean; // move in camera-relative space (default: true)
  cameraEntity?: string;    // entity name with ArcCamera; defaults to first ArcCamera
}

export const KeyboardMoverEvents = {
  MOVE: 'keyboardmover.move',
  STOP: 'keyboardmover.stop',
} as const;
```

### JSON

```json
"Player": {
  "tags": ["player"],
  "components": {
    "MeshPrimitive": { "primitive": "capsule", "height": 2 },
    "KeyboardMover": { "speed": 8 },
    "Movement":      {}
  }
}
```

`KeyboardMover` only acts on entities **tagged `'player'`** by convention — this means you can have multiple entities with KeyboardMover wired for different control schemes, only the player-tagged one will respond to WASD.

### Camera-relative motion

By default, pressing `W` moves the player **forward relative to the active camera**. If the camera has rotated around the player, `W` still moves "into the screen" — which is what every modern game does and what feels right.

Disable with `"cameraRelative": false` if you want world-axis movement (often the choice for top-down games).

## PlayerInput

A richer input mapping. Use this when you need buttons beyond directional movement — jump, attack, interact.

```ts
export interface PlayerInputInput {
  moveSpeed: number;
  jumpForce?: number;
  // Button bindings (keyboard codes)
  bindings?: {
    moveForward?: string[];
    moveBack?: string[];
    moveLeft?: string[];
    moveRight?: string[];
    jump?: string[];
    action?: string[];
  };
}

export const PlayerInputEvents = {
  MOVE:   'playerinput.move',
  JUMP:   'playerinput.jump',
  ACTION: 'playerinput.action',
} as const;
```

### JSON

```json
"Player": {
  "tags": ["player"],
  "components": {
    "MeshPrimitive": { "primitive": "capsule", "height": 2 },
    "PlayerInput": {
      "moveSpeed": 8,
      "jumpForce": 12,
      "bindings": {
        "jump": ["Space"],
        "action": ["KeyE", "Mouse0"]
      }
    },
    "Movement": {},
    "Physics": { "shapeType": "capsule", "mass": 1, "lockRotation": true }
  }
}
```

The defaults bind:
- WASD or arrow keys → move
- Space → jump
- E → action

Override with your own keys via `bindings`.

## Movement

The integrator. Listens for `MOVE` events (from either `KeyboardMover` or `PlayerInput`), accumulates velocity, calls `renderer.setMeshPosition` each frame.

```ts
export interface MovementInput {
  maxSpeed?: number;       // velocity cap
  acceleration?: number;   // how fast velocity ramps up
  damping?: number;         // 0-1, friction-like deceleration when no input
}
```

### JSON

```json
"Player": {
  "components": {
    "MeshPrimitive": { "primitive": "capsule" },
    "KeyboardMover": { "speed": 8 },
    "Movement": {
      "maxSpeed": 12,
      "acceleration": 40,
      "damping": 0.9
    }
  }
}
```

### When you need Physics-driven movement instead

If the entity has both `Movement` **and** `Physics`, Physics wins — `Movement` defers because the physics integrator owns position when a rigid body exists. The `MOVE` event in that case applies a velocity to the physics body rather than directly setting position.

This is what you usually want: the player should bump into walls, not pass through them. Add Physics for collision-aware movement. Skip it if you want lightweight "ghost" entities that move freely.

## Combining input components

```json
"Player": {
  "tags": ["player"],
  "components": {
    "MeshPrimitive":  { "primitive": "capsule", "height": 2 },
    "PlayerInput":    { "moveSpeed": 8, "jumpForce": 12 },
    "Movement":       {},
    "Physics":        { "shapeType": "capsule", "mass": 1, "lockRotation": true },
    "Shadow":         { "light": "Sun" }
  }
}
```

That's the canonical "controllable character" stack: visual + input + movement + physics + shadow. Use it as the starting point; add or remove pieces as needed.

## Where to next

- **[Cameras](./cameras)** — ArcCamera and CameraFollow
- **[Physics](./physics)** — rigid bodies and collisions
