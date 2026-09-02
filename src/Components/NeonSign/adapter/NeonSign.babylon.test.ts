import { beforeEach, describe, expect, it, vi } from 'vitest';

// The plugin is the one file allowed to import the engine; the test swaps
// that engine for recording doubles so no WebGL is needed. `vi.hoisted`
// because `vi.mock` is lifted above every import — the fakes must be too.
const { FakeColor3, FakeMaterial, FakeMesh, createText } = vi.hoisted(() => {
  class FakeColor3 {
    constructor(
      public r = 0,
      public g = 0,
      public b = 0,
    ) {}
    static Black() {
      return new FakeColor3(0, 0, 0);
    }
  }
  class FakeMaterial {
    static instances: FakeMaterial[] = [];
    albedoColor: FakeColor3 | null = null;
    emissiveColor: FakeColor3 | null = null;
    emissiveIntensity = 0;
    unlit = false;
    backFaceCulling = false;
    maxSimultaneousLights = 4;
    disposed = false;
    constructor(
      public name: string,
      public scene: unknown,
    ) {
      FakeMaterial.instances.push(this);
    }
    dispose() {
      this.disposed = true;
    }
  }
  class FakeMesh {
    static instances: FakeMesh[] = [];
    rotation = { x: 0, y: 0, z: 0 };
    position = {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    };
    material: FakeMaterial | null = null;
    isPickable = true;
    disposed = false;
    constructor(public name: string) {
      FakeMesh.instances.push(this);
    }
    dispose() {
      this.disposed = true;
    }
  }
  const createText = vi.fn((...args: unknown[]) => new FakeMesh(args[0] as string));
  return { FakeColor3, FakeMaterial, FakeMesh, createText };
});
vi.mock('@babylonjs/core', () => ({
  Color3: FakeColor3,
  MeshBuilder: { CreateText: createText },
  PBRMaterial: FakeMaterial,
}));
vi.mock('earcut', () => ({ default: function earcut() { return []; } }));

import { createBabylonNeonText } from './NeonSign.babylon';
import { registerBabylonNeonTextExtension } from './register';
import { NEON_TEXT_EXTENSION, type NeonTextExtension, type NeonTextSpec } from '../NeonSign.core';

const FONT = { glyphs: {}, resolution: 1000 } as never;
const SPEC: NeonTextSpec = {
  text: 'PLAY',
  fontUrl: '/fonts/neon.json',
  size: 0.4,
  depth: 0.088,
  position: [-5.86, 1.95, -3.8],
  rotation: [0, Math.PI / 2, 0],
  color: [1, 0.15, 0.55],
  intensity: 3,
};

/** Resolve-on-demand font loader so a test can hold the fetch open. */
function deferredFont() {
  let resolve!: (f: unknown) => void;
  const promise = new Promise<unknown>((r) => (resolve = r));
  const fetchFont = vi.fn(() => promise as Promise<never>);
  return { fetchFont, resolve };
}

