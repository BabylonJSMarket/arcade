/**
 * NeonSign.core.ts — the renderer-agnostic side of the extruded-text seam,
 * plus the sign geometry that is pure arithmetic.
 *
 * No ecs import, no engine import. Holds the name the adapter plugin
 * registers under, the contract both sides speak (plain numbers and strings
 * only), and the little bits of trigonometry — which way a sign faces, where
 * its spot aims, where an extruded slab sits — so the plugin is left with
 * nothing but engine calls and the System with nothing but bookkeeping.
 */

/** Name the plugin registers under and the System looks up. */
export const NEON_TEXT_EXTENSION = 'neonText';

type Triple = [number, number, number];

/** Everything the plugin needs to build one sign's lettering. */
export interface NeonTextSpec {
  text: string;
  /** URL of a facetype.js font JSON. */
  fontUrl: string;
  /** Letter height, metres. */
  size: number;
  /** Extrusion depth, metres. */
  depth: number;
  /** The sign FACE — the plugin pushes the slab out from here by half its depth. */
  position: Triple;
  /** Euler rotation (radians); Y is the facing, 0 = faces +Z. */
  rotation: Triple;
  /** Tube colour, RGB 0..1. */
  color: Triple;
  /** Emissive intensity of the lettering. */
  intensity: number;
}

/**
 * Shape of the registered adapter plugin.
 *
 * `create` resolves to the mesh name once the lettering exists, or `null`
 * when it cannot be built (no scene yet, the font failed to load, empty
 * text) — the System then falls back to a label quad. Calling it again under
 * the same `id` replaces the previous lettering. `dispose` is safe to call
 * for an id that was never built or whose build is still in flight.
 */
export interface NeonTextExtension {
  create(id: string, spec: NeonTextSpec): Promise<string | null>;
  setColor(id: string, color: Triple, intensity: number): void;
  dispose(id: string): void;
}

/** The sign's outward normal for a facing `yaw`; 0 = faces +Z. */
export function signNormal(yaw: number): Triple {
  return [Math.sin(yaw), 0, Math.cos(yaw)];
}

/**
 * Where the spot behind a sign points: out along the facing and tilted 0.4
 * down, normalized — the old room's aim, so the wash rakes down over the
 * cabinet tops instead of only lighting their fronts.
 */
export function spotDirection(yaw: number): Triple {
  const n = signNormal(yaw);
  const len = Math.hypot(n[0], -0.4, n[2]);
  return [n[0] / len, -0.4 / len, n[2] / len];
}

/**
 * Where an extruded slab of `depth` sits so it stands proud of the wall into
 * the room: the sign face pushed along its normal by half the depth plus a
 * centimetre (the slab is centred on its origin), turned to the sign's own
 * facing. The extruder's readable side comes out at local +Z — the same side
 * `signNormal(0)` points — so the slab's yaw IS the sign's yaw.
 *
 * It used to add a half-turn. That constant came from the old raw-Babylon
 * room, a LEFT-handed scene that drew everything as a mirror image; there the
 * slab's back read correctly and its front read backwards. In this
 * right-handed renderer the extra π shows the back, and every sign reads
 * mirrored. (Hand a mirrored sign to any glTF-correct renderer and the same
 * thing happens — the fix belongs here, not in a scene.)
 */
export function extrudedTextTransform(
  face: Triple,
  yaw: number,
  depth: number,
): { position: Triple; rotationY: number } {
  const n = signNormal(yaw);
  const push = depth / 2 + 0.01;
  return {
    position: [face[0] + n[0] * push, face[1] + n[1] * push, face[2] + n[2] * push],
    rotationY: yaw,
  };
}

/** True when every component of `a` and `b` is within `eps`. */
export function sameTriple(a: Triple | undefined, b: Triple, eps = 1e-6): boolean {
  return (
    !!a &&
    Math.abs(a[0] - b[0]) <= eps &&
    Math.abs(a[1] - b[1]) <= eps &&
    Math.abs(a[2] - b[2]) <= eps
  );
}
