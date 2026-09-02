import { describe, expect, it } from 'vitest';
import {
  AMBIENT_OCCLUSION_EXTENSION,
  needsRebuild,
  sameSettings,
  type AmbientOcclusionSettings,
} from './AmbientOcclusion.core';

const base: AmbientOcclusionSettings = {
  radius: 0.8,
  strength: 1,
  samples: 8,
  maxZ: 40,
  base: 0.1,
  blurRatio: 1,
  ssaoRatio: 0.5,
};

describe('AmbientOcclusion.core', () => {
  it('names the extension the System looks up', () => {
    expect(AMBIENT_OCCLUSION_EXTENSION).toBe('ambientOcclusion');
  });

  it('sameSettings is false against nothing and true against an equal copy', () => {
    expect(sameSettings(undefined, base)).toBe(false);
    expect(sameSettings({ ...base }, base)).toBe(true);
  });

  it('sameSettings notices every field', () => {
    for (const key of Object.keys(base) as (keyof AmbientOcclusionSettings)[]) {
      expect(sameSettings({ ...base, [key]: base[key] + 1 }, base), key).toBe(false);
    }
  });

  it('needsRebuild only for the constructor-only ratios', () => {
    expect(needsRebuild(base, { ...base, radius: 2, strength: 2, samples: 16, maxZ: 10, base: 0 })).toBe(false);
    expect(needsRebuild(base, { ...base, blurRatio: 0.5 })).toBe(true);
    expect(needsRebuild(base, { ...base, ssaoRatio: 1 })).toBe(true);
  });
});
