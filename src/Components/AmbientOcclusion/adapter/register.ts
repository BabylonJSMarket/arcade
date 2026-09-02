/**
 * register.ts — install the AmbientOcclusion adapter plugin on a renderer.
 *
 * Called once at bootstrap, before the scene loads. Switches on the adapter's
 * `kind`: only the full Babylon adapter has the SSAO2 pipeline, so a Lite or
 * Three host registers nothing and the System degrades with one warning. The
 * parameter is the minimal host surface, not the whole RendererAdapter —
 * `getScene()` is a Babylon-only accessor and shouldn't widen the interface.
 */

import { AMBIENT_OCCLUSION_EXTENSION } from '../AmbientOcclusion.core';
import { createBabylonAmbientOcclusion, type BabylonAmbientOcclusionHost } from './AmbientOcclusion.babylon';

/** The slice of a renderer adapter this plugin registers against. */
export interface AmbientOcclusionHost extends Partial<BabylonAmbientOcclusionHost> {
  readonly kind: string;
  registerExtension(name: string, impl: object): void;
}

/**
 * Register the SSAO plugin. Idempotent — a second call just replaces the impl.
 * On a non-Babylon host this is a no-op.
 */
export function registerBabylonAmbientOcclusionExtension(host: AmbientOcclusionHost): void {
  if (host.kind !== 'babylon' || typeof host.getScene !== 'function') return;
  host.registerExtension(
    AMBIENT_OCCLUSION_EXTENSION,
    createBabylonAmbientOcclusion({ getScene: () => host.getScene!() }),
  );
}
