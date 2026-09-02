/**
 * NeonSign.babylon.ts — the Babylon adapter plugin for NeonSign's extruded
 * lettering.
 *
 * The one place in this bundle allowed to import the engine. Builds each
 * sign's words as real slab geometry with `MeshBuilder.CreateText` (Babylon's
 * font-outline extruder, which needs a facetype.js font JSON and the earcut
 * triangulator) on the adapter's live scene, reached through the `getScene()`
 * host accessor, and dresses it in an unlit emissive PBR material so the
 * tubes read as light sources rather than lit plastic.
 *
 * Bootstrap once, right after creating the Babylon adapter:
 *
 *   const adapter = new BabylonAdapter();
 *   registerBabylonNeonTextExtension(adapter);   // adapter/register.ts
 *   const game = new ArcadeGame(adapter, ...);
 *   // any NeonSign with `extruded: true` now gets real lettering.
 *
 * The font is fetched once per URL and shared: nine signs on one font cost
 * one request. Where the font cannot be had, `create` resolves `null` and the
 * System falls back to its label quad — nothing here throws.
 *
 * `earcut` only enters a bundle through this file, i.e. when a host imports
 * the plugin; the main `@babylonjsmarket/arcade` entry stays clear of it.
 */

import { Color3, MeshBuilder, PBRMaterial } from '@babylonjs/core';
import type { IFontData, Mesh, Scene } from '@babylonjs/core';
import earcut from 'earcut';
import { extrudedTextTransform, type NeonTextExtension, type NeonTextSpec } from '../NeonSign.core';

/** The host surface the plugin needs from a Babylon adapter. */
export interface BabylonNeonTextHost {
  getScene(): Scene | null;
}

export interface BabylonNeonTextOptions {
  /**
   * How a font URL becomes font data. Defaults to `fetch` + `.json()`;
   * injectable so a test (or a host with its fonts bundled) can skip the
   * network.
   */
  fetchFont?: (url: string) => Promise<IFontData | null>;
}

/** Glyph outlines resolution handed to CreateText — the old room's setting. */
const TEXT_RESOLUTION = 8;

async function fetchFontJson(url: string): Promise<IFontData | null> {
  const res = await fetch(url, { cache: 'force-cache' });
  return res.ok ? ((await res.json()) as IFontData) : null;
}

/**
 * Build the plugin for one host. Kept separate from registration so a test
 * can drive create/setColor/dispose directly against a fake scene.
 */
export function createBabylonNeonText(
  host: BabylonNeonTextHost,
  opts: BabylonNeonTextOptions = {},
): NeonTextExtension {
  const fetchFont = opts.fetchFont ?? fetchFontJson;
  // One in-flight-or-done promise per URL. A failure is cached too: nine
  // signs asking for a font that isn't there should fail once, not nine times.
  const fonts = new Map<string, Promise<IFontData | null>>();
  const meshes = new Map<string, Mesh>();
  // Per-id build sequence. A `create` that was overtaken by a newer `create`
  // or a `dispose` while it awaited the font builds nothing — otherwise a
  // sign removed mid-load would leave an orphan slab on the wall.
  const seqs = new Map<string, number>();

  const loadFont = (url: string): Promise<IFontData | null> => {
    let p = fonts.get(url);
    if (!p) {
      p = fetchFont(url).catch(() => null);
      fonts.set(url, p);
    }
    return p;
  };

  const bump = (id: string): number => {
    const seq = (seqs.get(id) ?? 0) + 1;
    seqs.set(id, seq);
    return seq;
  };

  const dispose = (id: string): void => {
    bump(id);
    const mesh = meshes.get(id);
    if (!mesh) return;
    mesh.material?.dispose();
    mesh.dispose();
    meshes.delete(id);
  };

  return {
    async create(id: string, spec: NeonTextSpec): Promise<string | null> {
      const seq = bump(id);
      const font = await loadFont(spec.fontUrl);
      if (seqs.get(id) !== seq) return null; // overtaken while the font loaded
      const scene = host.getScene();
      // Replace whatever this id had before; `dispose` bumps the sequence,
      // so re-stamp ours afterwards.
      dispose(id);
      seqs.set(id, seq);
      if (!font || !scene || !spec.text) return null;

      const mesh = MeshBuilder.CreateText(
        `${id}_neonText`,
        spec.text,
        font,
        { size: spec.size, resolution: TEXT_RESOLUTION, depth: spec.depth },
        scene,
        earcut,
      );
      if (!mesh) return null;

      // CreateText bakes a -π/2 X-rotation in so the letters stand upright,
      // centred on the origin with the readable face at local +Z (in this
      // right-handed scene — the old left-handed room saw the mirror image).
      // The core's transform yaws the slab to the sign's facing and pushes it
      // out of the wall by half its depth so the front stands proud.
      const t = extrudedTextTransform(spec.position, spec.rotation[1], spec.depth);
      mesh.rotation.y = t.rotationY;
      mesh.position.set(t.position[0], t.position[1], t.position[2]);

      const mat = new PBRMaterial(`${id}_neonText_mat`, scene);
      mat.albedoColor = Color3.Black();
      mat.emissiveColor = new Color3(spec.color[0], spec.color[1], spec.color[2]);
      mat.emissiveIntensity = spec.intensity;
      mat.unlit = true;
      mat.backFaceCulling = true;
      mat.maxSimultaneousLights = 6;
      mesh.material = mat;
      // A sign is scenery: it must not sit in front of a cabinet's click.
      mesh.isPickable = false;

      meshes.set(id, mesh);
      return mesh.name;
    },

    setColor(id: string, color: [number, number, number], intensity: number): void {
      const mat = meshes.get(id)?.material as PBRMaterial | null | undefined;
      if (!mat) return;
      mat.emissiveColor = new Color3(color[0], color[1], color[2]);
      mat.emissiveIntensity = intensity;
    },

    dispose,
  };
}
