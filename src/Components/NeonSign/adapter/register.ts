/**
 * register.ts — install the NeonSign extruded-text adapter plugin on a renderer.
 *
 * Called once at bootstrap, before the scene loads. Switches on the adapter's
 * `kind`: only the full Babylon adapter has a scene to extrude text into, so
 * a Lite or Three host registers nothing and every extruded sign quietly
 * draws its label quad instead. The parameter is the minimal host surface,
 * not the whole RendererAdapter — `getScene()` is a Babylon-only accessor and
 * shouldn't widen the interface.
 */

import { NEON_TEXT_EXTENSION } from '../NeonSign.core';
import { createBabylonNeonText, type BabylonNeonTextHost, type BabylonNeonTextOptions } from './NeonSign.babylon';

/** The slice of a renderer adapter this plugin registers against. */
export interface NeonTextHost extends Partial<BabylonNeonTextHost> {
  readonly kind: string;
  registerExtension(name: string, impl: object): void;
}

/**
 * Register the extruded-text plugin. Idempotent — a second call just replaces
 * the impl. On a non-Babylon host this is a no-op.
 */
export function registerBabylonNeonTextExtension(host: NeonTextHost, opts: BabylonNeonTextOptions = {}): void {
  if (host.kind !== 'babylon' || typeof host.getScene !== 'function') return;
  host.registerExtension(
    NEON_TEXT_EXTENSION,
    createBabylonNeonText({ getScene: () => host.getScene!() }, opts),
  );
}
