import {
  World,
  EventBus,
  SceneLoader,
  type Component,
  type System,
  type RendererAdapter,
  type RendererInitOptions,
} from "@babylonjsmarket/ecs";

/** A component's module: `<Name>Component`, and any `<Name>…System`. */
export type ComponentModule = Record<string, unknown>;
/** Loads one component module on demand — `() => import('./components/X/X')`. */
export type LazyComponentResolver = () => Promise<ComponentModule>;

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
   * How a scene's component names become code: name → lazy module import.
   * This is the ONLY place ArcadeGame looks — arcade ships no components of its
   * own. A scaffolded project passes its `src/registry.ts` map, which globs
   * every folder in `src/components/` (the core set `arcade core` downloads,
   * plus anything `bjs download` adds).
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
 * World. Names resolve through `options.componentRegistry` only.
 *
 * Usage:
 * ```ts
 * import { ArcadeGame } from '@babylonjsmarket/arcade';
 * import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon';
 *
 * import { REGISTRY } from './registry'; // globs src/components/*
 *
 * const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY });
 * await game.init(canvas);
 * await game.loadSceneFromUrl('/scenes/level1.json');
 * game.start();
 * ```
 *
 * Only the components a loaded scene names get imported, so each stays its own
 * lazy chunk.
 */
export class ArcadeGame {
  public readonly world: World;
  public readonly eventBus: EventBus;
  public readonly sceneLoader: SceneLoader;
  public readonly renderer: RendererAdapter;

  private readonly resolvers: Record<string, LazyComponentResolver>;
  private readonly registered = new Set<string>();
  /** Names already warned about, so a missing component warns once. */
  private readonly warnedMissing = new Set<string>();
  private running = false;
  /**
   * Systems the CURRENT scene added, so switching scenes can tear exactly
   * those down. Tracked here because the world also holds systems the host app
   * added itself, which must survive a scene change.
   */
  private sceneSystems: System[] = [];

  constructor(renderer: RendererAdapter, options: ArcadeGameOptions = {}) {
    this.renderer = renderer;
    this.eventBus = new EventBus();
    this.sceneLoader = new SceneLoader(this.eventBus);
    this.world = new World({
      eventBus: this.eventBus,
      sceneLoader: this.sceneLoader,
      renderer,
    });
    this.resolvers = { ...(options.componentRegistry ?? {}) };
  }

  async init(canvas: HTMLCanvasElement, opts?: RendererInitOptions): Promise<void> {
    await this.renderer.init(canvas, opts);
  }

  async loadSceneFromUrl(url: string, opts: { replace?: boolean } = {}): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcadeGame: failed to fetch scene from ${url}: ${response.status}`);
    }
    const sceneData = (await response.json()) as SceneJson;
    await this.loadScene(sceneData, opts);
  }

  /**
   * Load a scene.
   *
   * `replace: true` tears the CURRENT scene down first — every entity, and the
   * systems that scene brought with it. That is what a multigame arcade needs:
   * without it a second scene collides with the first (two entities called
   * `Sun`) and the old scene's systems keep running underneath the new one.
   * It defaults to false so a first load, and any single-scene app, behaves
   * exactly as before.
   */
  async loadScene(sceneData: SceneJson, opts: { replace?: boolean } = {}): Promise<void> {
    if (opts.replace) this.unloadScene();
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
      this.sceneSystems.push(system);
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
   * Tear down the current scene: its entities, then the systems it brought.
   * Systems the host app added itself are left alone.
   */
  unloadScene(): void {
    this.world.removeAllEntities();
    for (const system of this.sceneSystems) {
      this.world.removeSystem(system);
    }
    this.sceneSystems = [];
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
      if (!this.warnedMissing.has(name)) {
        this.warnedMissing.add(name);
        console.warn(
          `[ArcadeGame] The scene uses component "${name}", but this project does not have it, so entities skip it. ` +
            `Core components: run \`npx arcade core\`. Marketplace components: run \`bjs download ${name}\`. ` +
            `Either puts it in src/components/, where src/registry.ts finds it. ` +
            `(Arcade itself ships no components; pass them with the componentRegistry option or addComponentResolver().)`,
        );
      }
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
