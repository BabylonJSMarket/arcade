import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Component,
  EventBus,
  MockRendererAdapter,
  SceneLoader,
  System,
  World,
} from '@babylonjsmarket/ecs';
import { ArcadeGame, type ComponentModule } from './ArcadeGame';

// ----------------------------------------------------------------------------
// Stub component / system used by tests. We don't import any real arcade
// component module — the resolver returns these classes directly so the test
// stays hermetic and never spins up Babylon.
// ----------------------------------------------------------------------------

class StubComponent extends Component {
  data: unknown;
  constructor(data?: unknown) {
    super();
    this.data = data;
  }
}

class StubSystem extends System {
  protected query = { required: [StubComponent] };
  constructor(eventBus: EventBus) {
    super(eventBus);
  }
  onUpdate(_deltaTime: number): void {
    // no-op
  }
}

/** Only ArcadeGame's own warnings (SceneLoader warns about unknown names too). */
function arcadeWarnings(warn: { mock: { calls: unknown[][] } }): string[] {
  return warn.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[ArcadeGame]'));
}

/** Build a module-shaped object matching what `resolve()` returns. */
function makeStubModule(name: string, withSystem = true): ComponentModule {
  const mod: ComponentModule = {
    [`${name}Component`]: StubComponent,
  };
  if (withSystem) {
    mod[`${name}System`] = StubSystem;
  }
  return mod;
}

describe('ArcadeGame — construction', () => {
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
  });

  it('exposes world, eventBus, sceneLoader, and renderer', () => {
    const game = new ArcadeGame(renderer);
    expect(game.world).toBeInstanceOf(World);
    expect(game.eventBus).toBeInstanceOf(EventBus);
    expect(game.sceneLoader).toBeInstanceOf(SceneLoader);
    expect(game.renderer).toBe(renderer);
  });

  it('wires the same EventBus into SceneLoader and World', () => {
    const game = new ArcadeGame(renderer);
    // emit through the public eventBus and confirm SceneLoader sees it
    const spy = vi.fn();
    game.eventBus.on('test.shared.bus', spy);
    game.eventBus.emit('test.shared.bus', { ok: true });
    expect(spy).toHaveBeenCalledWith({ ok: true });
  });

  it('resolves scene names through options.componentRegistry', async () => {
    const customResolver = vi.fn(async () => makeStubModule('Custom'));
    const game = new ArcadeGame(renderer, {
      componentRegistry: { Custom: customResolver },
    });
    await game.loadScene({
      name: 'registry-test',
      entities: { e1: { components: { Custom: {} } } },
    });
    expect(customResolver).toHaveBeenCalledTimes(1);
    expect(game.sceneLoader.getComponentClass('Custom')).toBe(StubComponent);
  });

  it('has no built-in components: a core name with no registry entry is unknown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const game = new ArcadeGame(renderer);
    await game.loadScene({
      name: 'no-builtins',
      entities: { e1: { components: { MeshPrimitive: {} } } },
    });
    expect(game.sceneLoader.getComponentClass('MeshPrimitive')).toBeUndefined();
    const msgs = arcadeWarnings(warn);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('npx arcade core');
    warn.mockRestore();
  });
});

describe('ArcadeGame — addComponentResolver', () => {
  it('registers a late resolver that loadScene then picks up', async () => {
    const renderer = new MockRendererAdapter();
    const game = new ArcadeGame(renderer);

    const lateResolver = vi.fn(async () => makeStubModule('Late'));
    game.addComponentResolver('Late', lateResolver);

    await game.loadScene({
      name: 'late-test',
      entities: { e1: { components: { Late: {} } } },
    });
    expect(lateResolver).toHaveBeenCalledTimes(1);
  });
});

describe('ArcadeGame — init', () => {
  it('forwards init to the renderer adapter', async () => {
    const renderer = new MockRendererAdapter();
    const game = new ArcadeGame(renderer);
    const canvas = document.createElement('canvas');
    await game.init(canvas);
    expect(renderer.calls.some((c) => c.method === 'init')).toBe(true);
  });
});

