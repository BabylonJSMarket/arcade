/**
 * Physics — adapter-extension registration.
 *
 * Call `registerPhysicsExtension(adapter)` ONCE at bootstrap, right after you
 * create the renderer adapter and before loading the scene:
 *
 *   const adapter = new BabylonAdapter();
 *   registerPhysicsExtension(adapter);
 *   const game = new ArcadeGame(adapter, …);
 *
 * Any component that needs a scene cast or one of the two body controls looks
 * the result up under PHYSICS_EXTENSION — Asteroid for its bullet and hull
 * casts, Flipper for its swept-box collider, Plunger for its spin and pre-step.
 * None of them import each other, and none of them import an engine.
 *
 * Unregistered is a legitimate state: `extension()` returns undefined, a caller
 * treats that exactly as it treats `canQuery() === false`, and falls back to the
 * geometry test it has to keep anyway for the frames before Havok loads.
 */

import { PHYSICS_EXTENSION } from '../Physics.defs';
import { createBabylonExtension, type BabylonExtensionHost } from './Physics.babylon';
import { createThreeExtension, type ThreeExtensionHost } from './Physics.three';

/**
 * The minimal adapter surface this registrar touches — deliberately not the full
 * RendererAdapter type, because the host accessors it hands the plugin are
 * engine-specific.
 */
interface ExtensibleAdapter {
  kind: string;
  registerExtension(name: string, impl: object): void;
}

export function registerPhysicsExtension(adapter: ExtensibleAdapter): void {
  switch (adapter.kind) {
    case 'babylon':
      adapter.registerExtension(
        PHYSICS_EXTENSION,
        createBabylonExtension(adapter as unknown as BabylonExtensionHost),
      );
      break;
    case 'three':
      adapter.registerExtension(
        PHYSICS_EXTENSION,
        createThreeExtension(adapter as unknown as ThreeExtensionHost),
      );
      break;
    default:
      // babylon-lite answers no casts and exposes no shape swap, so the only
      // thing it could contribute is the two velocity setters — not worth a
      // fourth plugin file that would drag @babylonjs/lite into every download.
      // mock/headless get the scriptable plugin from Physics.mock, registered
      // by the test that wants it.
      break;
  }
}
