import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { NeonSignEvents } from '../../events';
import {
  NEON_TEXT_EXTENSION,
  NeonSignComponent,
  NeonSignSystem,
  type NeonTextExtension,
  type NeonTextSpec,
} from './NeonSign';

/** Flush the microtasks a plugin `create` resolves through. */
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('NeonSignComponent', () => {
  it('defaults to hot pink with a point-light glow, a flat quad, and the neon font', () => {
    const c = new NeonSignComponent();
    expect(c.color).toEqual([1, 0.15, 0.55]);
    expect(c.glow).toBeGreaterThan(0);
    expect(c.lightKind).toBe('point');
    expect(c.spotAngle).toBeCloseTo(Math.PI * 0.95, 10);
    expect(c.spotExponent).toBe(2);
    expect(c.extruded).toBe(false);
    expect(c.depth).toBe(0.08);
    expect(c.fontUrl).toBe('/fonts/neon.json');
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

  it('aims a spot along the facing and 0.4 down', () => {
    const c = new NeonSignComponent({ rotation: [0, Math.PI / 2, 0] });
    const d = c.spotDirection();
    const len = Math.hypot(1, 0.4);
    expect(d[0]).toBeCloseTo(1 / len, 10);
    expect(d[1]).toBeCloseTo(-0.4 / len, 10);
    expect(d[2]).toBeCloseTo(0, 10);
  });

  it('serialize round-trips, new fields included', () => {
    const c = new NeonSignComponent({
      text: "BJ's Arcade",
      color: [0.1, 0.9, 1],
      size: 0.6,
      lightKind: 'spot',
      spotAngle: 2.5,
      spotExponent: 1,
      extruded: true,
      depth: 0.05,
      fontUrl: '/fonts/other.json',
    });
    const out = c.serialize();
    expect(out).toMatchObject({ lightKind: 'spot', spotAngle: 2.5, spotExponent: 1, extruded: true, depth: 0.05, fontUrl: '/fonts/other.json' });
    expect(new NeonSignComponent(out).serialize()).toEqual(out);
  });
});

describe('NeonSignSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  const calls = (method: string) => renderer.calls.filter((c) => c.method === method);

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
    const call = calls('createLabel')[0];
    const spec = call.args[1] as { text: string; billboard: boolean; rotation: number[] };
    expect(spec.text).toBe("BJ's Arcade");
    expect(spec.billboard).toBe(false);
    expect(spec.rotation).toEqual([0, Math.PI, 0]);
  });

  it('gives the sign a light of the SAME colour as its lettering', () => {
    sign({ color: [0.15, 0.9, 1] });
    const label = calls('createLabel')[0];
    const light = calls('createPointLight')[0];
    expect((label.args[1] as { color: number[] }).color).toEqual([0.15, 0.9, 1]);
    expect((light.args[1] as { diffuse: number[] }).diffuse).toEqual([0.15, 0.9, 1]);
  });

  it('lightKind "spot" throws a cone from in front of the sign, aimed along its facing and tilted down', () => {
    const e = sign({
      position: [-5.86, 1.95, -3.8],
      rotation: [0, Math.PI / 2, 0],
      glowOffset: 0.4,
      color: [1, 0.15, 0.55],
      glow: 3,
      range: 10,
      lightKind: 'spot',
      spotAngle: Math.PI * 0.95,
      spotExponent: 2,
    });
    expect(calls('createPointLight')).toHaveLength(0);
    const spot = calls('createSpotLight')[0];
    expect(spot.args[0]).toBe(`${e.id}_glow`);
    const spec = spot.args[1] as {
      position: number[]; direction: number[]; angle: number; exponent: number;
      intensity: number; diffuse: number[]; specular: number[]; range: number;
    };
    expect(spec.position[0]).toBeCloseTo(-5.46, 5); // 0.4 m off the wall, into the room
    expect(spec.position[1]).toBeCloseTo(1.95, 5);
    const len = Math.hypot(1, 0.4);
    expect(spec.direction[0]).toBeCloseTo(1 / len, 5);
    expect(spec.direction[1]).toBeCloseTo(-0.4 / len, 5);
    expect(spec.angle).toBeCloseTo(Math.PI * 0.95, 10);
    expect(spec.exponent).toBe(2);
    expect(spec.intensity).toBe(3);
    expect(spec.diffuse).toEqual([1, 0.15, 0.55]);
    expect(spec.specular).toEqual([0, 0, 0]);
    expect(spec.range).toBe(10);
  });

  it('glow 0 makes a tube-only sign — no light added to the budget', () => {
    sign({ glow: 0 });
    expect(calls('createPointLight')).toHaveLength(0);
    expect(calls('createSpotLight')).toHaveLength(0);
    expect(calls('createLabel')).toHaveLength(1);
  });

  it('emits CREATED once, and does not rebuild on later frames', () => {
    const spy = vi.fn();
    eventBus.on(NeonSignEvents.CREATED, spy);
    sign();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(calls('createLabel')).toHaveLength(1);
  });

  it('re-letters the sign when its text changes', () => {
    const e = sign({ text: 'OPEN' });
    const spy = vi.fn();
    eventBus.on(NeonSignEvents.TEXT_CHANGED, spy);
    e.get(NeonSignComponent)!.text = 'CLOSED';
    world.update(1 / 60);
    // New text is new geometry: the old label goes, a fresh one is rasterised.
    expect(calls('disposeLabel')).toHaveLength(1);
    expect((calls('createLabel').at(-1)!.args[1] as { text: string }).text).toBe('CLOSED');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ entityId: e.id, text: 'CLOSED' });
  });

  it('stays quiet while nothing changes', () => {
    sign();
    renderer.calls.length = 0;
    world.update(1 / 60);
    world.update(1 / 60);
    expect(renderer.calls).toHaveLength(0);
  });

  describe('live edits', () => {
    it('recolours lettering AND light together, and says so', () => {
      const e = sign({ color: [1, 0.15, 0.55] });
      const spy = vi.fn();
      eventBus.on(NeonSignEvents.COLOR_CHANGED, spy);
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.color = [0.15, 0.9, 1];
      world.update(1 / 60);
      expect(calls('setLabelColor')[0].args.slice(1)).toEqual([0.15, 0.9, 1]);
      expect(calls('setLightColor')[0].args.slice(1)).toEqual([0.15, 0.9, 1]);
      expect(calls('createLabel')).toHaveLength(0); // a recolour is not a rebuild
      expect(spy).toHaveBeenCalledWith({ entityId: e.id, color: [0.15, 0.9, 1] });
    });

    it('moves the label and the light when the sign is moved', () => {
      const e = sign({ position: [0, 2, -5], glowOffset: 0.4 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.position = [1, 2.5, -5];
      world.update(1 / 60);
      expect(calls('setLabelPosition')[0].args.slice(1)).toEqual([1, 2.5, -5]);
      const light = calls('setLightPosition')[0].args.slice(1) as number[];
      expect(light[0]).toBeCloseTo(1, 5);
      expect(light[2]).toBeCloseTo(-4.6, 5);
      expect(calls('createLabel')).toHaveLength(0);
    });

    it('a turned sign rebuilds its label (no label rotate) and re-aims its spot', () => {
      const e = sign({ rotation: [0, 0, 0], lightKind: 'spot' });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.rotation = [0, Math.PI / 2, 0];
      world.update(1 / 60);
      expect(calls('disposeLabel')).toHaveLength(1);
      expect((calls('createLabel')[0].args[1] as { rotation: number[] }).rotation).toEqual([0, Math.PI / 2, 0]);
      const dir = calls('setLightDirection')[0].args.slice(1) as number[];
      expect(dir[0]).toBeCloseTo(1 / Math.hypot(1, 0.4), 5);
      expect(calls('setLightPosition')).toHaveLength(1);
      expect(calls('createSpotLight')).toHaveLength(0);
    });

    it('a resized sign re-rasterises at the new scale', () => {
      const e = sign({ size: 0.4 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.size = 0.8;
      world.update(1 / 60);
      expect((calls('createLabel')[0].args[1] as { scale: number }).scale).toBe(0.8);
    });

    it('a glow change retunes the light in place', () => {
      const e = sign({ glow: 3 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.glow = 6;
      world.update(1 / 60);
      expect(calls('updateLightIntensity')[0].args[1]).toBe(6);
      expect(calls('createPointLight')).toHaveLength(0);
    });

    it('glow to 0 removes the light; back above 0 brings it back', () => {
      const e = sign({ glow: 3 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.glow = 0;
      world.update(1 / 60);
      expect(calls('disposeLight')).toHaveLength(1);
      e.get(NeonSignComponent)!.glow = 2;
      world.update(1 / 60);
      expect(calls('createPointLight')).toHaveLength(1);
      expect((calls('createPointLight')[0].args[1] as { intensity: number }).intensity).toBe(2);
    });

    it('switching lightKind swaps the light; a range or cone change rebuilds it too', () => {
      const e = sign({ lightKind: 'point', range: 7 });
      renderer.calls.length = 0;
      const c = e.get(NeonSignComponent)!;
      c.lightKind = 'spot';
      world.update(1 / 60);
      expect(calls('disposeLight')).toHaveLength(1);
      expect(calls('createSpotLight')).toHaveLength(1);
      c.range = 12;
      world.update(1 / 60);
      expect(calls('createSpotLight')).toHaveLength(2);
      expect((calls('createSpotLight')[1].args[1] as { range: number }).range).toBe(12);
      c.spotAngle = 1;
      world.update(1 / 60);
      expect(calls('createSpotLight')).toHaveLength(3);
      c.spotExponent = 5;
      world.update(1 / 60);
      expect(calls('createSpotLight')).toHaveLength(4);
      expect(calls('disposeLight')).toHaveLength(4);
    });

    it('a glowOffset change moves the light, not the lettering', () => {
      const e = sign({ glowOffset: 0.35 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.glowOffset = 1;
      world.update(1 / 60);
      expect(calls('setLightPosition')).toHaveLength(1);
      expect(calls('setLabelPosition')).toHaveLength(0);
    });

    it('a fontSize or fontUrl change rebuilds the lettering', () => {
      const e = sign({ fontSize: 96 });
      renderer.calls.length = 0;
      e.get(NeonSignComponent)!.fontSize = 128;
      world.update(1 / 60);
      expect(calls('createLabel')).toHaveLength(1);
      e.get(NeonSignComponent)!.fontUrl = '/fonts/other.json';
      world.update(1 / 60);
      expect(calls('createLabel')).toHaveLength(2);
    });
  });

  it('disposes both halves when the sign goes away', () => {
    const e = sign();
    world.removeEntity(e.id);
    world.update(1 / 60);
    expect(calls('disposeLabel')).toHaveLength(1);
    expect(calls('disposeLight')).toHaveLength(1);
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
    e.get(NeonSignComponent)!.text = 'Y';
    expect(() => w.update(1 / 60)).not.toThrow();
    expect(() => w.removeEntity(e.id)).not.toThrow();
  });
});

describe('NeonSignSystem — extruded lettering', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  const calls = (method: string) => renderer.calls.filter((c) => c.method === method);

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new NeonSignSystem(eventBus));
    world.initialize();
  });

  /** A recording plugin whose `create` resolves to what the test decides. */
  function fakePlugin(result: string | null | Error = 'mesh') {
    const created: { id: string; spec: NeonTextSpec }[] = [];
    const colours: { id: string; color: number[]; intensity: number }[] = [];
    const disposed: string[] = [];
    const ext: NeonTextExtension & { result: string | null | Error } = {
      result,
      create: vi.fn(async (id: string, spec: NeonTextSpec) => {
        created.push({ id, spec });
        if (ext.result instanceof Error) throw ext.result;
        return ext.result;
      }),
      setColor: vi.fn((id: string, color: [number, number, number], intensity: number) => {
        colours.push({ id, color, intensity });
      }),
      dispose: vi.fn((id: string) => {
        disposed.push(id);
      }),
    };
    renderer.registerExtension(NEON_TEXT_EXTENSION, ext);
    return { ext, created, colours, disposed };
  }

  const extrudedSign = (input = {}) => {
    const e = world.createEntity();
    e.add(new NeonSignComponent({ text: 'PLAY', extruded: true, ...input }));
    world.update(1 / 60);
    return e;
  };

  it('with NO plugin registered, an extruded sign quietly draws the label quad', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const extruded = vi.fn();
    eventBus.on(NeonSignEvents.EXTRUDED, extruded);
    extrudedSign();
    world.update(1 / 60);
    expect(calls('createLabel')).toHaveLength(1);
    expect(extruded).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled(); // silent by design — the quad IS the sign
    warn.mockRestore();
  });

  it('with the plugin, builds the slab from the sign’s fields and emits EXTRUDED', async () => {
    const { created } = fakePlugin('Neon_neonText');
    const extruded = vi.fn();
    eventBus.on(NeonSignEvents.EXTRUDED, extruded);
    const e = extrudedSign({
      color: [0.75, 0.3, 1],
      position: [5.86, 2.75, 0],
      rotation: [0, -Math.PI / 2, 0],
      size: 0.4,
      depth: 0.088,
      glow: 3,
      fontUrl: '/fonts/neon.json',
    });
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(e.id);
    expect(created[0].spec).toEqual({
      text: 'PLAY',
      fontUrl: '/fonts/neon.json',
      size: 0.4,
      depth: 0.088,
      position: [5.86, 2.75, 0],
      rotation: [0, -Math.PI / 2, 0],
      color: [0.75, 0.3, 1],
      intensity: 3,
    });
    expect(calls('createLabel')).toHaveLength(0); // real geometry, no quad
    expect(extruded).toHaveBeenCalledWith({ entityId: e.id, text: 'PLAY' });
  });

  it('the tube is never dimmer than lit: glow 0 still extrudes at intensity 1', async () => {
    const { created } = fakePlugin();
    extrudedSign({ glow: 0 });
    await flush();
    expect(created[0].spec.intensity).toBe(1);
  });

  it('falls back to the label when the plugin cannot build (null), and when it rejects', async () => {
    const plugin = fakePlugin(null);
    const extruded = vi.fn();
    eventBus.on(NeonSignEvents.EXTRUDED, extruded);
    extrudedSign();
    await flush();
    expect(calls('createLabel')).toHaveLength(1);
    expect(extruded).not.toHaveBeenCalled();

    plugin.ext.result = new Error('font exploded');
    extrudedSign({ text: 'ENTER' });
    await flush();
    expect(calls('createLabel')).toHaveLength(2);
    expect(extruded).not.toHaveBeenCalled();
  });

  it('a recolour or glow change on a live slab goes through setColor, not a rebuild', async () => {
    const { ext, colours } = fakePlugin();
    const e = extrudedSign({ color: [1, 0.15, 0.55], glow: 3 });
    await flush();
    const c = e.get(NeonSignComponent)!;
    c.color = [0.15, 0.9, 1];
    world.update(1 / 60);
    expect(colours).toEqual([{ id: e.id, color: [0.15, 0.9, 1], intensity: 3 }]);
    c.glow = 6;
    world.update(1 / 60);
    expect(colours.at(-1)).toEqual({ id: e.id, color: [0.15, 0.9, 1], intensity: 6 });
    expect(ext.create).toHaveBeenCalledTimes(1);
  });

  it('new text, size, depth or a move re-extrudes the slab', async () => {
    const { ext, disposed } = fakePlugin();
    const e = extrudedSign();
    await flush();
    const c = e.get(NeonSignComponent)!;
    c.text = 'WIN';
    world.update(1 / 60);
    await flush();
    expect(ext.create).toHaveBeenCalledTimes(2);
    expect(disposed).toEqual([e.id, e.id]); // the first build's clean-up, then the rebuild's
    c.depth = 0.2;
    world.update(1 / 60);
    await flush();
    expect(ext.create).toHaveBeenCalledTimes(3);
    c.position = [1, 2, 3];
    world.update(1 / 60);
    await flush();
    expect(ext.create).toHaveBeenCalledTimes(4);
    expect(calls('createLabel')).toHaveLength(0);
  });

  it('turning extruded off swaps the slab for the quad, and on again swaps back', async () => {
    const { ext } = fakePlugin();
    const e = extrudedSign();
    await flush();
    const c = e.get(NeonSignComponent)!;
    c.extruded = false;
    world.update(1 / 60);
    expect(calls('createLabel')).toHaveLength(1);
    c.extruded = true;
    world.update(1 / 60);
    await flush();
    expect(calls('disposeLabel')).toHaveLength(1);
    expect(ext.create).toHaveBeenCalledTimes(2);
  });

  it('a build that lands after the sign was rebuilt is dropped', async () => {
    let release!: (v: string | null) => void;
    const first = new Promise<string | null>((r) => (release = r));
    const ext: NeonTextExtension = {
      create: vi.fn()
        .mockReturnValueOnce(first)
        .mockResolvedValue('mesh'),
      setColor: vi.fn(),
      dispose: vi.fn(),
    };
    renderer.registerExtension(NEON_TEXT_EXTENSION, ext);
    const extruded = vi.fn();
    eventBus.on(NeonSignEvents.EXTRUDED, extruded);
    const e = extrudedSign();
    e.get(NeonSignComponent)!.text = 'ENTER'; // rebuild while the first is in flight
    world.update(1 / 60);
    await flush();
    expect(extruded).toHaveBeenCalledTimes(1); // the second build
    release(null); // the stale first build resolves as "couldn't" …
    await flush();
    expect(calls('createLabel')).toHaveLength(0); // … and must NOT put up a quad
    expect(extruded).toHaveBeenCalledTimes(1);
  });

  it('a build that lands after the sign was removed is dropped, and a rejection too', async () => {
    let release!: (v: string | null) => void;
    let reject!: (e: Error) => void;
    const pending = new Promise<string | null>((r, j) => {
      release = r;
      reject = j;
    });
    const ext: NeonTextExtension = {
      create: vi.fn().mockReturnValue(pending),
      setColor: vi.fn(),
      dispose: vi.fn(),
    };
    renderer.registerExtension(NEON_TEXT_EXTENSION, ext);
    const extruded = vi.fn();
    eventBus.on(NeonSignEvents.EXTRUDED, extruded);
    const e = extrudedSign();
    world.removeEntity(e.id);
    expect(ext.dispose).toHaveBeenCalledWith(e.id); // cancels the in-flight build
    release('mesh');
    await flush();
    expect(extruded).not.toHaveBeenCalled();
    expect(calls('createLabel')).toHaveLength(0);

    const f = extrudedSign({ text: 'TWO' });
    world.removeEntity(f.id);
    reject(new Error('late'));
    await flush();
    expect(calls('createLabel')).toHaveLength(0);
  });

  it('removing an extruded sign disposes the slab through the plugin and the light', async () => {
    const { disposed } = fakePlugin();
    const e = extrudedSign();
    await flush();
    world.removeEntity(e.id);
    expect(disposed).toContain(e.id);
    expect(calls('disposeLight')).toHaveLength(1);
    expect(calls('disposeLabel')).toHaveLength(0);
  });
});
