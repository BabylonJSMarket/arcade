---
name: babylonjsmarket
description: Author and review code that uses the @babylonjsmarket family — @babylonjsmarket/ecs (World, System, Entity, Component, EventBus, SceneLoader), /arcade (arcade Components + the `arcade` CLI), and /viz. Invoke when writing or reviewing a class extending System or Component, scene JSON, a `.viz.tsx` debug panel (vizStore), event names on the bus, or when scaffolding a new Component+System — including any file importing from @babylonjsmarket/ecs, /arcade, or /viz. Also use to discover/download components from the marketplace.
---

# @babylonjsmarket — ECS, arcade & viz authoring

Single source of truth for writing and reviewing code against the `@babylonjsmarket/*` packages. The **installed type declarations are authoritative for raw signatures** (see §2); this skill keeps only what the types can't express — capability gating, event-naming rules, pooling rules, the anti-pattern table, the non-existent-method list, viz/`vizStore` conventions, the file-split, scaffolding, and the marketplace workflow.

## 0. Capability detection — run this FIRST

Different projects install different subsets of the family. **Never recommend an API from a package that isn't in the detector output.** Before answering or writing code, run the bundled detector and read its stdout.

This skill ships two ways — use whichever path exists:

```bash
# Primary: skill discovered in a consumer project's .claude/skills/ (path is relative to the project root = cwd)
bash .claude/skills/babylonjsmarket/scripts/detect-packages.sh
```
```bash
# Alternative: skill delivered as a Claude plugin
bash "${CLAUDE_PLUGIN_ROOT}/skills/babylonjsmarket/scripts/detect-packages.sh"
```

It prints one `name@version` per installed `@babylonjsmarket/*` package (alphabetical), or `NONE`. Always exits 0 — absence is data, not an error. Map the output to what you're allowed to use:

| If present | You may use | Authoritative types (verify here) |
|---|---|---|
| `@babylonjsmarket/ecs` | `World`, `System`, `Entity`, `Component`, `EventBus`, `SceneLoader`; subpaths `./babylon`, `./three`, `./babylon-lite`, `./testing` (`runMechanicContract`), `./renderer-types` | `node_modules/@babylonjsmarket/ecs/dist/**/*.d.ts` |
| `@babylonjsmarket/arcade` | arcade Components (`MeshPrimitive`, `Movement`, `Physics`, `Score`, `Enemy`, …), `@babylonjsmarket/arcade/viz` (`vizStore`, `mountArcadeViz`), the `arcade` CLI | `node_modules/@babylonjsmarket/arcade/dist/**/*.d.ts` |
| `@babylonjsmarket/viz` | standalone panel/theme APIs: `./core`, `./solid`, `./ecs`, theme CSS | `node_modules/@babylonjsmarket/viz/dist/**/*.d.ts` |

Rules:
- If `arcade` is absent, do **not** suggest `vizStore` / `@babylonjsmarket/arcade/viz` panels or arcade Components — import the System base and types from `@babylonjsmarket/ecs` instead.
- If `viz` is absent, don't reach for `@babylonjsmarket/viz`.
- If the detector prints `NONE`, the project doesn't consume this family — say so rather than scaffolding against it.

## 1. Core surface (what each package gives you)

- **`World`** — orchestrator. `world.createEntity()`, `world.addSystem(sys)`, `world.update(dt)`, entity pools (§5). `world.getEventBus()` (the `eventBus` field is **protected**).
- **`Entity`** — id + components + tags. `entity.add(c)`, `entity.get(C)`, `entity.has(C)`, `entity.hasTag(t)`. See §3 for methods that DON'T exist.
- **`Component`** — pure data. Extend `Component`. Lifecycle hooks `onAttachOverride()` / `onDetachOverride()` (Component-only).
- **`System`** — per-frame logic. Set `this.query` as a **class field** (`{ required, excluded, anyOf, tags, excludedTags }`). Override `onUpdate(dt)`; optionally `onInitialize()` / `onShutdown()` / `onEntityAdded(e)` / `onEntityRemoved(e)`. `this.entities` is a `Set<Entity>` (not an array — no `.find()`).
- **`EventBus`** — pub/sub injected into each System constructor. `eventBus.emit(name, data)`, `eventBus.on(name, cb)` (returns an unsubscribe fn).
- **`SceneLoader`** — turns scene JSON into entities/components.
- **Renderer adapters** — `@babylonjsmarket/ecs/babylon`, `/three`, or `/testing` (the `MockRendererAdapter` used in unit tests).

