/**
 * register.ts — install the ToneMapping adapter plugin on a renderer.
 *
 * Called once at bootstrap, before the scene loads. Switches on the adapter's
 * `kind`: only the full Babylon adapter exposes the scene's image-processing
 * configuration, so a Lite or Three host registers nothing and the System is a
 * safe no-op. That guard is what lets a bootstrap's `adapter/register.ts` glob
 * call this on any engine.
 */

import { TONE_MAPPING_EXTENSION } from '../ToneMapping.defs';
import { createBabylonToneMapping, type BabylonToneMappingHost } from './ToneMapping.babylon';

/** The slice of a renderer adapter this plugin registers against. */
export interface ToneMappingHost extends Partial<BabylonToneMappingHost> {
  readonly kind: string;
  registerExtension(name: string, impl: object): void;
}

/**
 * Register the tone-mapping plugin. Idempotent — a second call just replaces
 * the impl. On a non-Babylon host this is a no-op.
 */
export function registerBabylonToneMappingExtension(host: ToneMappingHost): void {
  if (host.kind !== 'babylon' || typeof host.getScene !== 'function') return;
  host.registerExtension(
    TONE_MAPPING_EXTENSION,
    createBabylonToneMapping({ getScene: () => host.getScene!() }),
  );
}
