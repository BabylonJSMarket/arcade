/**
 * `@babylonjsmarket/arcade/babylon` — the Babylon-only adapter plugins the
 * free arcade components ship.
 *
 * Kept off the main barrel on purpose: the AmbientOcclusion, NeonSign and
 * Physics plugins import `@babylonjs/core` (and NeonSign pulls in `earcut`),
 * which a Three or Babylon-Lite project has no package to resolve. The main
 * entry stays engine-free; a Babylon host makes ONE call here at bootstrap:
 *
 *   import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
 *   import { registerArcadePlugins } from '@babylonjsmarket/arcade/babylon'
 *   const adapter = new BabylonAdapter()
 *   registerArcadePlugins(adapter)
 *   const game = new ArcadeGame(adapter, …)
 *
 * A new built-in plugin gets added to registerArcadePlugins, not to every
 * project's main.ts. Plugins shipped by DOWNLOADED components are a separate
 * path: the scaffold globs their `adapter/register.ts` files.
 *
 * The individual register functions stay exported for a host that wants only
 * some of them.
 */

import { registerBabylonAmbientOcclusionExtension } from './Components/AmbientOcclusion/adapter/register';
import { registerBabylonNeonTextExtension } from './Components/NeonSign/adapter/register';
import { registerPhysicsExtension } from './Components/Physics/adapter/register';
import { registerBabylonToneMappingExtension } from './Components/ToneMapping/adapter/register';

export {
  registerBabylonAmbientOcclusionExtension,
  type AmbientOcclusionHost,
} from './Components/AmbientOcclusion/adapter/register';
export {
  createBabylonAmbientOcclusion,
  type BabylonAmbientOcclusionHost,
} from './Components/AmbientOcclusion/adapter/AmbientOcclusion.babylon';
export { registerBabylonToneMappingExtension } from './Components/ToneMapping/adapter/register';
// The Physics component's own engine plugin: scene casts, the box-shape
// hot-swap, angular velocity, pre-step ownership. Register it at bootstrap and
// any component that needs a cast finds it under PHYSICS_EXTENSION.
export { registerPhysicsExtension } from './Components/Physics/adapter/register';
export {
  registerBabylonNeonTextExtension,
  type NeonTextHost,
} from './Components/NeonSign/adapter/register';
export {
  createBabylonNeonText,
  type BabylonNeonTextHost,
  type BabylonNeonTextOptions,
} from './Components/NeonSign/adapter/NeonSign.babylon';

/** The adapter surface every built-in plugin registrar accepts. */
export interface ArcadePluginHost {
  readonly kind: string;
  registerExtension(name: string, impl: object): void;
}

/**
 * Install every built-in arcade adapter plugin: the ToneMapping grade, the
 * AmbientOcclusion SSAO pass, NeonSign's extruded text, and Physics' casts and
 * body controls. Call once, after creating the adapter and before the scene
 * loads. Each registrar checks `adapter.kind` and skips an engine it has no
 * plugin for, so this is safe on any adapter — but importing this entry still
 * needs `@babylonjs/core` to resolve.
 */
export function registerArcadePlugins(adapter: ArcadePluginHost): void {
  registerBabylonToneMappingExtension(adapter);
  registerBabylonAmbientOcclusionExtension(adapter);
  registerBabylonNeonTextExtension(adapter);
  registerPhysicsExtension(adapter);
}
