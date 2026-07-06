/**
 * ToneMapping.babylon.ts — the Babylon adapter plugin for ToneMapping.
 *
 * Reaches the live scene through the adapter's `getScene()` host accessor and
 * drives its `imageProcessingConfiguration` (the same knobs the marketplace
 * figure-render harness sets: ACES tone mapping + exposure + contrast).
 *
 * Bootstrap once, right after creating the Babylon adapter:
 *
 *   const adapter = new BabylonAdapter();
 *   registerBabylonToneMappingExtension(adapter);
 *   const game = new ArcadeGame(adapter, ...);
 *   // any scene with a `ToneMapping` component now gets the grade.
 *
 * The scene is duck-typed so this stays free of a hard `@babylonjs` dependency;
 * the tone-mapping constants mirror Babylon's `ImageProcessingConfiguration`
 * (STANDARD = 0, ACES = 1) and have been stable for years.
 */

import {
  TONE_MAPPING_EXTENSION,
  type ToneMappingExtension,
  type ToneMappingMode,
  type ToneMappingSettings,
} from './ToneMapping.core';

/** The slice of Babylon's scene.imageProcessingConfiguration we touch. */
interface BabylonImageProcessing {
  toneMappingEnabled: boolean;
  toneMappingType: number;
  exposure: number;
  contrast: number;
}
interface BabylonSceneLike {
  imageProcessingConfiguration: BabylonImageProcessing;
}
/** The host surface the plugin needs from a Babylon adapter. */
export interface BabylonToneMappingHost {
  registerExtension(name: string, impl: object): void;
  getScene(): BabylonSceneLike | null;
}

// Babylon ImageProcessingConfiguration.TONEMAPPING_* values.
const TONEMAPPING_STANDARD = 0;
const TONEMAPPING_ACES = 1;
const CURVE: Record<ToneMappingMode, number> = {
  standard: TONEMAPPING_STANDARD,
  aces: TONEMAPPING_ACES,
  none: TONEMAPPING_STANDARD,
};

/**
 * Register the tone-mapping plugin on a Babylon adapter. Idempotent — a second
 * call just replaces the impl.
 */
export function registerBabylonToneMappingExtension(
  host: BabylonToneMappingHost,
): void {
  const impl: ToneMappingExtension = {
    apply(s: ToneMappingSettings): void {
      const scene = host.getScene();
      if (!scene) return;
      const ip = scene.imageProcessingConfiguration;
      ip.toneMappingEnabled = s.mode !== 'none';
      ip.toneMappingType = CURVE[s.mode];
      ip.exposure = s.exposure;
      ip.contrast = s.contrast;
    },
    clear(): void {
      const scene = host.getScene();
      if (!scene) return;
      scene.imageProcessingConfiguration.toneMappingEnabled = false;
    },
  };
  host.registerExtension(TONE_MAPPING_EXTENSION, impl);
}
