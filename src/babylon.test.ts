import { describe, expect, it, vi } from 'vitest';

// The entry pulls in the SSAO plugin, which imports the engine; swap it for a
// double so this stays a shape test with no WebGL.
const { FakePipeline } = vi.hoisted(() => {
  class FakePipeline {
    static get IsSupported() {
      return true;
    }
    static built = 0;
    radius = 0;
    totalStrength = 0;
    samples = 0;
    maxZ = 0;
    base = 0;
    expensiveBlur = false;
    constructor() {
      FakePipeline.built += 1;
    }
    dispose() {}
  }
  return { FakePipeline };
});
vi.mock('@babylonjs/core', () => ({
  SSAO2RenderingPipeline: FakePipeline,
  // NeonSign's plugin reaches for these only inside `create`; the entry test
  // never builds a slab, so stubs are enough to keep the import honest.
  Color3: class {},
  MeshBuilder: { CreateText: () => null },
  PBRMaterial: class {},
}));
vi.mock('earcut', () => ({ default: () => [] }));

import * as babylon from './babylon';
import * as main from './index';
import { AMBIENT_OCCLUSION_EXTENSION } from './Components/AmbientOcclusion/AmbientOcclusion.core';
import { NEON_TEXT_EXTENSION } from './Components/NeonSign/NeonSign.core';
import { TONE_MAPPING_EXTENSION } from './Components/ToneMapping/ToneMapping.defs';

describe('@babylonjsmarket/arcade/babylon — the Babylon-only plugin entry', () => {
  it('exposes the register functions a Babylon host needs', () => {
    expect(typeof babylon.registerBabylonAmbientOcclusionExtension).toBe('function');
    expect(typeof babylon.createBabylonAmbientOcclusion).toBe('function');
    expect(typeof babylon.registerBabylonToneMappingExtension).toBe('function');
    expect(typeof babylon.registerBabylonNeonTextExtension).toBe('function');
    expect(typeof babylon.createBabylonNeonText).toBe('function');
    // ToneMapping's is duck-typed and so also lives on the main entry — same function.
    expect(babylon.registerBabylonToneMappingExtension).toBe(main.registerBabylonToneMappingExtension);
  });

  it('the main entry stays engine-free: the AO and neon-text plugins are only reachable from here', () => {
    expect('registerBabylonAmbientOcclusionExtension' in main).toBe(false);
    expect('registerBabylonNeonTextExtension' in main).toBe(false);
    expect(typeof main.AmbientOcclusionSystem).toBe('function');
    expect(typeof main.NeonSignSystem).toBe('function');
    // The extension NAME is renderer-agnostic and does live on the main entry.
    expect(main.NEON_TEXT_EXTENSION).toBe(NEON_TEXT_EXTENSION);
  });

  it('registers the neon-text plugin on a Babylon host only', () => {
    const registered = new Map<string, object>();
    const host = {
      kind: 'babylon' as const,
      registerExtension: (name: string, impl: object) => void registered.set(name, impl),
      getScene: () => null,
    };
    babylon.registerBabylonNeonTextExtension(host);
    expect([...registered.keys()]).toEqual([NEON_TEXT_EXTENSION]);
    const three = { kind: 'three', registerExtension: vi.fn() };
    babylon.registerBabylonNeonTextExtension(three);
    expect(three.registerExtension).not.toHaveBeenCalled();
  });

  it('registers both plugins on a Babylon host, neither on a Three host', () => {
    const registered = new Map<string, object>();
    const scene = {
      activeCamera: null,
      imageProcessingConfiguration: { toneMappingEnabled: false, toneMappingType: 0, exposure: 1, contrast: 1 },
      onActiveCameraChanged: { add: () => ({}), remove: () => true },
      postProcessRenderPipelineManager: { attachCamerasToRenderPipeline() {}, detachCamerasFromRenderPipeline() {} },
    };
    const host = {
      kind: 'babylon' as const,
      registerExtension: (name: string, impl: object) => void registered.set(name, impl),
      getScene: () => scene as never,
    };
    babylon.registerBabylonAmbientOcclusionExtension(host);
    babylon.registerBabylonToneMappingExtension(host);
    expect([...registered.keys()].sort()).toEqual([AMBIENT_OCCLUSION_EXTENSION, TONE_MAPPING_EXTENSION].sort());

    const ao = registered.get(AMBIENT_OCCLUSION_EXTENSION) as { apply(s: object): boolean; clear(): void };
    expect(ao.apply({ radius: 1, strength: 1, samples: 8, maxZ: 40, base: 0.1, blurRatio: 1, ssaoRatio: 0.5 })).toBe(true);
    expect(FakePipeline.built).toBe(1);
    ao.clear();

    const three = { kind: 'three', registerExtension: vi.fn() };
    babylon.registerBabylonAmbientOcclusionExtension(three);
    expect(three.registerExtension).not.toHaveBeenCalled();
  });
});
