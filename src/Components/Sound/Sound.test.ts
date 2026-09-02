// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import type { CameraHandle, MeshHandle, SoundHandle } from '@babylonjsmarket/ecs/renderer-types';
import {
  ArcCameraEvents,
  FirstPersonCameraEvents,
  MeshEvents,
  MeshPrimitiveEvents,
  SoundEvents,
  SoundInputEvents,
} from '../../events';
import { SoundComponent, SoundSystem } from './Sound';

/** Let every queued microtask (initAudio, createSound) settle. */
const settle = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const mesh = (id: string) => ({ __mockHandle: `mesh:${id}` }) as unknown as MeshHandle;
const camera = (id: string) => ({ __mockHandle: `camera:${id}` }) as unknown as CameraHandle;

describe('SoundComponent', () => {
  it('defaults to an empty, autoplaying, flat one-shot', () => {
    const c = new SoundComponent();
    expect(c.src).toBe('');
    expect(c.loop).toBe(false);
    expect(c.autoplay).toBe(true);
    expect(c.volume).toBe(1);
    expect(c.spatial).toBe(false);
    expect(c.minDistance).toBe(1);
    expect(c.maxDistance).toBe(100);
    expect(c.rolloff).toBe(1);
    expect(c.distanceModel).toBe('inverse');
    expect(c.playing).toBeUndefined();
  });

  it('serialize round-trips through the constructor (playing only when set)', () => {
    const c = new SoundComponent({
      src: '/arcade/sounds/galaga.mp3',
      loop: true,
      autoplay: false,
      volume: 1.8,
      spatial: true,
      minDistance: 1,
      maxDistance: 3,
      rolloff: 3,
      distanceModel: 'exponential',
    });
    expect(new SoundComponent(c.serialize()).serialize()).toEqual(c.serialize());
    expect('playing' in c.serialize()).toBe(false);
    const live = new SoundComponent({ playing: false });
    expect(live.serialize().playing).toBe(false);
    expect(new SoundComponent(live.serialize()).playing).toBe(false);
  });

  it('toSpec carries the spatial block only for a positional sound', () => {
    expect(new SoundComponent({ src: 'a.mp3' }).toSpec()).toEqual({
      url: 'a.mp3',
      loop: false,
      autoplay: true,
      volume: 1,
    });
    expect(new SoundComponent({ src: 'a.mp3', spatial: true, rolloff: 3, maxDistance: 3 }).toSpec().spatial).toEqual({
      minDistance: 1,
      maxDistance: 3,
      rolloff: 3,
      distanceModel: 'inverse',
    });
  });
});

