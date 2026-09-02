/**
 * AmbientOcclusion.core.ts — the renderer-agnostic contract for the SSAO pass.
 *
 * Pure: no ecs import, no engine import. Holds the name the adapter plugin
 * registers under, the settings shape both sides speak, and the one piece of
 * arithmetic the System needs (a settings diff) so it can be tested with no
 * engine at all.
 */

/** Name the plugin registers under and the System looks up. */
export const AMBIENT_OCCLUSION_EXTENSION = 'ambientOcclusion';

/** Resolved settings the adapter plugin consumes. */
export interface AmbientOcclusionSettings {
  /** World-space radius the occlusion is sampled over. */
  radius: number;
  /** How dark the occluded corners get. */
  strength: number;
  /** Samples per pixel — cost vs. noise. */
  samples: number;
  /** Depth beyond which nothing is occluded (keeps a far wall clean). */
  maxZ: number;
  /** Floor under the darkening, so shadows never go fully black. */
  base: number;
  /** Blur pass resolution relative to the screen. Constructor-only: a change rebuilds the pipeline. */
  blurRatio: number;
  /** Occlusion pass resolution relative to the screen. Constructor-only, as above. */
  ssaoRatio: number;
}

/**
 * Shape of the registered adapter plugin.
 *
 * `apply` returns whether the pass is actually live: `false` means the engine
 * can't run it (no WebGL2, no scene yet) and the System reports UNSUPPORTED
 * once. It is safe to call repeatedly with new settings; the plugin updates
 * in place where it can and rebuilds only when a constructor-only ratio moves.
 */
export interface AmbientOcclusionExtension {
  apply(settings: AmbientOcclusionSettings): boolean;
  clear(): void;
}

/** True when every field matches — the per-frame "anything changed?" test. */
export function sameSettings(
  a: AmbientOcclusionSettings | undefined,
  b: AmbientOcclusionSettings,
): boolean {
  return (
    !!a &&
    a.radius === b.radius &&
    a.strength === b.strength &&
    a.samples === b.samples &&
    a.maxZ === b.maxZ &&
    a.base === b.base &&
    a.blurRatio === b.blurRatio &&
    a.ssaoRatio === b.ssaoRatio
  );
}

/** True when a change needs the pipeline rebuilt rather than retuned. */
export function needsRebuild(
  a: AmbientOcclusionSettings,
  b: AmbientOcclusionSettings,
): boolean {
  return a.blurRatio !== b.blurRatio || a.ssaoRatio !== b.ssaoRatio;
}
