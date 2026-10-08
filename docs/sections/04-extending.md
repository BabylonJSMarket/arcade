# Extending

## Your own component

A component is a folder in `src/components/`. The scaffold's registry finds it by folder name, so a scene can use it with no wiring.

```ts
// src/components/Spin/Spin.ts
import { Component, System } from '@babylonjsmarket/ecs';

export class SpinComponent extends Component {
  speed = 1;
}

export class SpinSystem extends System {
  protected query = { required: [SpinComponent] };

  protected onInitialize(): void {
    this.listen('spin.reverse', () => { /* … */ }); // auto-unsubscribed on shutdown
  }

  protected onUpdate(dt: number): void {
    for (const e of this.entities) {
      const spin = e.get(SpinComponent)!;
      // move things through this.world!.renderer, never a raw engine object
    }
  }
}
```

The module must export `<Name>Component`. Every export named `<Name>…System` is started too, so one component can drive several systems.

Put the event names it sends in `src/components/Spin/Spin.events.ts`, so a listener imports the names and not the System.

## Outside a scaffold

Pass resolvers yourself:

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    Spin: () => import('./components/Spin/Spin'),
    Health: () => import('./components/Health/Health'),
  },
});
```

## Engine plugins

A component that needs something the renderer adapter doesn't offer ships an `adapter/register.ts` that exports `register<Name>Extension(adapter)`. The scaffold's `main.ts` calls every one it finds and waits for them all before the scene loads. Outside a scaffold, call it yourself after creating the adapter, and await it.

A registrar may be async. Check `adapter.kind` first, then import the engine half, so a game on another engine never downloads it:

```ts
export async function registerFooExtension(adapter: FooHost): Promise<void> {
  if (adapter.kind !== 'babylon' || typeof adapter.getScene !== 'function') return;
  const { createBabylonFoo } = await import('./Foo.babylon');
  adapter.registerExtension(FOO_EXTENSION, createBabylonFoo({ getScene: () => adapter.getScene!() }));
}
```

Keep any import of `./Foo.babylon` at the top of `register.ts` to `import type`. A plain import there puts Babylon back in every game's main bundle.

## Debug panels

A component's `<Name>.viz.tsx` exports `<Name>DebuggerComponent` + `<Name>DebuggerSystem`. The scaffold's registry maps them to the scene key `<Name>Debugger` in dev builds. `mountArcadeViz` from `@babylonjsmarket/arcade/viz` mounts the shared Entities and EventBus panels.

## Where to next

- The [@babylonjsmarket/ecs](/tools/bjs-ecs) docs — Component, System, World and EventBus in depth