**Hook table (most-mistaken surface):**

| Class | Hook | When |
|---|---|---|
| `Component` | `onAttachOverride()` | After attaching to an entity in a world. `this.eventBus` safe to use. |
| `Component` | `onDetachOverride()` | On removal or entity destroy. |
| `System` | `onInitialize()` | Once, when added to a world. **Subscribe to events here.** |
| `System` | `onShutdown()` | Once, when removed. **Unsubscribe here — subscriptions are NOT auto-cleaned.** |
| `System` | `onUpdate(dt)` | Every frame. Abstract — must be implemented. |
| `System` | `onEntityAdded(entity)` | When an entity newly matches the query. |
| `System` | `onEntityRemoved(entity)` | When an entity stops matching the query. |

**Common mistake:** writing `onAttachOverride`/`onDetachOverride` on a `System`. Those are Component hooks. Systems use `onInitialize`/`onShutdown`.

## 2. Authoritative API = the installed types

**Do not memorize or guess raw signatures from this file.** The canonical method/hook/signature surface is:

- **In a consumer project:** the shipped declarations `node_modules/@babylonjsmarket/<pkg>/dist/**/*.d.ts` (the files the §0 table points at).
- **In this monorepo:** the source `packages/<pkg>/src` — e.g. `packages/ecs/src/ECS/{Component,Entity,System,World,EventBus,SceneLoader}/*.ts` and `packages/ecs/src/ECS/index.ts` (what's actually exported).

If a doc, example, or your own draft references a method, **grep the canonical source / `.d.ts` to confirm it before recommending it.** Doc examples have drifted from the package; the types have not.

**For third-party APIs** (BabylonJS, Three, physics engines): if unsure a method/signature exists on the version the project pulls in, read `node_modules/<lib>/dist/**/*.d.ts` or the official typedoc *before* writing the call site. A hallucinated name passed as a string compiles green and fails at runtime.

## 3. Methods that DO NOT exist on Entity / World

Despite appearing in some docs and examples:

- `entity.getOrThrow(X)` → use `entity.get(X)!` (when the query guarantees presence) or guard manually.
- `entity.getComponent(X)` → use `entity.get(X)`.
- `entity.hasComponent(X)` → use `entity.has(X)`.
- `world.getAllEntities()` → use `world.getEntities()`.
- `world.eventBus` from outside the class → field is `protected`; use `world.getEventBus()`. Inside a System use `this.eventBus`.

Prefer World lookups over scanning a System's `this.entities`: `world.getEntity(id)` (O(1)), `world.getEntitiesByTag(tag)`, `world.getEntitiesWithComponent(C)`, `world.query(spec)`.

## 4. Event naming — synonyms silently break the bus

EventBus is keyed by raw strings; a synonym makes two systems silently fail to communicate. The bug we've actually shipped: `ScoreboardSystem` listened for `score.updated` while `ScoreSystem` emitted `score.changed`, so the HUD never updated.

**Before emitting or subscribing, grep the noun** (`score.`, `enemy.`, `physics.`, `world.`, `keyboard.`) and reuse the *exact* existing string. Don't guess a synonym that "feels right."

Canonical names you'll touch most:

| Concern | Emitter | Listener(s) | Canonical name |
|---|---|---|---|
| Award pts | gameplay code | `ScoreSystem` | `score.add` |
| Score moved | `ScoreSystem` | `ScoreboardSystem`, HUD | `score.changed` |
| Score wiped | `ScoreSystem` | HUD | `score.reset` |
| Reset req | reset button | `ScoreSystem` | `score.resetRequest` |
| Goal | `GoalSystem` | `ScoreSystem` | `goal.scored` |
| Hit reg | `BulletSystem` | `EnemySystem` | `enemy.hit` |
| Kill | `EnemySystem` | spawners, scoring | `enemy.killed` |
| Bumper hit | `BumperSystem` | scoring | `bumper.hit` |
| Body ready | `PhysicsSystem` | gameplay init | `physics.body.created` |
| Entity new | `World` | viz / debuggers | `world.entity.created` |
| Entity gone | `World` | viz / debuggers | `world.entity.removed` |
| Input | input layer | every input system | `keyboard.keydown`, `keyboard.keyup` |

Known dead synonyms → correct name: `score.updated`→`score.changed`; `enemy.hurt`/`enemy.damaged`→`enemy.hit`; `enemy.died`→`enemy.killed`; `world.entity.spawned`→`world.entity.created`; `keyboard.down`→`keyboard.keydown`.

**Naming rules:**
- State changes are **past-tense**: `changed`, `killed`, `hit`, `created`, `removed`.
- Direct requests are **imperative or `*Request`**: `add`, `resetRequest`.
- Keep the two distinct — don't use `-ed` for a request or `-Request` for an event.

**Source of truth:** declare each event once in the component's `{Name}Events` (emitted) or `{Name}InputEvents` (listened-to) constant, and import the constant everywhere — never a string literal. Listeners that hardcode the string are how synonyms creep in.

```ts
// ✅ imports the canonical name from the emitter
import { ScoreEvents } from '@babylonjsmarket/arcade';
this.eventBus.on(ScoreEvents.CHANGED, ...);

// ❌ hardcoded synonym — breaks silently when the emitter renames
this.eventBus.on('score.updated', ...);
```

**EventBus subscription pattern** — subscriptions are NOT auto-cleaned when a System detaches:

```ts
class MySystem extends System {
  private unsubscribes: Array<() => void> = [];
  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on('damage.dealt', (data) => { /* ... */ })
    );
  }
  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
  }
}
```

## 5. Pooling spawned entities (don't churn create/remove)

**Rule: nothing that spawns or dies during gameplay** (bullets, enemies, particles, muzzle flashes, pickups, damage numbers) **should go through raw `createEntity`/`new mesh` + destroy per occurrence.** Per-frame entity+mesh alloc/dispose is the single biggest avoidable perf sink. Use the built-in `World` pool ("removal from play" is the existing `active` flag; pooling wraps it):

```ts
world.registerPool('enemy', {
  size: 32,                       // peak concurrent; recycles oldest if exceeded
  build: (e) => { e.addTag('enemy'); e.add(new MeshPrimitiveComponent(...)); e.add(new HealthComponent(...)); },
  reset: (e, data) => { /* set position/HP/etc. from the spawn data */ },
});
const enemy = world.acquire('enemy', { x, y, z, hp });  // un-park + reset
// on death: world.removeEntity(enemy)  → releases (parks) it, does NOT destroy
```

- `registerPool` pre-builds `size` entities (runs `build` while active so resource systems create meshes), then parks each (`active = false`).
- `acquire` un-parks a free slot, runs `reset`, re-activates; recycles the oldest live one when exhausted.
- `removeEntity` on a pool-owned entity **releases** it (parks, kept alive); only non-pooled entities are destroyed — so existing "on death, `removeEntity`" code transparently recycles.
- Parking via `active = false` removes the entity from every system's query set automatically — **no `pooled` tag needed**. But `getEntitiesByTag`/`getEntitiesWithComponent` still return inactive entities, so gameplay scans must filter `.active` (e.g. `getEntitiesByTag('enemy').filter(e => e.active)`).
- A parked entity keeps its tags and is named after its pool — `registerPool('enemy', …)` → `enemy-0`, `enemy-1`, … (reads clearly in inspectors). Name the pool after the entity kind.

Everything that spawns/dies in gameplay is an entity pool: a `{Kind}Pool` component carries the size; its System registers the World pool and turns a `*.fire`/spawn event into `world.acquire`; the gameplay System (`EnemySystem`, `BulletSystem`) drives the live (active) ones off `this.entities` and calls `world.removeEntity` to release. There is no separate "mesh pool" — bullets are real `bullet-N` entities.

**Resource-owning systems must be park-aware** (done for `MeshPrimitiveSystem`, `HealthBar`, `Shadow`): in `onEntityRemoved`, if `!entity.active` (parked, not destroyed) **keep** the resource — hide the mesh / keep the shadow caster — and dispose only on a true destroy; on `onEntityAdded` reuse + show the existing handle. Without this, parking re-disposes the GPU resources you were pooling.

Gotchas the pool design respects:
- **Spawn-frame race.** On the frame a pooled entity is (re)acquired, MeshPrimitive positions its mesh *and* the owning gameplay system would too → two systems write one handle in one frame. Skip the owning system's write for that frame (a `newborns` set consumed in `onUpdate`).
- **Park-write vs per-frame-write race.** A despawn parks the entity synchronously inside the killer's `onUpdate`, so the parked system's `onEntityRemoved` runs attributed to that system. If `onEntityRemoved` writes a handle with the **same adapter method** the system also writes per-frame, they collide (the bug that flickered health bars: `layout()` and the park-hide both called `setMeshScale`). Fix: the park-hide uses a *different* method — `HealthBar` parks via `setMeshVisible`, leaving `setMeshScale` to `layout()`.
- **Size = peak concurrent.** ≥ the max alive at once, so recycling never steals a live entity.
- **Teardown.** `removeAllEntities` force-destroys pooled entities; their meshes are reclaimed by `renderer.dispose()` (wholesale), not per-entity.

## 6. Scene JSON

Scenes declare entities and their components by name (arcade lazy-imports each named component the first time it appears):

```json
{
  "gameTitle": "My Game",
  "sceneTitle": "Level 1",
  "entities": {
    "Player": {
      "tags": ["player"],
      "components": {
        "MeshPrimitive": { "primitive": "capsule", "height": 2 }
      }
    }
  }
}
```

## 7. File / folder convention — the `.core.ts` + `.ts` split

```
Components/Foo/
├── Foo.core.ts          # PURE DATA — Component class, *Events / *InputEvents consts, *Input interface,
│                        # request-payload interfaces. ZERO imports from renderer-types or sibling components.
├── Foo.ts               # System + any renderer-coupled types. Re-exports the core surface:
│                        #   export { FooComponent, type FooInput, FooEvents } from './Foo.core'
├── Foo.viz.tsx          # FooDebuggerComponent + FooDebuggerSystem + Solid <FooPanelView /> (arcade/viz, not the main registry).
├── Foo.test.ts          # Component construction + serialize round-trip + System smoke vs the Mock adapter.
├── Foo.contract.test.ts # runMechanicContract({ … }) from '@babylonjsmarket/ecs/testing'.
└── meta.json            # Marketplace metadata.
```

- **Component is pure data.** No `@babylonjs/*` imports, no DOM, no side effects in the constructor.
- **No runtime state on a Component.** Mesh handles, `Set<string>` of live ids, one-shot init flags — anything non-serializable — live in a `WeakMap<FooComponent, FooRuntime>` on the System so `serialize()` round-trips. Frame caches (cooldown counters, last-facing vector) can stay on the Component since they serialize fine.

```ts
interface FooRuntime { bgHandle?: MeshHandle; initialized: boolean }
export class FooSystem extends System {
  private runtime = new WeakMap<FooComponent, FooRuntime>();
  private getRuntime(c: FooComponent): FooRuntime {
    let r = this.runtime.get(c);
    if (!r) { r = { initialized: false }; this.runtime.set(c, r); }
    return r;
  }
}
```

## 8. Scaffolding a new Component + System

When the user names a component concept ("add Health", "scaffold a Cooldown component"):

1. **Run §0 capability detection first.** If neither `@babylonjsmarket/ecs` nor `@babylonjsmarket/arcade` is present, stop and tell the user to add one first. Scaffold against only what's present — if arcade is absent, import `System`/types from `@babylonjsmarket/ecs`, not arcade, and don't reference arcade Components or `@babylonjsmarket/arcade/viz`.
2. **Derive names:** `Name` (PascalCase), `slug` (kebab), `lowerName` (camelCase).
3. **Pick the output dir,** in order of preference: `src/components/{Name}/` if `src/components/` exists; else `src/games/<existing-game>/components/{Name}/` for a multi-game monorepo; else ask.
4. **Duplicate check:** if `{outputDir}/{Name}.ts` already exists, stop — extend it in place rather than scaffold a duplicate.
5. **Author the files** following §7, with these framework rules baked in:
   - `{Name}.core.ts`: the `{Name}Component` data class, `{Name}Input` interface, `{Name}Events` (emitted) + `{Name}InputEvents` (listened-to) consts, request-payload interfaces. Events are PascalCase consts pointing to lowercase dotted strings — `XxxEvents.CHANGED = 'xxx.changed'`. Zero renderer / sibling imports.
   - `{Name}.ts`: the `{Name}System extends System` (from `@babylonjsmarket/ecs`). **Query goes on the class field, not in the constructor.** Re-export the core surface.
   - **EventBus subscriptions go in `onInitialize`; unsubscribes in `onShutdown`** (collect the unsubscribe fns and call them — non-negotiable, listeners leak otherwise). See §4.
   - Reference real API only (§3). Verify any third-party call against the installed `.d.ts` (§2).
   - Tests: `{Name}.core.test.ts` (data round-trip) and/or `{Name}.contract.test.ts` (`runMechanicContract` from `@babylonjsmarket/ecs/testing`). Skip tests only if the project has none nearby.
6. **Report** what you created and the next steps: edit the component to add real fields; wire the System — `world.addSystem(new {Name}System(world.getEventBus()))`; add scene JSON if relevant (`"{Name}": { … }`).

A debug panel is a separate convention (§9) — sibling `{Name}.viz.tsx`, not scaffolded from here.

## 9. Viz panels (`@babylonjsmarket/arcade/viz`)

*(Only when `arcade` is installed — see §0.)*

Boot the viz layer once per game host:

```ts
import { mountArcadeViz } from '@babylonjsmarket/arcade/viz'
const viz = mountArcadeViz(game.world, { sceneName: 'pinball' })
// → Entities panel (` to toggle) + EventBus debugger (F4) + a pinned FPS counter. dispose() on unmount.
```

`sceneName` namespaces localStorage so panels in different scenes don't collide. Opts: `fpsOverlay: false`, `eventBusDebugger: false`, `toggleKey: 'Backquote'`.

Every debug panel registers through one singleton: `vizStore`. Panels get draggable / closable / resizable chrome + localStorage persistence for free. Persist slider/dropdown state with `setPanelData`/`getPanelData` (NOT a `createSignal` seeded with the scene default — that resets on reload):

```ts
import { vizStore } from '@babylonjsmarket/arcade/viz'
vizStore.registerPanel({ id: PANEL_ID, title: 'Foo', position: 'top-left', titleColor: '#c4a8ff',
  content: () => <FooPanelView world={w} /> })