describe('SoundSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
  });
  afterEach(() => {
    // Shut the system down so its window listener never outlives the test.
    world.destroy();
    warn.mockRestore();
  });

  /** Make THIS renderer's engine answer `ok`, recording the call as the mock does. */
  const answerAudio = (ok: boolean) => {
    const r = renderer;
    r.initAudio = () => {
      r.calls.push({ method: 'initAudio', args: [] });
      return Promise.resolve(ok);
    };
  };

  const boot = async () => {
    world.addSystem(new SoundSystem(eventBus));
    world.initialize();
    await settle();
  };
  const calls = (m: string) => renderer.calls.filter((c) => c.method === m);
  const add = async (input = {}) => {
    const e = world.createEntity();
    e.add(new SoundComponent({ src: '/arcade/sounds/pacman.mp3', ...input }));
    await settle();
    return e;
  };

  it('brings the audio engine up once, before any clip', async () => {
    await boot();
    await add();
    await add();
    expect(calls('initAudio')).toHaveLength(1);
    expect(calls('createSound')).toHaveLength(2);
  });

  it('creates the clip from the component and emits READY', async () => {
    await boot();
    const ready = vi.fn();
    eventBus.on(SoundEvents.READY, ready);
    const e = await add({ loop: true, volume: 1.8, spatial: true, minDistance: 1, maxDistance: 3, rolloff: 3, distanceModel: 'exponential' });
    const [id, spec] = calls('createSound')[0].args;
    expect(id).toBe(e.id);
    expect(spec).toEqual({
      url: '/arcade/sounds/pacman.mp3',
      loop: true,
      autoplay: true,
      volume: 1.8,
      spatial: { minDistance: 1, maxDistance: 3, rolloff: 3, distanceModel: 'exponential' },
    });
    expect(ready).toHaveBeenCalledWith({ entityId: e.id, src: '/arcade/sounds/pacman.mp3' });
  });

  it('an empty src is a placeholder: no clip is created', async () => {
    await boot();
    await add({ src: '' });
    expect(calls('createSound')).toHaveLength(0);
  });

  it('does not recreate the clip on later frames', async () => {
    await boot();
    await add();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(calls('createSound')).toHaveLength(1);
  });

  it('records a failed load, emits ERROR, and never retries', async () => {
    await boot();
    const r = renderer;
    r.createSound = (id, spec) => {
      r.calls.push({ method: 'createSound', args: [id, spec] });
      return Promise.resolve(null);
    };
    const error = vi.fn();
    eventBus.on(SoundEvents.ERROR, error);
    const e = await add();
    world.update(1 / 60);
    world.update(1 / 60);
    expect(calls('createSound')).toHaveLength(1);
    expect(error).toHaveBeenCalledWith({ entityId: e.id, src: '/arcade/sounds/pacman.mp3' });
    // Nothing to drive: no handle, so no volume/play calls either.
    expect(calls('setSoundVolume')).toHaveLength(0);
  });

  describe('when the audio engine is unavailable', () => {
    beforeEach(() => {
      answerAudio(false);
    });

    it('warns exactly once, emits BLOCKED once, and creates nothing', async () => {
      const blocked = vi.fn();
      eventBus.on(SoundEvents.BLOCKED, blocked);
      await boot();
      await add();
      await add();
      world.update(1 / 60);
      world.update(1 / 60);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(blocked).toHaveBeenCalledTimes(1);
      expect(calls('createSound')).toHaveLength(0);
    });

    it('retries on the first user gesture and creates the waiting clips', async () => {
      await boot();
      const a = await add();
      const b = await add();
      expect(calls('createSound')).toHaveLength(0);
      // The gesture: the engine now says yes.
      answerAudio(true);
      window.dispatchEvent(new Event('pointerdown'));
      await settle();
      expect(calls('initAudio')).toHaveLength(2);
      expect(calls('createSound').map((c) => c.args[0])).toEqual([a.id, b.id]);
      // Once ready, further gestures do nothing.
      window.dispatchEvent(new Event('keydown'));
      await settle();
      expect(calls('initAudio')).toHaveLength(2);
      // Still only the one warning, however many refusals came before.
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a second refusal on retry stays quiet (no second warning)', async () => {
      await boot();
      window.dispatchEvent(new Event('keydown'));
      await settle();
      expect(calls('initAudio')).toHaveLength(2);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a gesture while a retry is still pending does not stack another', async () => {
      await boot();
      let resolve!: (ok: boolean) => void;
      const r = renderer;
      r.initAudio = () => {
        r.calls.push({ method: 'initAudio', args: [] });
        return new Promise<boolean>((res) => {
          resolve = res;
        });
      };
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('pointerdown'));
      expect(calls('initAudio')).toHaveLength(2);
      resolve(true);
      await settle();
    });
  });

  it('listens on the rendering canvas when the renderer has one', async () => {
    const canvas = document.createElement('canvas');
    await renderer.init(canvas);
    answerAudio(false);
    await boot();
    answerAudio(true);
    // A page-level click is not the canvas.
    window.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(calls('initAudio')).toHaveLength(1);
    canvas.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(calls('initAudio')).toHaveLength(2);
  });

  it('removes its gesture listeners on shutdown', async () => {
    answerAudio(false);
    const system = new SoundSystem(eventBus);
    world.addSystem(system);
    world.initialize();
    await settle();
    world.removeSystem(system);
    window.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(calls('initAudio')).toHaveLength(1);
    // Shutting down twice is harmless.
    system.shutdown();
  });

  it('attaches the audio listener to whichever camera announces itself', async () => {
    await boot();
    eventBus.emit(FirstPersonCameraEvents.CREATED, { entityId: 'player', handle: camera('fp') });
    expect(calls('attachAudioListener')).toHaveLength(1);
    expect(calls('attachAudioListener')[0].args[0]).toEqual(camera('fp'));
    eventBus.emit(ArcCameraEvents.CREATED, { entityId: 'orbit', handle: camera('arc'), alpha: 0, beta: 0, radius: 1, target: [0, 0, 0] });
    expect(calls('attachAudioListener')).toHaveLength(2);
    // A camera event with no handle is ignored, not thrown on.
    eventBus.emit(ArcCameraEvents.CREATED, { entityId: 'legacy' });
    expect(calls('attachAudioListener')).toHaveLength(2);
  });

  it('pins a spatial clip to its mesh once both exist (mesh first)', async () => {
    await boot();
    const e = world.createEntity();
    eventBus.emit(MeshEvents.LOADED, { entityId: e.id, meshId: e.id, animationNames: [], handle: mesh(e.id) });
    e.add(new SoundComponent({ src: 'loop.mp3', spatial: true }));
    await settle();
    expect(calls('attachSoundToMesh')).toHaveLength(1);
    expect(calls('attachSoundToMesh')[0].args[1]).toEqual(mesh(e.id));
  });

  it('pins a spatial clip once both exist (clip first), and only once', async () => {
    await boot();
    const e = await add({ spatial: true });
    expect(calls('attachSoundToMesh')).toHaveLength(0);
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: e.id, primitive: 'box', handle: mesh(e.id) });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: e.id, primitive: 'box', handle: mesh(e.id) });
    expect(calls('attachSoundToMesh')).toHaveLength(1);
    // Announcements for strangers, or without a handle, are ignored.
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: 'stranger', primitive: 'box', handle: mesh('stranger') });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: e.id, primitive: 'box' });
    expect(calls('attachSoundToMesh')).toHaveLength(1);
  });

  it('a flat (non-spatial) clip is never pinned', async () => {
    await boot();
    const e = await add({ spatial: false });
    eventBus.emit(MeshPrimitiveEvents.CREATED, { entityId: e.id, primitive: 'box', handle: mesh(e.id) });
    expect(calls('attachSoundToMesh')).toHaveLength(0);
  });

  it('pushes a volume change made from outside', async () => {
    await boot();
    const e = await add({ volume: 1 });
    world.update(1 / 60);
    expect(calls('setSoundVolume')).toHaveLength(0);
    e.get(SoundComponent)!.volume = 0.3;
    world.update(1 / 60);
    expect(calls('setSoundVolume')).toHaveLength(1);
    expect(calls('setSoundVolume')[0].args[1]).toBe(0.3);
  });

  it('drives play / stop off the `playing` field', async () => {
    await boot();
    const e = await add({ autoplay: true });
    const c = e.get(SoundComponent)!;
    c.playing = false;
    world.update(1 / 60);
    expect(calls('stopSound')).toHaveLength(1);
    c.playing = true;
    world.update(1 / 60);
    expect(calls('playSound')).toHaveLength(1);
    world.update(1 / 60);
    expect(calls('playSound')).toHaveLength(1);
  });

  it('honours an explicit `playing` that disagrees with autoplay at load', async () => {
    await boot();
    await add({ autoplay: true, playing: false });
    expect(calls('stopSound')).toHaveLength(1);
    await add({ autoplay: false, playing: true });
    expect(calls('playSound')).toHaveLength(1);
  });

  it('PLAY / STOP / SET_VOLUME input events drive the matching entity', async () => {
    await boot();
    const e = await add({ autoplay: true });
    eventBus.emit(SoundInputEvents.PLAY, { entityId: e.id });
    // Already playing: a PLAY still restarts from the top.
    expect(calls('playSound')).toHaveLength(1);
    eventBus.emit(SoundInputEvents.STOP, { entityId: e.id });
    expect(calls('stopSound')).toHaveLength(1);
    expect(e.get(SoundComponent)!.playing).toBe(false);
    eventBus.emit(SoundInputEvents.SET_VOLUME, { entityId: e.id, volume: 0.12 });
    world.update(1 / 60);
    expect(calls('setSoundVolume').at(-1)!.args[1]).toBe(0.12);
    // Bad payloads are ignored.
    eventBus.emit(SoundInputEvents.SET_VOLUME, { entityId: e.id, volume: 'loud' });
    eventBus.emit(SoundInputEvents.PLAY, { entityId: 'nobody' });
    eventBus.emit(SoundInputEvents.STOP, {});
    eventBus.emit(SoundInputEvents.SET_VOLUME, { entityId: 'nobody', volume: 1 });
    world.update(1 / 60);
    expect(calls('playSound')).toHaveLength(1);
    expect(calls('stopSound')).toHaveLength(1);
  });

  it('PLAY / STOP before the clip has landed only set the intent', async () => {
    answerAudio(false);
    await boot();
    const e = await add();
    eventBus.emit(SoundInputEvents.PLAY, { entityId: e.id });
    eventBus.emit(SoundInputEvents.STOP, { entityId: e.id });
    expect(calls('playSound')).toHaveLength(0);
    expect(calls('stopSound')).toHaveLength(0);
    expect(e.get(SoundComponent)!.playing).toBe(false);
  });

  it('disposes the clip when the entity is destroyed', async () => {
    await boot();
    const e = await add();
    world.removeEntity(e);
    expect(calls('disposeSound')).toHaveLength(1);
  });

  it('releases a clip that lands after its entity was destroyed', async () => {
    await boot();
    let resolve!: (h: SoundHandle | null) => void;
    const r = renderer;
    r.createSound = (id, spec) => {
      r.calls.push({ method: 'createSound', args: [id, spec] });
      return new Promise<SoundHandle | null>((res) => {
        resolve = res;
      });
    };
    const e = world.createEntity();
    e.add(new SoundComponent({ src: 'late.mp3' }));
    await settle();
    world.removeEntity(e);
    expect(calls('disposeSound')).toHaveLength(0);
    resolve({ __mockHandle: 'sound:late' } as unknown as SoundHandle);
    await settle();
    expect(calls('disposeSound')).toHaveLength(1);
  });

  it('is park-aware: a pooled entity keeps its clip, silenced, and resumes on re-acquire', async () => {
    await boot();
    world.registerPool('cab', {
      size: 1,
      build: (e) => e.add(new SoundComponent({ src: 'loop.mp3', loop: true })),
    });
    await settle();
    expect(calls('createSound')).toHaveLength(1);
    // Building the pool parks the slot before the clip has even landed: the
    // clip is silenced when it does, and kept — not disposed.
    expect(calls('stopSound')).toHaveLength(1);
    expect(calls('disposeSound')).toHaveLength(0);
    const e = world.acquire('cab')!;
    await settle();
    expect(calls('playSound')).toHaveLength(1);
    expect(calls('createSound')).toHaveLength(1);
    // Park again, then re-acquire with playing forced off: no play.
    world.removeEntity(e);
    expect(calls('stopSound')).toHaveLength(2);
    e.get(SoundComponent)!.playing = false;
    world.acquire('cab');
    expect(calls('playSound')).toHaveLength(1);
  });

  it('creates clips for entities that already existed before initialize', async () => {
    const e = world.createEntity();
    e.add(new SoundComponent({ src: 'bed.mp3' }));
    await boot();
    expect(calls('createSound')).toHaveLength(1);
    expect(calls('createSound')[0].args[0]).toBe(e.id);
  });

  it('stays inert when the world has no renderer', async () => {
    const bus = new EventBus();
    const w = new World({ eventBus: bus, detectRaces: false });
    w.addSystem(new SoundSystem(bus));
    w.initialize();
    await settle();
    const e = w.createEntity();
    expect(() => {
      e.add(new SoundComponent({ src: 'a.mp3' }));
      w.update(1 / 60);
      bus.emit(FirstPersonCameraEvents.CREATED, { entityId: 'p', handle: camera('fp') });
      window.dispatchEvent(new Event('pointerdown'));
      w.removeEntity(e);
    }).not.toThrow();
    await settle();
    w.destroy();
  });
});