describe('ArcadeGame — loadScene lazy resolution', () => {
  let renderer: MockRendererAdapter;
  let game: ArcadeGame;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
    game = new ArcadeGame(renderer);
  });

  it('imports each unique component name exactly once across many entities', async () => {
    const sharedResolver = vi.fn(async () => makeStubModule('Shared'));
    game.addComponentResolver('Shared', sharedResolver);

    await game.loadScene({
      name: 'unique-test',
      entities: {
        a: { components: { Shared: {} } },
        b: { components: { Shared: {} } },
        c: { components: { Shared: {} } },
      },
    });

    expect(sharedResolver).toHaveBeenCalledTimes(1);
  });

  it('does not import components that the scene does not reference', async () => {
    const usedResolver = vi.fn(async () => makeStubModule('Used'));
    const unusedResolver = vi.fn(async () => makeStubModule('Unused'));
    game.addComponentResolver('Used', usedResolver);
    game.addComponentResolver('Unused', unusedResolver);

    await game.loadScene({
      name: 'tree-shake-test',
      entities: { e1: { components: { Used: {} } } },
    });

    expect(usedResolver).toHaveBeenCalledTimes(1);
    expect(unusedResolver).not.toHaveBeenCalled();
  });

  it('does not re-import a component already registered by a previous loadScene', async () => {
    const resolver = vi.fn(async () => makeStubModule('Cached'));
    game.addComponentResolver('Cached', resolver);

    await game.loadScene({
      name: 'scene-1',
      entities: { e1: { components: { Cached: {} } } },
    });
    await game.loadScene({
      name: 'scene-2',
      entities: { e2: { components: { Cached: {} } } },
    });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('registers the resolved component class with the SceneLoader', async () => {
    const resolver = vi.fn(async () => makeStubModule('Foo'));
    game.addComponentResolver('Foo', resolver);

    await game.loadScene({
      name: 'register-test',
      entities: { e1: { components: { Foo: {} } } },
    });

    expect(game.sceneLoader.getComponentClass('Foo')).toBe(StubComponent);
    expect(game.sceneLoader.getSystemClass('Foo')).toBe(StubSystem);
  });

  it('still registers the component when the module has no System export', async () => {
    const resolver = vi.fn(async () => makeStubModule('NoSys', false));
    game.addComponentResolver('NoSys', resolver);

    await game.loadScene({
      name: 'no-system-test',
      entities: { e1: { components: { NoSys: {} } } },
    });

    expect(game.sceneLoader.getComponentClass('NoSys')).toBe(StubComponent);
    expect(game.sceneLoader.getSystemClass('NoSys')).toBeUndefined();
  });

  it('warns and skips when no resolver is registered for a referenced component', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await game.loadScene({
      name: 'missing-test',
      entities: { e1: { components: { Mystery: {} } } },
    });
    const msgs = arcadeWarnings(warn);
    expect(msgs).toHaveLength(1);
    const msg = msgs[0];
    expect(msg).toContain('"Mystery"');
    expect(msg).toContain('npx arcade core');
    expect(msg).toContain('bjs download Mystery');
    expect(game.sceneLoader.getComponentClass('Mystery')).toBeUndefined();
    warn.mockRestore();
  });

  it('warns about a missing component only once, however many scenes use it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = (name: string) => ({
      name,
      entities: { a: { components: { Ghost: {} } }, b: { components: { Ghost: {} } } },
    });
    await game.loadScene(scene('ghost-1'));
    await game.loadScene(scene('ghost-2'), { replace: true });
    expect(arcadeWarnings(warn)).toHaveLength(1);
    warn.mockRestore();
  });

  it('ignores scene entities that have no components key', async () => {
    // branch 154 `if (entity?.components)` FALSE arm: an entity object with no
    // `components` field contributes no names, so only the real one resolves.
    // SceneLoader.instantiateScene itself requires `components`, so we stub the
    // loader pass and assert collectComponentNames skipped the bare entity.
    const realResolver = vi.fn(async () => makeStubModule('Real'));
    game.addComponentResolver('Real', realResolver);
    vi.spyOn(game.sceneLoader, 'loadSceneFromData').mockImplementation(() => undefined as never);
    vi.spyOn(game.sceneLoader, 'instantiateScene').mockReturnValue({
      systems: [],
    } as never);

    await expect(
      game.loadScene({
        name: 'no-components-test',
        entities: {
          empty: {}, // no components key → false arm
          e1: { components: { Real: {} } },
        },
      }),
    ).resolves.toBeUndefined();

    // Only the entity that actually declares components triggered a resolve.
    expect(realResolver).toHaveBeenCalledTimes(1);
    expect(game.sceneLoader.getComponentClass('Real')).toBe(StubComponent);
  });

  it('warns when the resolver returns a module without the expected ${name}Component export', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolver = vi.fn(async () => ({ NotItComponent: StubComponent }) as ComponentModule);
    game.addComponentResolver('Bogus', resolver);

    await game.loadScene({
      name: 'bogus-test',
      entities: { e1: { components: { Bogus: {} } } },
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('did not export BogusComponent'),
    );
    expect(game.sceneLoader.getComponentClass('Bogus')).toBeUndefined();
    warn.mockRestore();
  });
});

