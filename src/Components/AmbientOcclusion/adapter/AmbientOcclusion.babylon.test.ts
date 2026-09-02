import { beforeEach, describe, expect, it, vi } from 'vitest';

// The plugin is the one file allowed to import the engine; the test swaps
// that engine for a recording double so no WebGL is needed. `vi.hoisted`
// because `vi.mock` is lifted above every import — the fakes must be too.
const { FakeObservable, FakePipeline, support } = vi.hoisted(() => {
  const support = { isSupported: true };
  class FakeObservable<T> {
    observers: ((v: T) => void)[] = [];
    add(cb: (v: T) => void) {
      this.observers.push(cb);
      return cb;
    }
    remove(cb: (v: T) => void) {
      this.observers = this.observers.filter((o) => o !== cb);
      return true;
    }
    notify(v: T) {
      for (const o of [...this.observers]) o(v);
    }
  }
  class FakePipeline {
    static get IsSupported() {
      return support.isSupported;
    }
    static instances: FakePipeline[] = [];
    radius = 0;
    totalStrength = 0;
    samples = 0;
    maxZ = 0;
    base = 0;
    expensiveBlur = false;
    disposed = false;
    constructor(
      public name: string,
      public scene: unknown,
      public ratio: unknown,
      public cameras: unknown[],
    ) {
      FakePipeline.instances.push(this);
    }
    dispose() {
      this.disposed = true;
    }
  }
  return { FakeObservable, FakePipeline, support };
});
vi.mock('@babylonjs/core', () => ({ SSAO2RenderingPipeline: FakePipeline }));

import { createBabylonAmbientOcclusion, SSAO_PIPELINE_NAME } from './AmbientOcclusion.babylon';
import { registerBabylonAmbientOcclusionExtension } from './register';
import { AMBIENT_OCCLUSION_EXTENSION, type AmbientOcclusionExtension } from '../AmbientOcclusion.core';

const ROOM = { radius: 0.8, strength: 1.0, samples: 8, maxZ: 40, base: 0.1, blurRatio: 1.0, ssaoRatio: 0.5 };

function fakeScene() {
  const attach = vi.fn();
  const detach = vi.fn();
  const scene = {
    activeCamera: null as { id: string } | null,
    onActiveCameraChanged: new FakeObservable<unknown>(),
    postProcessRenderPipelineManager: {
      attachCamerasToRenderPipeline: attach,
      detachCamerasFromRenderPipeline: detach,
    },
  };
  return { scene, attach, detach };
}

