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
});
