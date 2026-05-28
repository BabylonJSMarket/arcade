# Animation & Mesh

For richer visuals than primitive shapes — characters, props, animated models — pair `Mesh` (loads a `.glb`/`.gltf` asset) with `Animation` (plays the clips inside it).

## Mesh

Loads a `.glb` or `.gltf` from a URL and attaches the resulting mesh to the entity.

```ts
export interface MeshInput {
  url: string;
  scale?: [number, number, number] | number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}
```

### JSON

```json
"Enemy": {
  "components": {
    "Mesh": {
      "url": "/models/orc.glb",
      "scale": 0.5,
      "position": [10, 0, 0]
    }
  }
}
```

The `Mesh` component takes the place of `MeshPrimitive` for asset-loaded entities — don't put both on the same entity. Other components that reference a mesh (Physics, Shadow, Movement, Animation) work the same way against a Mesh-loaded entity.

### Async loading

Loading `.glb` files is async. The `MeshSystem` calls `renderer.loadMesh(meshId, spec)` on `onEntityAdded`, then emits `MeshEvents.LOADED` when the asset is ready. Until then, other components that depend on the mesh wait — Physics, Shadow, Animation, etc. all listen for `LOADED` before attaching.

This means your scene may pop in over a few hundred milliseconds as `.glb` files download. Preloading is up to you — there's no built-in preloader yet.

## Animation

Plays and blends skeletal animation clips on a Mesh-loaded entity. Operates on the clips defined inside the `.glb` file.

```ts
export interface AnimationInput {
  clips: Record<string, string>;  // friendly-name → clip-name-in-glb
  defaultClip?: string;            // start playing this clip when loaded
}

export const AnimationEvents = {
  CLIP_STARTED:   'animation.clip.started',
  CLIP_COMPLETED: 'animation.clip.completed',
} as const;

export const AnimationInputEvents = {
  PLAY:        'animation.play',     // { entityId, clip, loop?, fadeIn? }
  STOP:        'animation.stop',
  SET_WEIGHT:  'animation.set_weight',
  SET_SPEED:   'animation.set_speed',
} as const;
```

### JSON

```json
"Enemy": {
  "components": {
    "Mesh": {
      "url": "/models/orc.glb",
      "scale": 0.5
    },
    "Animation": {
      "clips": {
        "idle":  "Idle_Loop",
        "walk":  "Walk_Loop",
        "attack": "Attack_OneShot"
      },
      "defaultClip": "idle"
    }
  }
}
```

The `clips` map gives you a stable **friendly name** to use in your gameplay code regardless of what the artist named the clip inside the `.glb`. When the artist renames `Walk_Loop` to `Run_v2`, you change one line of JSON, not 30 lines of game code.

### Playing clips from gameplay

```ts
// In a System
this.eventBus.emit('animation.play', {
  entityId: enemy.id,
  clip: 'walk',         // friendly name from clips map
  loop: true,
  fadeIn: 0.2,           // seconds, smooth blend in
});
```

### Switching clips

When you emit `animation.play` with a new clip, the System smoothly crossfades from the current clip if `fadeIn > 0`. Set `fadeIn: 0` for instant snaps (useful for triggered actions like attack frames).

### One-shot clips

For non-looping animations (attack swings, hit reactions), set `loop: false`:

```ts
this.eventBus.emit('animation.play', {
  entityId: enemy.id,
  clip: 'attack',
  loop: false,
});

this.eventBus.on('animation.clip.completed', ({ entityId, clip }) => {
  if (entityId === enemy.id && clip === 'attack') {
    // attack animation done — return to idle
    this.eventBus.emit('animation.play', { entityId, clip: 'idle', loop: true });
  }
});
```

### Weight blending

For partial blends (upper-body shooting while lower-body running), use `set_weight`:

```ts
this.eventBus.emit('animation.play',      { entityId, clip: 'run',   loop: true });
this.eventBus.emit('animation.play',      { entityId, clip: 'shoot', loop: false });
this.eventBus.emit('animation.set_weight', { entityId, clip: 'shoot', weight: 0.7 });
```

The renderer adapter handles the blending — Babylon's animation graph or Three's `AnimationMixer`.

## Primitive vs. asset-loaded

| Use case | Component |
|---|---|
| Player capsule, simple shapes, prototyping | `MeshPrimitive` |
| Characters, complex props, anything from Blender / Mixamo | `Mesh` |

Same scene can have both. The primitive shapes load instantly; the asset-loaded entities pop in async.

## Where to next

- **[Extending](./extending)** — custom component registries, viz panels, going deeper
