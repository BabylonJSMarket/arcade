/**
 * AmbientOcclusion.babylon.ts — the Babylon adapter plugin for AmbientOcclusion.
 *
 * The one place in this bundle allowed to import the engine. Builds Babylon's
 * `SSAO2RenderingPipeline` on the adapter's live scene (reached through the
 * `getScene()` host accessor) and keeps it attached to whatever camera is
 * active — a scene reload swaps cameras, so the plugin watches
 * `onActiveCameraChanged` rather than assuming the one it started with.
 *
 * Bootstrap once, right after creating the Babylon adapter:
 *
 *   const adapter = new BabylonAdapter();
 *   registerBabylonAmbientOcclusionExtension(adapter);   // adapter/register.ts
 *   const game = new ArcadeGame(adapter, ...);
 *   // any scene with an `AmbientOcclusion` component now gets contact shadows.
 *
 * SSAO2 needs WebGL2 (`SSAO2RenderingPipeline.IsSupported`). Where it is
 * missing, `apply` returns false and the scene renders without the pass — the
 * System says so once; nothing here throws.
 */

import { SSAO2RenderingPipeline } from '@babylonjs/core';
import type { Camera, Observer, Scene } from '@babylonjs/core';
import {
  needsRebuild,
  type AmbientOcclusionExtension,
  type AmbientOcclusionSettings,
} from '../AmbientOcclusion.core';

/** The host surface the plugin needs from a Babylon adapter. */
export interface BabylonAmbientOcclusionHost {
  getScene(): Scene | null;
}

/** Name the pipeline is registered under with the scene's pipeline manager. */
export const SSAO_PIPELINE_NAME = 'ssao';

/**
 * Build the plugin for one host. Kept separate from registration so a test
 * can drive apply/clear directly against a fake scene.
 */
export function createBabylonAmbientOcclusion(
  host: BabylonAmbientOcclusionHost,
): AmbientOcclusionExtension {
  let scene: Scene | null = null;
  let pipeline: SSAO2RenderingPipeline | null = null;
  let built: AmbientOcclusionSettings | null = null;
  let attachedTo: Camera | null = null;
  let cameraObserver: Observer<Scene> | null = null;

  /** Follow the active camera: detach from the old one, attach to the new. */
  const follow = (): void => {
    if (!scene || !pipeline) return;
    const cam = scene.activeCamera;
    if (cam === attachedTo) return;
    const mgr = scene.postProcessRenderPipelineManager;
    if (attachedTo) mgr.detachCamerasFromRenderPipeline(SSAO_PIPELINE_NAME, attachedTo);
    if (cam) mgr.attachCamerasToRenderPipeline(SSAO_PIPELINE_NAME, cam);
    attachedTo = cam;
  };

  const teardown = (): void => {
    if (scene && cameraObserver) scene.onActiveCameraChanged.remove(cameraObserver);
    cameraObserver = null;
    if (scene && pipeline && attachedTo) {
      scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
        SSAO_PIPELINE_NAME,
        attachedTo,
      );
    }
    attachedTo = null;
    // dispose() also removes the pipeline from the scene's manager.
    pipeline?.dispose();
    pipeline = null;
    built = null;
    scene = null;
  };

  return {
    apply(s: AmbientOcclusionSettings): boolean {
      const live = host.getScene();
      if (!live) return false;
      if (!SSAO2RenderingPipeline.IsSupported) return false;

      // A new scene, or a ratio change (constructor-only in Babylon): rebuild.
      if (pipeline && (scene !== live || (built && needsRebuild(built, s)))) teardown();

      if (!pipeline) {
        scene = live;
        pipeline = new SSAO2RenderingPipeline(
          SSAO_PIPELINE_NAME,
          live,
          { ssaoRatio: s.ssaoRatio, blurRatio: s.blurRatio },
          [],
        );
        cameraObserver = live.onActiveCameraChanged.add(follow);
      }
      built = { ...s };
      pipeline.radius = s.radius;
      pipeline.totalStrength = s.strength;
      pipeline.samples = s.samples;
      pipeline.maxZ = s.maxZ;
      pipeline.base = s.base;
      // Bilateral blur keeps the darkening from bleeding across depth edges —
      // the difference between a shadow under the cabinet and a smudge on it.
      pipeline.expensiveBlur = true;
      follow();
      return true;
    },
    clear(): void {
      teardown();
    },
  };
}