describe('createBabylonAmbientOcclusion — drives an SSAO2 pipeline on the scene', () => {
  beforeEach(() => {
    support.isSupported = true;
    FakePipeline.instances = [];
  });

  it('builds the pipeline with the ratios, tunes it, and attaches the active camera', () => {
    const { scene, attach } = fakeScene();
    const cam = { id: 'fp' };
    scene.activeCamera = cam;
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    expect(ext.apply(ROOM)).toBe(true);
    const p = FakePipeline.instances[0];
    expect(p.name).toBe(SSAO_PIPELINE_NAME);
    expect(p.scene).toBe(scene);
    expect(p.ratio).toEqual({ ssaoRatio: 0.5, blurRatio: 1.0 });
    expect(p.cameras).toEqual([]);
    expect(p.radius).toBe(0.8);
    expect(p.totalStrength).toBe(1.0);
    expect(p.samples).toBe(8);
    expect(p.maxZ).toBe(40);
    expect(p.base).toBe(0.1);
    expect(p.expensiveBlur).toBe(true);
    expect(attach).toHaveBeenCalledWith(SSAO_PIPELINE_NAME, cam);
  });

  it('with no active camera yet, attaches when one arrives', () => {
    const { scene, attach, detach } = fakeScene();
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    ext.apply(ROOM);
    expect(attach).not.toHaveBeenCalled();
    const cam = { id: 'fp' };
    scene.activeCamera = cam;
    scene.onActiveCameraChanged.notify(scene);
    expect(attach).toHaveBeenCalledWith(SSAO_PIPELINE_NAME, cam);
    expect(detach).not.toHaveBeenCalled();
    // The same camera again is a no-op.
    scene.onActiveCameraChanged.notify(scene);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('re-attaches when the active camera changes (a scene reload)', () => {
    const { scene, attach, detach } = fakeScene();
    const a = { id: 'a' };
    const b = { id: 'b' };
    scene.activeCamera = a;
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    ext.apply(ROOM);
    scene.activeCamera = b;
    scene.onActiveCameraChanged.notify(scene);
    expect(detach).toHaveBeenCalledWith(SSAO_PIPELINE_NAME, a);
    expect(attach).toHaveBeenLastCalledWith(SSAO_PIPELINE_NAME, b);
    // Camera cleared: detach, attach nothing.
    scene.activeCamera = null;
    scene.onActiveCameraChanged.notify(scene);
    expect(detach).toHaveBeenLastCalledWith(SSAO_PIPELINE_NAME, b);
    expect(attach).toHaveBeenCalledTimes(2);
  });

  it('retunes in place for a non-ratio change, rebuilds for a ratio change', () => {
    const { scene } = fakeScene();
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    ext.apply(ROOM);
    ext.apply({ ...ROOM, radius: 2 });
    expect(FakePipeline.instances).toHaveLength(1);
    expect(FakePipeline.instances[0].radius).toBe(2);
    ext.apply({ ...ROOM, ssaoRatio: 1 });
    expect(FakePipeline.instances).toHaveLength(2);
    expect(FakePipeline.instances[0].disposed).toBe(true);
    expect(FakePipeline.instances[1].ratio).toEqual({ ssaoRatio: 1, blurRatio: 1.0 });
  });

  it('rebuilds on a new scene', () => {
    const first = fakeScene();
    const second = fakeScene();
    let current = first.scene;
    const ext = createBabylonAmbientOcclusion({ getScene: () => current as never });
    ext.apply(ROOM);
    current = second.scene;
    ext.apply(ROOM);
    expect(FakePipeline.instances).toHaveLength(2);
    expect(FakePipeline.instances[0].disposed).toBe(true);
    expect(FakePipeline.instances[1].scene).toBe(second.scene);
    // The old scene's camera observer is gone.
    expect(first.scene.onActiveCameraChanged.observers).toHaveLength(0);
  });

  it('clear() detaches, stops watching the camera, and disposes', () => {
    const { scene, detach } = fakeScene();
    const cam = { id: 'fp' };
    scene.activeCamera = cam;
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    ext.apply(ROOM);
    ext.clear();
    expect(detach).toHaveBeenCalledWith(SSAO_PIPELINE_NAME, cam);
    expect(scene.onActiveCameraChanged.observers).toHaveLength(0);
    expect(FakePipeline.instances[0].disposed).toBe(true);
    // Clearing twice, or before any apply, is harmless.
    ext.clear();
    expect(FakePipeline.instances).toHaveLength(1);
    // And a fresh apply builds anew.
    ext.apply(ROOM);
    expect(FakePipeline.instances).toHaveLength(2);
  });

  it('returns false with no scene yet', () => {
    const ext = createBabylonAmbientOcclusion({ getScene: () => null });
    expect(ext.apply(ROOM)).toBe(false);
    expect(FakePipeline.instances).toHaveLength(0);
  });

  it('degrades quietly when SSAO2 is unsupported (WebGL1)', () => {
    support.isSupported = false;
    const { scene } = fakeScene();
    const ext = createBabylonAmbientOcclusion({ getScene: () => scene as never });
    expect(ext.apply(ROOM)).toBe(false);
    expect(FakePipeline.instances).toHaveLength(0);
    expect(() => ext.clear()).not.toThrow();
  });
});

describe('registerBabylonAmbientOcclusionExtension', () => {
  beforeEach(() => {
    support.isSupported = true;
    FakePipeline.instances = [];
  });

  it('registers the plugin on a Babylon host', () => {
    const { scene } = fakeScene();
    const registered: Record<string, object> = {};
    registerBabylonAmbientOcclusionExtension({
      kind: 'babylon',
      registerExtension: (name, impl) => {
        registered[name] = impl;
      },
      getScene: () => scene as never,
    });
    const ext = registered[AMBIENT_OCCLUSION_EXTENSION] as AmbientOcclusionExtension;
    expect(ext).toBeDefined();
    expect(ext.apply(ROOM)).toBe(true);
    expect(FakePipeline.instances[0].scene).toBe(scene);
  });

  it('registers nothing on a Lite or Three host', () => {
    const registerExtension = vi.fn();
    registerBabylonAmbientOcclusionExtension({ kind: 'three', registerExtension });
    registerBabylonAmbientOcclusionExtension({ kind: 'babylon-lite', registerExtension, getScene: () => null });
    // A "babylon" host with no scene accessor has nothing to plug into either.
    registerBabylonAmbientOcclusionExtension({ kind: 'babylon', registerExtension });
    expect(registerExtension).not.toHaveBeenCalled();
  });
});
