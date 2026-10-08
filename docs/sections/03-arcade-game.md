# ArcadeGame Walkthrough

`ArcadeGame` is a thin class around `World` + `SceneLoader` + `EventBus`. It does three things you'd otherwise wire by hand:

1. Builds the World, SceneLoader and EventBus as one set, sharing one bus.
2. Lazy-imports the components your scene names, through `options.componentRegistry`.
3. Registers what it imported and starts the systems before the entities exist.

## The constructor

```ts
const game = new ArcadeGame(renderer, { componentRegistry: REGISTRY });
```

`componentRegistry` maps a component name to `() => import(...)`. It is the only lookup — arcade has no built-in components. A scaffold passes `src/registry.ts`, which globs `src/components/*/<Name>.ts`.

Add a resolver later with `game.addComponentResolver('Spin', () => import('./components/Spin/Spin'))`.

## init

`await game.init(canvas, opts?)` passes straight to the renderer adapter.

## loadSceneFromUrl and loadScene

`loadSceneFromUrl(url)` is `fetch` + `json` + `loadScene`. Call `loadScene(data)` yourself for bundled scenes.

`loadScene`:

1. Collects every component name the entities use.
2. Calls each name's resolver once, in parallel.
3. Registers the module's `<Name>Component` and every `<Name>…System` it exports.
4. Adds and initializes the systems, then creates the entities. Every system is listening before the first `onEntityAdded` fires.

`{ replace: true }` removes the current scene's entities and the systems it brought first. Systems your app added stay.

## A name with no resolver

The scene still loads, without that component. `ArcadeGame` logs one warning per missing name, telling you to run `npx arcade core` (core set) or `bjs download <Name>` (marketplace). A module that has no `<Name>Component` export also warns and is skipped.

## start and stop

`start()` ticks the World from the renderer's frame loop. `stop()` halts it. Both are safe to call twice.

## What ArcadeGame doesn't do

- **Dispose the renderer.** Call `game.renderer.dispose()` when you're done.
- **Ship components.** They come from `npx arcade core`, `bjs download`, or your own `src/components/`.
- **Install engine plugins.** The scaffold's `main.ts` globs `src/components/*/adapter/register.ts` and calls each `register…Extension(adapter)`, then awaits them all before the scene loads.

## Where to next

- **[Extending](./extending)** — your own components and registries