describe('ArcadeGame — one-shot lifecycle events on loadScene (regression)', () => {
  // Reproduces the DirectionalLight → CardFan/Shadow shadow-caster wiring bug.
  //
  // One system EMITS a one-shot "created" event from its `onEntityAdded` (like
  // DirectionalLightSystem emitting `directionallight.created` carrying the
  // light handle). Another system SUBSCRIBES to that event in `onInitialize`
  // and records the payload (like Shadow/CardFan attaching shadow casters).
  //
  // Under the old order (instantiate entities, THEN addSystem each), entities
  // existed before any system had subscribed, so the one-shot event fired into
  // an empty bus and the consumer never received the light handle — cards cast
  // no shadow unless the member manually called world.initialize() first and
  // ordered the entities just so. This asserts it now works regardless of
  // entity/system order, with NO manual world.initialize().

  class LightComponent extends Component {}
  class CasterComponent extends Component {}

  // Captured across systems so the test can assert delivery.
  let receivedHandle: unknown;

  class LightSystem extends System {
    protected query = { required: [LightComponent] };
    protected onEntityAdded(): void {
      // One-shot: emitted exactly once, when the light entity appears.
      this.eventBus.emit('light.created', { handle: 'LIGHT_HANDLE' });
    }
    onUpdate(): void {}
  }

  class CasterSystem extends System {
    protected query = { required: [CasterComponent] };
    protected onInitialize(): void {
      // Subscribes here — must already be subscribed before the light entity is
      // created, or the one-shot event is lost.
      this.listen<{ handle: unknown }>('light.created', (d) => {
        receivedHandle = d.handle;
      });
    }
    onUpdate(): void {}
  }

  async function makeLightModule(): Promise<ComponentModule> {
    return { LightComponent, LightSystem } as unknown as ComponentModule;
  }
  async function makeCasterModule(): Promise<ComponentModule> {
    return { CasterComponent, CasterSystem } as unknown as ComponentModule;
  }

  beforeEach(() => {
    receivedHandle = undefined;
  });

  it('delivers the one-shot event when the light entity is listed FIRST', async () => {
    const game = new ArcadeGame(new MockRendererAdapter());
    game.addComponentResolver('Light', makeLightModule);
    game.addComponentResolver('Caster', makeCasterModule);

    await game.loadScene({
      name: 'light-first',
      entities: {
        theLight: { components: { Light: {} } },
        theCard: { components: { Caster: {} } },
      },
    });

    expect(receivedHandle).toBe('LIGHT_HANDLE');
  });

  it('delivers the one-shot event when the light entity is listed LAST (order-independent)', async () => {
    const game = new ArcadeGame(new MockRendererAdapter());
    game.addComponentResolver('Light', makeLightModule);
    game.addComponentResolver('Caster', makeCasterModule);

    await game.loadScene({
      name: 'light-last',
      entities: {
        theCard: { components: { Caster: {} } },
        theLight: { components: { Light: {} } },
      },
    });

    expect(receivedHandle).toBe('LIGHT_HANDLE');
  });

  it('does NOT require a manual world.initialize() before loadScene', async () => {
    const game = new ArcadeGame(new MockRendererAdapter());
    game.addComponentResolver('Light', makeLightModule);
    game.addComponentResolver('Caster', makeCasterModule);

    // No game.world.initialize() here — the old workaround. The fix makes it
    // redundant.
    await game.loadScene({
      name: 'no-manual-init',
      entities: {
        theCard: { components: { Caster: {} } },
        theLight: { components: { Light: {} } },
      },
    });

    expect(game.world.initialized).toBe(true);
    expect(receivedHandle).toBe('LIGHT_HANDLE');
  });
});

