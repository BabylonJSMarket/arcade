import {
  World,
  EventBus,
  SceneLoader,
  type Component,
  type System,
  type RendererAdapter,
  type RendererInitOptions,
} from "@babylonjsmarket/ecs";
import {
  ARCADE_COMPONENT_REGISTRY,
  type LazyComponentResolver,
} from "./registry";

/**
 * Scene JSON shape. Kept minimal here — anything else in the JSON is forwarded
 * to SceneLoader, which has the canonical SceneData type. We only need the
 * entity/component name surface to know what to import.
 */
interface SceneJson {
  name: string;
  entities?: Record<string, { components?: Record<string, unknown> }>;
}

export interface ArcadeGameOptions {
  /**
   * Extra component resolvers to merge with the built-in arcade registry.
   * Use this to add components from other packages (e.g. a future
   * @babylonjsmarket/arcade-ai) or one-off custom components in your project.
   */
  componentRegistry?: Record<string, LazyComponentResolver>;
}

/**
 * High-level convenience class for arcade-style games.
 *
 * Wraps `World` + `EventBus` + `SceneLoader` from @babylonjsmarket/ecs and
 * adds **lazy component resolution**: components referenced by name in a
 * scene JSON file are dynamically imported the first time they're seen, then
 * registered with the SceneLoader and (if they expose a System) added to the
 * World.
 *
 * Usage:
 * ```ts
 * import { ArcadeGame } from '@babylonjsmarket/arcade';
 * import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
 *
 * const game = new ArcadeGame(new BabylonAdapter());
 * await game.init(canvas);
 * await game.loadSceneFromUrl('/scenes/level1.json');
 * game.start();
 * ```
 *
 * If your scene only uses `MeshPrimitive`, `KeyboardMover`, and `ArcCamera`,
 * those are the only component modules that get pulled into the bundle —
 * `Physics`, `Animation`, etc. stay tree-shaken out.
 */
export class ArcadeGame {
  public readonly world: World;
  public readonly eventBus: EventBus;
  public readonly sceneLoader: SceneLoader;
  public readonly renderer: RendererAdapter;

  private readonly resolvers: Record<string, LazyComponentResolver>;
  private readonly registered = new Set<string>();
  private running = false;

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

  async init(canvas: HTMLCanvasElement, opts?: RendererInitOptions): Promise<void> {
    await this.renderer.init(canvas, opts);
  }

  async loadSceneFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcadeGame: failed to fetch scene from ${url}: ${response.status}`);
    }
    const sceneData = (await response.json()) as SceneJson;
    await this.loadScene(sceneData);
  }

  async loadScene(sceneData: SceneJson): Promise<void> {
    const names = collectComponentNames(sceneData);
    await Promise.all(Array.from(names).map((name) => this.registerByName(name)));
    this.sceneLoader.loadSceneFromData(sceneData as Parameters<SceneLoader["loadSceneFromData"]>[0]);

    // Two-phase load so the order is correct regardless of how the scene JSON
    // orders its entities/systems:
    //
    //   1. Create + add + INITIALIZE every system the scene uses, WITHOUT
    //      creating any entities yet (`createEntities: false`). Adding each
    //      system to an initialized world subscribes it to the EventBus
    //      (its `onInitialize` runs).
    //   2. Instantiate the entities (`createSystems: false`, since the systems
    //      already exist). Creating an entity fires every system's
    //      `onEntityAdded`; because all systems are already subscribed, a
    //      one-shot event emitted from one system's `onEntityAdded` (e.g. the
    //      arcade DirectionalLight's `directionallight.created`, which carries
    //      the light handle that CardFan/PokerTableCards/Shadow need) reliably
    //      reaches every other system.
    //
    // The previous order (instantiate entities, THEN addSystem each) lost those
    // one-shot events: entities existed before any system was subscribed, so the
    // member had to manually call `world.initialize()` first and order the
    // card-renderer entity ahead of the light. This makes it just work.
    const { systems } = this.sceneLoader.instantiateScene(sceneData.name, this.world, {
      createEntities: false,
    });
    for (const system of systems) {
      this.world.addSystem(system);
    }

    // Ensure the world (and therefore every system just added) is initialized
    // and subscribed BEFORE any entity is created. addSystem only initializes a
    // system immediately when the world is already initialized; for the first
    // scene the world is not yet initialized, so initialize it now.
    this.world.initialize();

    this.sceneLoader.instantiateScene(sceneData.name, this.world, {
      createSystems: false,
    });
  }

  /**
   * Manually register an extra component resolver after construction. Useful
   * for plugin-style integrations where components are discovered late.
   */
  addComponentResolver(name: string, resolver: LazyComponentResolver): void {
    this.resolvers[name] = resolver;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.renderer.startLoop((dt) => this.world.update(dt));
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.stopLoop();
  }

  private async registerByName(name: string): Promise<void> {
    if (this.registered.has(name)) return;
    const resolve = this.resolvers[name];
    if (!resolve) {
      console.warn(`[ArcadeGame] No resolver for component "${name}" — register one with addComponentResolver() or pass componentRegistry to the constructor.`);
      return;
    }

    const mod = await resolve();
    const ComponentClass = mod[`${name}Component`] as
      | (new (data?: unknown) => Component)
      | undefined;

    if (!ComponentClass) {
      console.warn(`[ArcadeGame] Module for "${name}" did not export ${name}Component.`);
      return;
    }

    // Register EVERY system this component drives, not just `${name}System`: a
    // component may own several (e.g. a missile's guidance + impact, a convoy's
    // chain + helm). Any export named `${name}…System` counts — so a
    // pool-spawned component's systems come to life the moment its blueprint
    // puts the key in a scene, with no per-component wiring.
    const sysRe = new RegExp(`^${name}[A-Za-z0-9]*System$`);
    const systems = Object.keys(mod)
      .filter((k) => sysRe.test(k) && typeof mod[k] === "function")
      .map((k) => mod[k] as new (eventBus: EventBus) => System);

    this.sceneLoader.registerComponent(name, ComponentClass, systems);
    this.registered.add(name);
  }
}

function collectComponentNames(sceneData: SceneJson): Set<string> {
  const names = new Set<string>();
  for (const entity of Object.values(sceneData.entities ?? {})) {
    if (entity?.components) {
      for (const name of Object.keys(entity.components)) {
        names.add(name);
      }
    }
  }
  return names;
}