describe('createBabylonNeonText — extrudes a sign through MeshBuilder.CreateText', () => {
  const scene = { id: 'scene' };
  let fetchFont: ReturnType<typeof vi.fn>;
  let ext: NeonTextExtension;

  beforeEach(() => {
    FakeMesh.instances = [];
    FakeMaterial.instances = [];
    createText.mockClear();
    fetchFont = vi.fn(async () => FONT);
    ext = createBabylonNeonText({ getScene: () => scene as never }, { fetchFont });
  });

  it('builds the slab with the old room’s CreateText settings and facing correction', async () => {
    const name = await ext.create('Neon_Middle_0', SPEC);
    expect(name).toBe('Neon_Middle_0_neonText');
    expect(createText).toHaveBeenCalledTimes(1);
    const [meshName, text, font, options, hostScene, earcutRef] = createText.mock.calls[0] as unknown[];
    expect(meshName).toBe('Neon_Middle_0_neonText');
    expect(text).toBe('PLAY');
    expect(font).toBe(FONT);
    expect(options).toEqual({ size: 0.4, resolution: 8, depth: 0.088 });
    expect(hostScene).toBe(scene);
    expect(typeof earcutRef).toBe('function');

    const mesh = FakeMesh.instances[0];
    // The sign's own facing — the extruded text reads on its local +Z, which
    // is where signNormal(yaw) points. (A half-turn here shows the back.)
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2, 10);
    // Pushed out from the wall face along +X (the facing) by depth/2 + 1 cm.
    expect(mesh.position.x).toBeCloseTo(-5.86 + 0.044 + 0.01, 10);
    expect(mesh.position.y).toBeCloseTo(1.95, 10);
    expect(mesh.position.z).toBeCloseTo(-3.8, 10);
    expect(mesh.isPickable).toBe(false);

    const mat = mesh.material!;
    expect(mat.name).toBe('Neon_Middle_0_neonText_mat');
    expect(mat.albedoColor).toEqual(new FakeColor3(0, 0, 0));
    expect(mat.emissiveColor).toEqual(new FakeColor3(1, 0.15, 0.55));
    expect(mat.emissiveIntensity).toBe(3);
    expect(mat.unlit).toBe(true);
    expect(mat.backFaceCulling).toBe(true);
    expect(mat.maxSimultaneousLights).toBe(6);
  });

  it('fetches a font once per URL, however many signs use it', async () => {
    await Promise.all([
      ext.create('a', SPEC),
      ext.create('b', SPEC),
      ext.create('c', { ...SPEC, fontUrl: '/fonts/other.json' }),
    ]);
    expect(fetchFont).toHaveBeenCalledTimes(2);
    expect(fetchFont).toHaveBeenCalledWith('/fonts/neon.json');
    expect(fetchFont).toHaveBeenCalledWith('/fonts/other.json');
    expect(FakeMesh.instances).toHaveLength(3);
  });

  it('resolves null — and builds nothing — when the font cannot be had', async () => {
    fetchFont.mockImplementation(async () => null);
    expect(await ext.create('a', SPEC)).toBeNull();
    // A rejected fetch is the same story, and is not retried per sign.
    fetchFont.mockImplementation(async () => {
      throw new Error('404');
    });
    expect(await ext.create('b', { ...SPEC, fontUrl: '/fonts/missing.json' })).toBeNull();
    expect(await ext.create('c', { ...SPEC, fontUrl: '/fonts/missing.json' })).toBeNull();
    expect(fetchFont).toHaveBeenCalledTimes(2);
    expect(createText).not.toHaveBeenCalled();
  });

  it('resolves null with no scene yet, with empty text, and when CreateText declines', async () => {
    const noScene = createBabylonNeonText({ getScene: () => null }, { fetchFont });
    expect(await noScene.create('a', SPEC)).toBeNull();
    expect(await ext.create('b', { ...SPEC, text: '' })).toBeNull();
    createText.mockImplementationOnce(() => null as never);
    expect(await ext.create('c', SPEC)).toBeNull();
    expect(FakeMesh.instances).toHaveLength(0);
  });

  it('a second create under the same id replaces the first slab', async () => {
    await ext.create('a', SPEC);
    await ext.create('a', { ...SPEC, text: 'ENTER' });
    expect(FakeMesh.instances).toHaveLength(2);
    expect(FakeMesh.instances[0].disposed).toBe(true);
    expect(FakeMesh.instances[0].material!.disposed).toBe(true);
    expect(FakeMesh.instances[1].disposed).toBe(false);
  });

  it('setColor recolours the live slab and ignores an unknown id', async () => {
    await ext.create('a', SPEC);
    ext.setColor('a', [0.15, 0.9, 1], 5);
    const mat = FakeMesh.instances[0].material!;
    expect(mat.emissiveColor).toEqual(new FakeColor3(0.15, 0.9, 1));
    expect(mat.emissiveIntensity).toBe(5);
    expect(() => ext.setColor('nobody', [1, 1, 1], 1)).not.toThrow();
  });

  it('dispose frees the slab and its material, and is harmless for an unknown id', async () => {
    await ext.create('a', SPEC);
    ext.dispose('a');
    expect(FakeMesh.instances[0].disposed).toBe(true);
    expect(FakeMesh.instances[0].material!.disposed).toBe(true);
    expect(() => ext.dispose('a')).not.toThrow();
    expect(() => ext.dispose('never')).not.toThrow();
  });

  it('a dispose while the font is still loading cancels the build — no orphan slab', async () => {
    const { fetchFont: slow, resolve } = deferredFont();
    const lazy = createBabylonNeonText({ getScene: () => scene as never }, { fetchFont: slow as never });
    const pending = lazy.create('a', SPEC);
    lazy.dispose('a'); // the sign went away before its font arrived
    resolve(FONT);
    expect(await pending).toBeNull();
    expect(createText).not.toHaveBeenCalled();
  });

  it('a newer create overtakes an older one still waiting on its font', async () => {
    const { fetchFont: slow, resolve } = deferredFont();
    const lazy = createBabylonNeonText({ getScene: () => scene as never }, { fetchFont: slow as never });
    const first = lazy.create('a', SPEC);
    const second = lazy.create('a', { ...SPEC, text: 'ENTER' });
    resolve(FONT);
    expect(await first).toBeNull();
    expect(await second).toBe('a_neonText');
    expect(createText).toHaveBeenCalledTimes(1);
    expect(createText.mock.calls[0][1]).toBe('ENTER');
  });

  it('uses fetch + json for the font by default', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async (): Promise<unknown> => FONT }));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const plain = createBabylonNeonText({ getScene: () => scene as never });
      expect(await plain.create('a', SPEC)).toBe('a_neonText');
      expect(fetchSpy).toHaveBeenCalledWith('/fonts/neon.json', { cache: 'force-cache' });
      // A non-OK response is "no font".
      fetchSpy.mockResolvedValueOnce({ ok: false, json: async () => null });
      expect(await plain.create('b', { ...SPEC, fontUrl: '/fonts/nope.json' })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('registerBabylonNeonTextExtension', () => {
  it('registers the plugin on a Babylon host', async () => {
    const registered: Record<string, object> = {};
    const scene = { id: 'scene' };
    registerBabylonNeonTextExtension(
      {
        kind: 'babylon',
        registerExtension: (name, impl) => {
          registered[name] = impl;
        },
        getScene: () => scene as never,
      },
      { fetchFont: async () => FONT },
    );
    const ext = registered[NEON_TEXT_EXTENSION] as NeonTextExtension;
    expect(ext).toBeDefined();
    expect(await ext.create('a', SPEC)).toBe('a_neonText');
  });

  it('registers nothing on a Lite or Three host, or a Babylon host with no scene accessor', () => {
    const registerExtension = vi.fn();
    registerBabylonNeonTextExtension({ kind: 'three', registerExtension });
    registerBabylonNeonTextExtension({ kind: 'babylon-lite', registerExtension, getScene: () => null });
    registerBabylonNeonTextExtension({ kind: 'babylon', registerExtension });
    expect(registerExtension).not.toHaveBeenCalled();
  });
});
