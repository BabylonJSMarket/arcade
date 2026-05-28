# MeshPrimitive

Spawn a mesh from a primitive shape. Almost every visible entity in a scene has a `MeshPrimitive` (or a `Mesh` for `.glb` assets).

## Component shape

```ts
export interface MeshPrimitiveInput {
  primitive: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'ground' | 'torus' | 'disc' | 'plane';

  // Dimensions (only the relevant ones for each primitive)
  width?: number;
  height?: number;
  depth?: number;
  diameter?: number;
  diameterTop?: number;
  diameterBottom?: number;
  tessellation?: number;

  // Transform
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  // Appearance
  color?: [number, number, number];
  material?: MaterialSpec;
}
```

The MeshPrimitiveComponent stores the input plus the resulting `MeshHandle` once the System has created the mesh.

## Events

```ts
export const MeshPrimitiveEvents = {
  CREATED: 'meshprimitive.created',     // emitted when mesh is created on the renderer
  DESTROYED: 'meshprimitive.destroyed', // emitted when the entity is destroyed and mesh is cleaned up
} as const;

export const MeshPrimitiveInputEvents = {
  SET_POSITION: 'meshprimitive.set_position',
  SET_ROTATION: 'meshprimitive.set_rotation',
  SET_SCALE:    'meshprimitive.set_scale',
  SET_COLOR:    'meshprimitive.set_color',
} as const;
```

Listen to `CREATED` if your other systems need to know when a mesh becomes available (e.g., the camera attaches to it). Listen to `DESTROYED` to clean up references that held the entity's mesh handle.

## JSON examples

A player capsule:

```json
"Player": {
  "components": {
    "MeshPrimitive": {
      "primitive": "capsule",
      "height": 2,
      "diameter": 1,
      "position": [0, 1, 0]
    }
  }
}
```

A textured ground plane:

```json
"Floor": {
  "components": {
    "MeshPrimitive": {
      "primitive": "ground",
      "width": 50,
      "depth": 50,
      "material": { "color": [0.2, 0.25, 0.2] }
    }
  }
}
```

A spinning torus:

```json
"Decoration": {
  "components": {
    "MeshPrimitive": {
      "primitive": "torus",
      "diameter": 3,
      "tessellation": 32,
      "position": [0, 5, 0],
      "rotation": [0, 0, 1.57]
    }
  }
}
```

## What the System does

`MeshPrimitiveSystem` does three things:

1. **On `onEntityAdded`** — calls `renderer.createMesh(meshId, spec)`, stores the returned `MeshHandle` on the component, emits `MeshPrimitiveEvents.CREATED`.
2. **On `onEntityRemoved`** — calls `renderer.destroyMesh(handle)`, emits `DESTROYED`.
3. **On input events** — listens for `SET_POSITION`, `SET_ROTATION`, etc., and forwards to the adapter's `setMeshPosition`, `setMeshRotation`, etc.

The component's `meshId` is a stable string derived from the entity's ID. Other components (Physics, Shadow, Animation, Movement) use that `meshId` to find the right mesh in the adapter.

## What about runtime updates

Most of the time, **don't emit `SET_POSITION`** every frame from your gameplay code — let Physics or Movement own that. Use the input events when you need to teleport an entity, snap to a checkpoint, or apply a one-off transform from UI.

For per-frame movement, attach a `Movement` or `Physics` component. Those Systems handle the per-frame `setMeshPosition` calls efficiently.

## Where to next

- **[Input & Movement](./input-and-movement)** — KeyboardMover, PlayerInput, Movement
- **[Physics](./physics)** — rigid bodies on a primitive mesh
