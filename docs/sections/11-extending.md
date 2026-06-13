# Extending the Package

Three patterns for going beyond the built-in 14 components: custom component registries, viz panels for debugging, and writing components that follow the same conventions.

## Custom component registries

`ArcadeGame` accepts a `componentRegistry` option that merges with the built-in 14. Use it to add components from another package, a sibling repo, or your own project.

### Per-instance

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    EnemySpawner: () => import('./components/EnemySpawner'),
    Health:       () => import('@my-org/combat/Health'),
    Loot:         () => import('./components/Loot'),
  },
});

// Your scene JSON can now reference these by name:
//   "components": { "EnemySpawner": {...}, "Health": {...}, "Loot": {...} }
```

### After construction

```ts
game.addComponentResolver('LateLoaded', () => import('./LateLoaded'));
```

Useful for plugin-style integrations where components are discovered after the game has started.

### What goes in a resolver

A resolver is `() => Promise<Module>`. The module must export `<Name>Component` (required) and `<Name>System` (optional):

```ts
// EnemySpawner.ts
export class EnemySpawnerComponent extends Component {
  rate = 1.0;
  maxAlive = 5;
}

export class EnemySpawnerSystem extends System {
  // ...
}
```

Match the naming convention exactly — the loader strips the `"EnemySpawner"` key from the JSON, looks for `mod["EnemySpawner" + "Component"]` and `mod["EnemySpawner" + "System"]`.

## Writing your own component

Every component in this package follows the same surface. Use it as a template.

```ts
// MyThing.ts
import { Component, System, EventBus, type ISystemQuery } from '@babylonjsmarket/ecs';

// 1. Events the System emits
export const MyThingEvents = {
  TRIGGERED: 'mything.triggered',
} as const;

// 2. Events the System listens to
export const MyThingInputEvents = {
  ACTIVATE: 'mything.activate',
} as const;

// 3. The data class
export class MyThingComponent extends Component {
  threshold = 1.0;
  active = false;
}

// 4. The System
export class MyThingSystem extends System {
  query: ISystemQuery = { required: [MyThingComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  onInitialize() {
    this.listen(MyThingInputEvents.ACTIVATE, (data) => {
      // handle input event — listen() auto-unsubscribes on System shutdown
    });
  }

  onUpdate(dt: number) {
    for (const entity of this.entities) {
      const c = entity.get(MyThingComponent)!;
      // per-frame logic
    }
  }
}
```

Required exports: `MyThingComponent` (data class) and `MyThingSystem` (logic). Optional: `MyThingEvents` / `MyThingInputEvents` for constants.

Once you have this file, hook it into your game:

```ts
const game = new ArcadeGame(renderer, {
  componentRegistry: {
    MyThing: () => import('./MyThing'),
  },
});

// Your JSON:
//   "Thing": { "components": { "MyThing": { "threshold": 5 } } }
```

## Viz panels

Every built-in component ships with a `.viz.tsx` Solid.js debug panel — live readouts of the component's state. Wire them during development; peel them off for production.

### Import from the `/viz` subpath

```ts
import { MeshPrimitiveDebugger, MovementDebugger } from '@babylonjsmarket/arcade/viz';

// In your Solid app:
<MeshPrimitiveDebugger world={world} />
<MovementDebugger world={world} />
```

The `/viz` subpath ships **TypeScript source** (not pre-built JS) because Solid's JSX transform isn't standard `react-jsx`. Your bundler must have `vite-plugin-solid` or an equivalent JSX compiler. `solid-js` is declared as an **optional** peer dependency — install it only if you use viz.

### Why source, not built JS

Solid's JSX compiler (`babel-preset-solid`) turns JSX into reactive primitives — not plain `React.createElement` calls. `tsc` can't do this transform alone. The choices are:
1. Ship a heavy bundler config inside the package
2. Ship source and let consumers' bundlers handle it

The package picks option 2. If you're using Vite or any modern framework with Solid support, it Just Works.

## Building your own viz panel

For your custom components, follow the convention used by the built-ins:

```tsx
// MyThing.viz.tsx
import { Component as SolidComponent, createSignal } from 'solid-js';
import { vizStore } from '@babylonjsmarket/arcade/viz';
import { MyThingComponent } from './MyThing';

export const MyThingDebugger: SolidComponent<{ world: World }> = (props) => {
  const [snapshot, setSnapshot] = createSignal({});

  // Subscribe to vizStore — fires once per frame with the latest world state
  vizStore.subscribe((world) => {
    // Pull MyThingComponent values from active entities
  });

  return <div class="oss-viz-panel">/* render the panel */</div>;
};
```

The `vizStore` is a Solid store updated each frame by an internal viz System. Subscribe to it and the panel re-renders only when relevant fields change.

## When to write fresh components vs. add custom resolvers

- **Fresh component for one project** — keep it next to your game source, hand-roll the resolver in your `componentRegistry`.
- **Shared across multiple projects** — publish as its own package, expose it via `componentRegistry`.
- **Bundle a set of components** — start a sibling package (e.g., `@my-org/arcade-combat`) that exports a `COMBAT_COMPONENT_REGISTRY` object the way `@babylonjsmarket/arcade` exports `ARCADE_COMPONENT_REGISTRY`. Consumers merge both registries:

```ts
import { ARCADE_COMPONENT_REGISTRY } from '@babylonjsmarket/arcade';
import { COMBAT_COMPONENT_REGISTRY } from '@my-org/arcade-combat';

const game = new ArcadeGame(renderer, {
  componentRegistry: { ...COMBAT_COMPONENT_REGISTRY },
});
```

The arcade resolvers are auto-included; the combat ones merge on top. Both are lazy.

## Where to next

- The package's [GitHub source](https://github.com/babylonjsmarket/bjsm) — read each component file as a worked example
- The [Scene JSON Format](./scene-json) section — when you need to remind yourself what the loader actually does
- The underlying [@babylonjsmarket/ecs](/tools/bjs-ecs) docs — for ECS concepts that aren't covered here
