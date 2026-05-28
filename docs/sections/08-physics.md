# Physics

Rigid-body physics. Under `BabylonAdapter` this is Havok (production-grade). Under `ThreeAdapter` this is whatever physics integrator you injected via `physicsFactory`. The component API is identical either way.

## Component shape

```ts
export interface PhysicsInput {
  shapeType: 'sphere' | 'box' | 'capsule';
  motionType?: 'dynamic' | 'static' | 'kinematic';
  mass?: number;
  friction?: number;       // 0-1
  restitution?: number;    // 0-1, bounciness
  lockRotation?: boolean;  // useful for player capsules
}
```

## Motion types

- **`dynamic`** — moved by forces and gravity. Use for players, projectiles, props that bounce around.
- **`static`** — never moves. Use for terrain, walls, fixed obstacles. Setting `mass` on a static body is meaningless.
- **`kinematic`** — moved programmatically (via `setBodyPosition` or `setBodyVelocity`), ignores gravity, but other dynamic bodies collide with it. Use for moving platforms, elevators, doors.

## JSON examples

A player capsule that can move but doesn't tip over:

```json
"Player": {
  "components": {
    "MeshPrimitive": { "primitive": "capsule", "height": 2, "diameter": 1 },
    "Physics": {
      "shapeType": "capsule",
      "motionType": "dynamic",
      "mass": 1,
      "friction": 0.4,
      "restitution": 0.0,
      "lockRotation": true
    }
  }
}
```

A static floor:

```json
"Floor": {
  "components": {
    "MeshPrimitive": { "primitive": "ground", "width": 50, "depth": 50 },
    "Physics": { "shapeType": "box", "motionType": "static" }
  }
}
```

A bouncy ball:

```json
"Ball": {
  "components": {
    "MeshPrimitive": { "primitive": "sphere", "diameter": 1 },
    "Physics": {
      "shapeType": "sphere",
      "motionType": "dynamic",
      "mass": 0.5,
      "restitution": 0.85
    }
  }
}
```

## How Physics interacts with other components

### With `Movement` or `KeyboardMover`

When a Physics body is present, Movement/KeyboardMover **defer** to the physics engine. Their `MOVE` events translate into velocity changes on the body rather than direct `setMeshPosition` calls. Result: the player bumps into walls, slides along edges, falls off ledges — collision-aware movement.

### With `MeshPrimitive`

`Physics` is always paired with `MeshPrimitive` (or `Mesh`). The mesh defines the visual shape; the Physics component defines the collision shape. They don't have to match exactly — a player's collision shape is usually a simple capsule even if the mesh is a complex character model.

### Without `MeshPrimitive`

`Physics` requires a mesh to attach to. Adding `Physics` to an entity without a mesh logs a warning and the body is never created.

## Why `lockRotation` for player capsules

Without it, an unbalanced player capsule tips over the moment it gravitates. Locking rotation keeps the capsule upright forever — what almost every game expects. If you're modeling a ragdoll, an enemy that tumbles when killed, or a vehicle that should respond to terrain, leave `lockRotation` off.

## ThreeAdapter + pure-JS physics

When using `ThreeAdapter`, you pass a `physicsFactory` to the constructor:

```ts
import { ThreeAdapter } from '@babylonjsmarket/ecs/three';

const renderer = new ThreeAdapter({
  physicsFactory: () => createPhysics({ gravityY: -30 }),
});
```

`createPhysics` is a function that returns an object satisfying `IPhysicsInstance`. The arcade package's `Physics.core.ts` is a working reference — it's a pure-JS Euler integrator with simple AABB collision against a ground plane. Good enough for most arcades; not a full physics solver.

For more advanced needs (constraints, joints, ragdolls), wrap a real physics library like Rapier or cannon-es. The `IPhysicsInstance` interface is small enough to wrap in a few hundred lines.

## Setting velocity from code

Sometimes you want to apply a velocity from a System (knockback on hit, jump impulse, dash):

```ts
this.eventBus.emit('physics.set_velocity', {
  meshId: entity.get(MeshPrimitiveComponent)?.meshId,
  vx: 0,
  vy: 12,  // upward
  vz: 0,
});
```

The Physics System listens for `physics.set_velocity` and forwards to the adapter's `physicsSetBodyVelocity`.

## Stepping

The Physics System calls `renderer.physicsStep(dt)` once per frame as part of its `onUpdate`. The renderer handles solver iterations internally. You don't need to do anything special — adding the Physics System to a World is enough.

## What's not exposed in v0.1

- **Triggers** — overlap-only colliders that fire events but don't resolve collisions
- **Joints / constraints** — hinges, springs, fixed joints
- **Raycasting** — query physics shapes by ray
- **Continuous collision detection** (CCD) — for very fast projectiles passing through walls
- **Compound shapes** — multiple primitives glued into one body

These are all supported by Havok and most physics libraries — they're just not exposed through the `RendererAdapter` interface in v0.1. They'll come.

## Where to next

- **[Score & UI](./score-and-ui)** — score tracking and HUD overlays
- **[Animation & Mesh](./animation-and-mesh)** — `.glb` loading and animation playback
