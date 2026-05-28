# ArcadeGame Walkthrough

`ArcadeGame` is a thin convenience class around `World` + `SceneLoader` + `EventBus`. It does three things you'd otherwise wire by hand:

1. **Constructs the World/SceneLoader/EventBus** as a coherent set
2. **Lazy-imports** components referenced by your scene JSON
3. **Auto-registers** the imported classes with the SceneLoader

If you want to know exactly what's happening when you call `loadSceneFromUrl`, this section walks through the actual implementation.

## The constructor

```ts
constructor(renderer: RendererAdapter, options: ArcadeGameOptions = {}) {
  this.renderer = renderer;
  this.eventBus = new EventBus();
  this.sceneLoader = new SceneLoader(this.eventBus);
  this.world = new World({
    eventBus: this.eventBus,
    sceneLoader: this.sceneLoader,
    renderer,
  });
  this.resolvers = {
    ...ARCADE_COMPONENT_REGISTRY,
    ...(options.componentRegistry ?? {}),
  };
}
```

Three things to notice:

- A single shared `EventBus` is threaded through World and SceneLoader. They both emit on it; your custom Systems all use it too.
- The `World` is constructed with the renderer you pass in — nothing about ArcadeGame is renderer-specific.
- `resolvers` merges the built-in 14-component registry with any custom resolvers from `options.componentRegistry`. We'll see how it's used below.

## init

```ts
async init(canvas: HTMLCanvasElement, opts?: RendererInitOptions) {
  await this.renderer.init(canvas, opts);
}
```

Pass-through to the adapter. The adapter handles WebGL setup, camera defaults, lighting defaults, etc. ArcadeGame doesn't intervene.

## loadSceneFromUrl

```ts
async loadSceneFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArcadeGame: failed to fetch scene from ${url}: ${response.status}`);
  }
  const sceneData = await response.json();
  await this.loadScene(sceneData);
}
```

Just `fetch` + `json` + `loadScene`. No custom transport, no caching. If you want IndexedDB, custom headers, or bundled scenes, call `loadScene(data)` directly with your own data source.

## loadScene — the interesting part

```ts
async loadScene(sceneData) {
  const names = collectComponentNames(sceneData);
  await Promise.all(Array.from(names).map((name) => this.registerByName(name)));
  this.sceneLoader.loadSceneFromData(sceneData);
  const { systems } = this.sceneLoader.instantiateScene(sceneData.name, this.world);
  for (const system of systems) {
    this.world.addSystem(system);
  }
}
```

Five steps:

1. **`collectComponentNames`** — walks `sceneData.entities`, grabs every key from every `components` object. Returns a `Set<string>` of unique names.
2. **`Promise.all(... registerByName ...)`** — imports each module in parallel. If the same scene uses MeshPrimitive 5 times, the import happens once.
3. **`sceneLoader.loadSceneFromData`** — parses the JSON into the underlying SceneLoader's internal store. Doesn't create entities yet.
4. **`sceneLoader.instantiateScene`** — actually creates the entities, attaches components, returns the list of auto-created Systems.
5. **`world.addSystem(system)`** — wires each System into the World. From now on, `world.update(dt)` ticks them.

After step 5, the World has live entities, live Systems, and is ready to render.

## registerByName — the lazy import

```ts
private async registerByName(name: string) {
  if (this.registered.has(name)) return;

  const resolve = this.resolvers[name];
  if (!resolve) {
    console.warn(`[ArcadeGame] No resolver for component "${name}"...`);
    return;
  }

  const mod = await resolve();
  const ComponentClass = mod[`${name}Component`];
  const SystemClass = mod[`${name}System`];

  if (!ComponentClass) {
    console.warn(`[ArcadeGame] Module for "${name}" did not export ${name}Component.`);
    return;
  }

  this.sceneLoader.registerComponent(name, ComponentClass, SystemClass);
  this.registered.add(name);
}
```

A scene referencing `"MeshPrimitive"` causes:

```ts
const mod = await import('./Components/MeshPrimitive/MeshPrimitive');
// mod.MeshPrimitiveComponent and mod.MeshPrimitiveSystem are now bound
sceneLoader.registerComponent('MeshPrimitive', mod.MeshPrimitiveComponent, mod.MeshPrimitiveSystem);
```

This is the whole magic. **The bundler statically analyzes the `() => import('./...')` arrow and splits each component into its own chunk.** Loading a scene that uses 5 of the 14 components pulls only 5 chunks across the wire.

## The registry

```ts
// registry.ts
export const ARCADE_COMPONENT_REGISTRY = {
  MeshPrimitive: () => import('./Components/MeshPrimitive/MeshPrimitive'),
  Movement: () => import('./Components/Movement/Movement'),
  KeyboardMover: () => import('./Components/KeyboardMover/KeyboardMover'),
  // ...all 14
};
```

It's a static object. Each value is a thunk. Bundlers handle the dynamic-import-with-literal-specifier pattern correctly — chunk per component.

## Mixing in your own components

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    EnemySpawner: () => import('./components/EnemySpawner'),
    Health: () => import('@my-org/combat/Health'),
  },
});
```

Pass extra resolvers via the constructor. They merge with the built-in 14. Your scene JSON can now reference `"EnemySpawner"` and `"Health"` like any built-in component.

Or add resolvers after construction:

```ts
game.addComponentResolver('LateLoaded', () => import('./LateLoaded'));
```

The convention is enforced loosely: the imported module must export `<Name>Component` (required) and `<Name>System` (optional). If the System export is missing, the SceneLoader just registers the Component class — useful for data-only components.

## start and stop

```ts
start() {
  if (this.running) return;
  this.running = true;
  this.renderer.startLoop((dt) => this.world.update(dt));
}

stop() {
  if (!this.running) return;
  this.running = false;
  this.renderer.stopLoop();
}
```

Idempotent. `start` ticks the World via the renderer's frame ticker. `stop` halts the loop.

## What ArcadeGame doesn't do

- **Doesn't dispose the renderer** — call `this.renderer.dispose()` yourself when you're done.
- **Doesn't tear down the World** — you can `stop()` and `start()` on the same instance, but if you want a fully clean state, construct a new `ArcadeGame`.
- **Doesn't handle scene transitions** — to swap scenes, `stop()`, throw the instance away, build a new one. Or wire your own transition logic at the World level.

## Where to next

- **[MeshPrimitive](./mesh-primitive)** — the most-used component
- **[Extending](./extending)** — custom registries, viz panels, going deeper
