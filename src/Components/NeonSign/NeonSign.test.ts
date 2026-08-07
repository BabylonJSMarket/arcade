import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { NeonSignEvents } from '../../events';
import { NeonSignComponent, NeonSignSystem } from './NeonSign';

describe('NeonSignComponent', () => {
  it('defaults to hot pink with a glow', () => {
    const c = new NeonSignComponent();
    expect(c.color).toEqual([1, 0.15, 0.55]);
    expect(c.glow).toBeGreaterThan(0);
  });

  it('puts the glow in FRONT of a sign facing +Z', () => {
    const c = new NeonSignComponent({ position: [0, 2.5, -5], rotation: [0, 0, 0], glowOffset: 0.4 });
    const g = c.glowPosition();
    expect(g[0]).toBeCloseTo(0, 5);
    expect(g[1]).toBeCloseTo(2.5, 5);
    expect(g[2]).toBeCloseTo(-4.6, 5); // +Z of the wall, i.e. into the room
  });

  it('follows the sign’s facing when it is on a side wall', () => {
    const c = new NeonSignComponent({
      position: [-6, 2.5, 0],
      rotation: [0, Math.PI / 2, 0],
      glowOffset: 0.5,
    });
    const g = c.glowPosition();
    expect(g[0]).toBeCloseTo(-5.5, 5); // pushed along +X, into the room
    expect(g[2]).toBeCloseTo(0, 5);
  });

  it('serialize round-trips', () => {
    const c = new NeonSignComponent({ text: "BJ's Arcade", color: [0.1, 0.9, 1], size: 0.6 });
    expect(new NeonSignComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });
});

describe('NeonSignSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new NeonSignSystem(eventBus));
    world.initialize();
  });

  const sign = (input = {}) => {
    const e = world.createEntity();
    e.add(new NeonSignComponent({ text: "BJ's Arcade", ...input }));
    world.update(1 / 60);
    return e;
  };

  it('draws the words as a WORLD-FIXED label, not a billboard', () => {
    // A sign screwed to a wall must not swivel to follow the camera.
    sign({ rotation: [0, Math.PI, 0] });
    const call = renderer.calls.find((c) => c.method === 'createLabel')!;
    const spec = call.args[1] as { text: string; billboard: boolean; rotation: number[] };
    expect(spec.text).toBe("BJ's Arcade");
    expect(spec.billboard).toBe(false);
    expect(spec.rotation).toEqual([0, Math.PI, 0]);
  });

  it('gives the sign a light of the SAME colour as its lettering', () => {
    sign({ color: [0.15, 0.9, 1] });
    const label = renderer.calls.find((c) => c.method === 'createLabel')!;
    const light = renderer.calls.find((c) => c.method === 'createPointLight')!;
    expect((label.args[1] as { color: number[] }).color).toEqual([0.15, 0.9, 1]);
    expect((light.args[1] as { diffuse: number[] }).diffuse).toEqual([0.15, 0.9, 1]);
  });

  it('glow 0 makes a tube-only sign — no light added to the budget', () => {
    sign({ glow: 0 });
    expect(renderer.calls.some((c) => c.method === 'createPointLight')).toBe(false);
    expect(renderer.calls.some((c) => c.method === 'createLabel')).toBe(true);
  });

  it('emits CREATED once, and does not rebuild on later frames', () => {
    const spy = vi.fn();
    eventBus.on(NeonSignEvents.CREATED, spy);
    sign();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(renderer.calls.filter((c) => c.method === 'createLabel')).toHaveLength(1);
  });

  it('re-letters the sign when its text changes', () => {
    const e = sign({ text: 'OPEN' });
    const spy = vi.fn();
    eventBus.on(NeonSignEvents.TEXT_CHANGED, spy);
    e.get(NeonSignComponent)!.text = 'CLOSED';
    world.update(1 / 60);
    const call = renderer.calls.filter((c) => c.method === 'setLabelText').at(-1)!;
    expect(call.args[1]).toBe('CLOSED');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stays quiet while the text is unchanged', () => {
    sign();
    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'setLabelText')).toBe(false);
  });

  it('disposes both halves when the sign goes away', () => {
    const e = sign();
    world.removeEntity(e.id);
    world.update(1 / 60);
    expect(renderer.calls.some((c) => c.method === 'disposeLabel')).toBe(true);
    expect(renderer.calls.some((c) => c.method === 'disposeLight')).toBe(true);
  });

  it('builds signs that existed before the world was initialized', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    const e = w.createEntity();
    e.add(new NeonSignComponent({ text: 'PLAY' }));
    w.addSystem(new NeonSignSystem(bus));
    w.initialize();
    expect(r.calls.filter((c) => c.method === 'createLabel')).toHaveLength(1);
    expect(e.get(NeonSignComponent)!.text).toBe('PLAY');
  });

  it('stays inert with no renderer', () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new NeonSignSystem(bus));
    w.initialize();
    const e = w.createEntity();
    e.add(new NeonSignComponent({ text: 'X' }));
    expect(() => { w.update(1 / 60); w.update(1 / 60); }).not.toThrow();
  });
});
