import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PlayerInputComponent,
  PlayerInputSystem,
  PlayerInputEvents,
  PlayerInputInputEvents,
} from './PlayerInput';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('PlayerInputComponent', () => {
  it('applies defaults', () => {
    const comp = new PlayerInputComponent();
    expect(comp.enabled).toBe(true);
    expect(comp.gamepadIndex).toBe(0);
    expect(comp.params.deadzone).toBe(0.15);
    expect(comp.params.keyBindings.jump).toContain('Space');
  });

  it('merges custom key bindings on top of defaults', () => {
    const comp = new PlayerInputComponent({
      keyBindings: { attack: ['KeyQ'] },
    });
    expect(comp.params.keyBindings.attack).toEqual(['KeyQ']);
    expect(comp.params.keyBindings.jump).toContain('Space');
  });

  it('serialize round-trips', () => {
    const original = new PlayerInputComponent({ deadzone: 0.3, gamepadIndex: 1 });
    const copy = new PlayerInputComponent(original.serialize());
    expect(copy.params.deadzone).toBe(0.3);
    expect(copy.gamepadIndex).toBe(1);
  });
});

describe('PlayerInputSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: PlayerInputSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new PlayerInputSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  afterEach(() => {
    world.destroy();
  });

  it('creates a core instance on entity add', () => {
    const entity = world.createEntity();
    const comp = new PlayerInputComponent();
    entity.add(comp);
    expect(comp.instance).not.toBeNull();
  });

  it('a keydown emits ACTION_PRESSED for the bound action', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent());
    const spy = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_PRESSED, spy);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    world.update(1 / 60);
    const jumpCall = spy.mock.calls.find((c) => c[0].action === 'jump');
    expect(jumpCall).toBeDefined();
    expect(jumpCall![0].entityId).toBe(entity.id);
  });

  it('WASD drives MOVE_CHANGED with a normalised vector', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent());
    const moves: Array<{ x: number; z: number }> = [];
    eventBus.on(PlayerInputEvents.MOVE_CHANGED, (e) => moves.push(e));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    world.update(1 / 60);
    const last = moves[moves.length - 1];
    expect(Math.hypot(last.x, last.z)).toBeCloseTo(1, 5);
  });

  it('SET_ENABLED false stops emitting actions', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent());
    eventBus.emit(PlayerInputInputEvents.SET_ENABLED, { enabled: false });
    const spy = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_PRESSED, spy);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    world.update(1 / 60);
    expect(spy).not.toHaveBeenCalled();
    void entity;
  });

  it('releasing all keys bound to an action emits ACTION_RELEASED once', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent());
    const released = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_RELEASED, released);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    world.update(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    world.update(1 / 60);
    const fwdRelease = released.mock.calls.find((c) => c[0].action === 'moveForward');
    expect(fwdRelease).toBeDefined();
    void entity;
  });

  it('is non-pauseable', () => {
    expect((system as unknown as { _pauseable: boolean })._pauseable).toBe(false);
  });

  it('onEntityAdded does not recreate an instance that already exists', () => {
    const entity = world.createEntity('player');
    const comp = new PlayerInputComponent();
    entity.add(comp);
    const first = comp.instance;
    expect(first).not.toBeNull();
    // Re-trigger ensureInstance via a second add of the same already-instanced comp.
    (system as unknown as { ensureInstance: (e: typeof entity) => void }).ensureInstance(entity);
    expect(comp.instance).toBe(first);
  });

  it('update() does not throw when navigator.getGamepads is unavailable', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent());
    expect(() => world.update(1 / 60)).not.toThrow();
  });
});

describe('PlayerInputSystem — onInitialize with a pre-existing entity', () => {
  it('ensures instances for entities present before initialize()', () => {
    const eventBus = new EventBus();
    const renderer = new MockRendererAdapter();
    const world = new World({ eventBus, renderer });
    const system = new PlayerInputSystem(eventBus);
    world.addSystem(system);
    const entity = world.createEntity('player');
    const comp = new PlayerInputComponent();
    entity.add(comp);
    world.initialize();
    expect(comp.instance).not.toBeNull();
    world.destroy();
  });
});

describe('PlayerInputSystem — gamepad polling', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: PlayerInputSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new PlayerInputSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  afterEach(() => {
    world.destroy();
    vi.unstubAllGlobals();
  });

  function stubGamepad(gp: unknown): void {
    vi.stubGlobal('navigator', { getGamepads: () => [gp] });
  }

  it('a pressed gamepad button emits ACTION_PRESSED jump with source gamepad', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0 }));
    stubGamepad({ buttons: [{ pressed: true }, { pressed: false }], axes: [0, 0] });
    const spy = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_PRESSED, spy);
    world.update(1 / 60);
    const jumpCall = spy.mock.calls.find((c) => c[0].action === 'jump');
    expect(jumpCall).toBeDefined();
    expect(jumpCall![0].source).toBe('gamepad');
    expect(jumpCall![0].entityId).toBe(entity.id);
  });

  it('gamepad axes drive MOVE_CHANGED', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0, deadzone: 0.1 }));
    void entity;
    stubGamepad({ buttons: [], axes: [0.5, -0.5] });
    const moves: Array<{ x: number; z: number }> = [];
    eventBus.on(PlayerInputEvents.MOVE_CHANGED, (e) => moves.push(e));
    world.update(1 / 60);
    const last = moves[moves.length - 1];
    expect(last.x).toBeCloseTo(0.5, 5);
    expect(last.z).toBeCloseTo(0.5, 5); // axis Y negated
  });

  it('a button released across two frames emits ACTION_RELEASED', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0 }));
    void entity;
    const gp = { buttons: [{ pressed: true }], axes: [0, 0] };
    stubGamepad(gp);
    world.update(1 / 60);
    const released = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_RELEASED, released);
    gp.buttons[0].pressed = false;
    world.update(1 / 60);
    const jumpRelease = released.mock.calls.find((c) => c[0].action === 'jump');
    expect(jumpRelease).toBeDefined();
  });

  it('an unchanged axis the second frame does not re-emit MOVE_CHANGED', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0, deadzone: 0.1 }));
    void entity;
    stubGamepad({ buttons: [], axes: [0.5, 0] });
    const moves: Array<{ x: number; z: number }> = [];
    eventBus.on(PlayerInputEvents.MOVE_CHANGED, (e) => moves.push(e));
    world.update(1 / 60);
    const countAfterFirst = moves.length;
    world.update(1 / 60);
    expect(moves.length).toBe(countAfterFirst);
  });

  it('skips a gamepad slot with no connected pad', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0 }));
    void entity;
    stubGamepad(null);
    expect(() => world.update(1 / 60)).not.toThrow();
  });

  it('skips polling a disabled player', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0, enabled: false }));
    void entity;
    stubGamepad({ buttons: [{ pressed: true }], axes: [0.5, 0.5] });
    const spy = vi.fn();
    eventBus.on(PlayerInputEvents.ACTION_PRESSED, spy);
    world.update(1 / 60);
    expect(spy).not.toHaveBeenCalled();
  });

  it('treats missing axes as zero (nullish fallback)', () => {
    const entity = world.createEntity('player');
    entity.add(new PlayerInputComponent({ gamepadIndex: 0 }));
    void entity;
    stubGamepad({ buttons: [], axes: [] });
    expect(() => world.update(1 / 60)).not.toThrow();
  });
});