vizStore.showPanel(PANEL_ID); vizStore.togglePanel(PANEL_ID); vizStore.isVisible(PANEL_ID)
vizStore.hidePanel(PANEL_ID); vizStore.unregisterPanel(PANEL_ID)  // unregister in System.onShutdown

const seed = vizStore.getPanelData<number>(PANEL_ID, 'flipSpeed', 24)   // seed from persisted value
const [flipSpeed, setFlipSpeed] = createSignal(seed)
const setAndSave = (v: number) => { setFlipSpeed(v); vizStore.setPanelData(PANEL_ID, 'flipSpeed', v) }
```

### The `{Name}Debugger` component + system convention

Panels are a Component+System pair, declared in scene JSON like any other component. The System owns the registration lifecycle and the keyboard hotkey:

```ts
export class FooDebuggerComponent extends Component {
  visible: boolean; activationKey: string; position: 'top-left'|'top-right'|'bottom-left'|'bottom-right'
  constructor(data: FooDebuggerInput = {}) {
    super()
    this.visible = data.visible ?? false
    this.activationKey = data.activationKey ?? 'Digit1'
    this.position = data.position ?? 'top-right'
  }
  serialize(): FooDebuggerInput { /* … */ }
}

export class FooDebuggerSystem extends System {
  private component: FooDebuggerComponent | null = null
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  private panelRegistered = false
  constructor(eventBus: EventBus) {
    super(eventBus)
    this.query = { required: [FooDebuggerComponent] }
    this._pauseable = false
  }
  protected onInitialize(): void {
    for (const e of this.entities) { const c = e.get(FooDebuggerComponent); if (c) { this.component = c; break } }
    this.setupKeyboardListener(); this.tryRegisterPanel()
  }
  protected onUpdate(): void { if (!this.panelRegistered) this.tryRegisterPanel() }   // retry loop
  protected onEntityAdded(e: Entity): void {
    const c = e.get(FooDebuggerComponent); if (c && !this.component) { this.component = c; this.tryRegisterPanel() }
  }
  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID); this.panelRegistered = false
    if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler)
  }
  private tryRegisterPanel(): void {
    if (this.panelRegistered || !this.component || !this.world) return
    vizStore.registerPanel({ id: PANEL_ID, title: 'Foo', position: this.component.position,
      content: () => <FooPanelView world={this.world!} /> })
    this.panelRegistered = true
    if (this.component.visible) vizStore.showPanel(PANEL_ID)
  }
}
```

Declare in scene JSON: `"FooDebugger": { "visible": false, "activationKey": "Digit5", "position": "top-left" }`.

Why the retry loop: panels often depend on another entity (a Camera, a Player) existing. `tryRegisterPanel` runs from `onInitialize`, every `onUpdate`, AND on `onEntityAdded`, so the panel appears as soon as its prerequisite is in the world; set `panelRegistered = true` once successful to stop retrying.

## 10. Anti-patterns to flag and rewrite

| Anti-pattern | Why wrong | Fix |
|---|---|---|
| `this.entities.find(e => e.id === id)` | `this.entities` is a `Set` — `.find` doesn't exist on Set, and even on the array form it's O(n). | `const e = this.world.getEntity(id); if (!e \|\| !this.entities.has(e)) return;` |
| `onAttachOverride` / `onDetachOverride` on a `System` | Component hooks, not System hooks. | `onInitialize` / `onShutdown` |
| `entity.getOrThrow(X)` | Doesn't exist. | `entity.get(X)!` (when the query guarantees presence) |
| `entity.getComponent(X)` | Doesn't exist. | `entity.get(X)` |
| `entity.hasComponent(X)` | Doesn't exist. | `entity.has(X)` |
| `world.getAllEntities()` | Doesn't exist by that name. | `world.getEntities()` |
| `world.eventBus` from outside the class | Field is `protected`. | `world.getEventBus()` |
| Subscribing in `onInitialize` without tracking unsubscribe | Subs leak when the System is removed. | Track unsubscribes; fire them in `onShutdown`. |
| Filtering by `if (entity.canX)` per-frame in a System | OOP trap; the query system already filters. | Set `query.required` and let the framework filter. |
| Mesh handle / `Set` / one-shot flag stored on a Component | Breaks `serialize()` round-trip + save/load. | Move to a `WeakMap<FooComponent, FooRuntime>` on the System. |
| Panel `registerPanel` in a render loop | Re-registers stomp position + duplicate listeners. | Register once (System.onInitialize via `panelRegistered`); unregister in onShutdown. |
| `createSignal(scene-default)` for a slider value | Loses tuning on reload. | `vizStore.getPanelData(PANEL_ID, key, default)` to seed; `setPanelData(…)` in the setter. |
| `mesh.scaling.x = …` / `scene.activeCamera.detachControl()` inside a System (cast through `BabylonAdapterLike`) | Renderer-coupling leak. | Use the matching adapter method: `setMeshScale`, `setMeshBillboardMode`, `setCameraControlsEnabled`, `pickAtScreenPoint`, `physicsSetBodyVelocity`, `physicsResizeBoxBody`, `physicsSetGravity`, `replaceMeshGeometry`, etc. |
| A destructive System (calls `world.removeEntity`) whose `query.required` is a single data component | It also matches — and destroys — bare `{Name}: {}` **marker** entities (e.g. a singleton carrying pool/config), silently. | Require a *real* sibling too (e.g. `[FlashComponent, MeshPrimitiveComponent]`) so markerless singletons never match. |
| Storing pool/config/singleton state on the same entity that carries a self-removing marker (`Flash`, etc.) | When the marker's system removes that entity, your pool/config vanish with it. | Put persistent singleton state on its own entity with no self-removing marker. |
| `createEntity`/`removeEntity` per spawn/death for anything that spawns/dies during gameplay | Per-frame entity+mesh alloc/dispose churns GC + GPU and re-triggers add/remove work. Biggest avoidable perf sink. | Pool it (§5). |
| Aliasing `@babylonjsmarket/arcade` (or `ecs`/`viz`) to its `src` in a downstream Vite/Astro app | Out-of-root package is served via `/@fs/` URLs and (with relative dynamic imports) loaded **twice** → two copies of every Component class → `entity.has(X)` silently false → systems never match. No error. | Consume the built `dist` (a normal node_modules dep = one module graph). See §11. |

## 11. Local dev, build & consumption (downstream apps like `games/`)

The packages are **compiled**; downstream apps import the built `dist` (the package `exports` map points there; only `./viz` points at `src`).

- **After changing `packages/<pkg>/src`, run `npm run build` in that package, then reload the page.** A freshly-started Vite dev server watches the linked package's `dist` (symlinked into `node_modules` as a workspace dep) and picks up the rebuild on reload — no full restart needed for ordinary source edits.
- **When a rebuild doesn't show up, restart the dev server** (a long-running server's dependency-optimizer / module cache went stale). **Config changes (`astro.config.*`) always need a restart** — Vite reads config once at startup.
- **Do NOT "fix" staleness by aliasing the package to its `src`** — it causes the duplicate-module failure in §10.
- **Template sync is dormant:** the scaffold's arcade-room scene is authored directly in `packages/arcade/templates/`, so `PAIRS` in `scripts/sync-templates.js` is empty and there's nothing to re-sync. Only if you add a CLI template that mirrors a live game under `games/src/games/arcade/<game>/` do you add a pair, run `npm run sync-templates`, and use `@sync-skip-begin`/`@sync-skip-end` (or `// @sync-skip`) to keep playground-only panels out of the template (a drift test enforces it).
- **Tests use `MockRendererAdapter`, not Babylon.** Green unit/contract tests prove *logic*, not that the live game renders. They add systems *before* entities, whereas the live `SceneLoader`/`ArcadeGame` path creates entities first and **backfills** systems via `world.addSystem`. Cover pooling/singleton/marker behavior with a lifecycle-order integration test (entities first, then `addSystem`).

