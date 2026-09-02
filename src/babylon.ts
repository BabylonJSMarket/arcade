/**
 * `@babylonjsmarket/arcade/babylon` — the Babylon-only adapter plugins the
 * free arcade components ship.
 *
 * Kept off the main barrel on purpose: `registerBabylonAmbientOcclusionExtension`
 * imports `@babylonjs/core` (it builds an SSAO2 pipeline), and
 * `registerBabylonNeonTextExtension` imports it too, plus `earcut` (it extrudes
 * sign lettering with MeshBuilder.CreateText) — a Three or Babylon-Lite project
 * has neither package to resolve. The main entry stays engine-free; a Babylon
 * host imports its plugins from here, once, at bootstrap:
 *
 *   import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
 *   import {
 *     registerBabylonAmbientOcclusionExtension,
 *     registerBabylonNeonTextExtension,
 *   } from '@babylonjsmarket/arcade/babylon'
 *   const adapter = new BabylonAdapter()
 *   registerBabylonAmbientOcclusionExtension(adapter)
 *   registerBabylonNeonTextExtension(adapter)
 *
 * ToneMapping's plugin is duck-typed (no engine import) and so is exported from
 * the main entry as well; it is re-exported here so a host has one place to
 * look for "everything Babylon".
 */

export {
  registerBabylonAmbientOcclusionExtension,
  type AmbientOcclusionHost,
} from './Components/AmbientOcclusion/adapter/register';
export {
  createBabylonAmbientOcclusion,
  type BabylonAmbientOcclusionHost,
} from './Components/AmbientOcclusion/adapter/AmbientOcclusion.babylon';
export { registerBabylonToneMappingExtension } from './Components/ToneMapping/ToneMapping.babylon';
export {
  registerBabylonNeonTextExtension,
  type NeonTextHost,
} from './Components/NeonSign/adapter/register';
export {
  createBabylonNeonText,
  type BabylonNeonTextHost,
  type BabylonNeonTextOptions,
} from './Components/NeonSign/adapter/NeonSign.babylon';