describe('ArcadeGame — loadSceneFromUrl', () => {
  let renderer: MockRendererAdapter;
  let game: ArcadeGame;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
    game = new ArcadeGame(renderer);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the URL, parses JSON, and loads the scene', async () => {
    const sceneJson = {
      name: 'remote-scene',
      entities: { e1: { components: { Remote: {} } } },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sceneJson,
    });
    const resolver = vi.fn(async () => makeStubModule('Remote'));
    game.addComponentResolver('Remote', resolver);

    await game.loadSceneFromUrl('/scenes/remote.json');

    expect(fetchMock).toHaveBeenCalledWith('/scenes/remote.json');
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(game.sceneLoader.getComponentClass('Remote')).toBe(StubComponent);
  });

  it('throws when fetch returns a non-ok status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    await expect(game.loadSceneFromUrl('/scenes/missing.json')).rejects.toThrow(
      /failed to fetch scene.*404/,
    );
  });
});

describe('ArcadeGame — start / stop', () => {
  let renderer: MockRendererAdapter;
  let game: ArcadeGame;

  beforeEach(() => {
    renderer = new MockRendererAdapter();
    game = new ArcadeGame(renderer);
  });

  it('start() calls renderer.startLoop and stop() calls renderer.stopLoop', () => {
    game.start();
    expect(renderer.calls.some((c) => c.method === 'startLoop')).toBe(true);

    game.stop();
    expect(renderer.calls.some((c) => c.method === 'stopLoop')).toBe(true);
  });

  it('start() is idempotent — a second call does not start another loop', () => {
    game.start();
    game.start();
    const startCalls = renderer.calls.filter((c) => c.method === 'startLoop');
    expect(startCalls).toHaveLength(1);
  });

  it('stop() is a no-op when not running', () => {
    game.stop();
    expect(renderer.calls.some((c) => c.method === 'stopLoop')).toBe(false);
  });
});

describe('ArcadeGame — switching scenes', () => {
  const sceneWith = (name: string, entity: string) => ({
    name,
    entities: { [entity]: { components: { Stub: {} } } },
  });

  let game: ArcadeGame;

  beforeEach(() => {
    game = new ArcadeGame(new MockRendererAdapter(), {
      componentRegistry: { Stub: () => Promise.resolve(makeStubModule('Stub')) },
    });
  });

  it('replace: true tears the previous scene down so ids can be reused', async () => {
    // A second scene in a multigame arcade legitimately has its own `Sun`,
    // `Floor`, `Camera`… Without replace those collide with the first scene's.
    await game.loadScene(sceneWith('room', 'Sun'));
    await expect(game.loadScene(sceneWith('game', 'Sun'), { replace: true })).resolves.not.toThrow();
    expect(game.world.getEntity('Sun')).toBeDefined();
  });

  it('without replace, loading a colliding scene still throws (unchanged default)', async () => {
    await game.loadScene(sceneWith('room', 'Sun'));
    await expect(game.loadScene(sceneWith('game', 'Sun'))).rejects.toThrow(/already exists/i);
  });

  it('does not leave the previous scene’s entities behind', async () => {
    await game.loadScene(sceneWith('room', 'RoomOnly'));
    await game.loadScene(sceneWith('game', 'GameOnly'), { replace: true });
    expect(game.world.getEntity('RoomOnly')).toBeUndefined();
    expect(game.world.getEntity('GameOnly')).toBeDefined();
  });

  it('does not stack the previous scene’s systems under the new one', async () => {
    await game.loadScene(sceneWith('room', 'A'));
    const afterFirst = game.world.getSystems().length;
    await game.loadScene(sceneWith('game', 'B'), { replace: true });
    // Same scene shape, so the same number of systems — not double.
    expect(game.world.getSystems().length).toBe(afterFirst);
  });

  it('unloadScene empties the world on its own', async () => {
    await game.loadScene(sceneWith('room', 'Sun'));
    game.unloadScene();
    expect(game.world.getEntity('Sun')).toBeUndefined();
  });
});