**Debugging "the System runs but `this.entities` is empty / never sees its component":** almost always (1) a **duplicate module instance** (an out-of-root `src` alias) so the entity's component class ≠ the query's class (`getEntitiesWithComponent` returns 0 but a by-`constructor.name` scan finds it); or (2) the **host entity was removed** (a destructive system consumed a bare marker — dump `world.getEntities()` and look for the missing singleton).

## 12. Scaffolding a new arcade game

*(Only when `arcade` is installed — see §0.)*

```bash
npm create @babylonjsmarket/arcade <dir>     # or: npx @babylonjsmarket/arcade init <dir>
```

There is **no template choice** — every scaffold is a single multigame arcade. After scaffolding: `cd <dir> && npm install && npm run dev`, then open the printed URL.

The scaffold ships one starter scene, the **arcade room** (`src/scenes/arcade-room.ts`), plus the multigame structure: `src/scenes/index.ts` is the scene map (`SCENES` + `DEFAULT_SCENE`) — the seam where you register more scenes; `src/registry.ts` holds shared resolvers; `src/main.ts` is the tiny boot that loads the default scene. Assets (carpet textures, cabinet GLB) stream from `https://babylonjsgames.com/arcade/...`. Scenes are TS modules that declare entities + components **by name**; arcade lazy-imports each named built-in the first time it appears. To fill the arcade, add `src/scenes/<my-game>.ts`, register it in `src/scenes/index.ts`, and load it with `game.loadScene(SCENES['<my-game>'])`. **Custom components** go under `src/components/` and are wired up via `src/registry.ts` (or `ArcadeGame`'s `componentRegistry` option) — each resolver is `() => import('./components/Thing')` returning `{ ThingComponent, ThingSystem }`.

**`arcade eject`** copies built-in arcade component source into the project so you own and can edit it (shadcn-style). It writes `src/components/<Name>/` folders, patches `src/registry.ts` so the local copies override the package's built-ins, and drops this skill into `.claude/skills/babylonjsmarket/`. Forms: `arcade eject` (eject what the scenes + `registry.ts` reference + their deps), `arcade eject <Name>...` (specific components), `arcade eject --all`, and `--dry-run` to preview. Use it when the user wants to customize a built-in component's behavior rather than wrap it.

## 13. Discovering & downloading components from the marketplace

The full marketplace ships 50+ components beyond the arcade starter bundle. Use the existing **`bjs` CLI** (`@babylonjsmarket/bjs`, in `tools/bjs-cli/`) — **do not build a new tool**. It authenticates and pulls component files from the server library into a local library, from which you bring them into the project.

Verified commands and flows (`tools/bjs-cli/src/index.ts`, `commands/*.ts`, `utils/component-catalog.ts`):

- `bjs login` — OAuth device-flow auth (required before any library access).
- `bjs whoami` / `bjs logout` — show / clear the current user.
- `bjs bbs` — the interactive BBS-style interface where library browse/sync/install lives:
  - **Settings → Sync Library** calls the server manifest (`GET /api/library/manifest`) and downloads every accessible component's files (`GET /api/library/file/<path>`) into your local library (`~/.bjs/Library`, structured `Components/<Name>/<Name>.ts` etc.). Locked (unowned) components show a price and are skipped.
  - In a project's panel, **`[C] Components`** lists components in your local library not yet installed and copies the selected one into the project (`src/Components/<Name>.ts`, plus its `tests/Components/<Name>.test.ts` if present).
- `bjs download <asset-key>` — downloads a marketplace **asset** (e.g. a GLB), not a component file.

The underlying endpoints (consumed by the above, not separate CLI flags): `GET /api/library/manifest` returns `{ files: ServerFileInfo[], totalFiles, unlockedFiles }` where each entry has `path`, `version`, `category`, `hasAccess`, `price?`, `files[]`, `dependencies?`; `GET /api/library/file/<encoded path>` returns `{ content, version }`. Both go through `AuthManager.makeAuthenticatedRequest` (Bearer token).

**Workflow:** discover/sync via `bjs` → install the component file(s) into the project's `src/Components/` (or your `src/components/<Name>/`) → wire the System into the World / scene JSON (and add a `registry.ts` resolver for a custom-component arcade project, §12) → verify the component's API against its source and the installed `@babylonjsmarket/*` `.d.ts` before relying on it (§2). Downloaded component files may use older conventions — flag any §10 anti-patterns and rewrite to the current surface as you integrate.

## 14. When to invoke this skill

- Writing/reviewing a new System, Component, or scene JSON.
- "How do I subscribe to events in a system" / lifecycle / hook questions.
- Any debug panel work — viz, HP bar, sliders, tuning UI, FPS overlay, "toggle a panel with key X", "why doesn't my slider persist on reload".
- A spawned/pooled mesh "doesn't appear", a System "runs but never matches its component", a singleton vanishes, or a package edit "isn't taking effect" — read §11 before theorizing about the renderer.
- Scaffolding a component (§8) or a new arcade game (§12).
- Pulling a component from the marketplace (§13).
- Before agreeing a doc/example snippet "looks right" — check method names against §2/§3.
