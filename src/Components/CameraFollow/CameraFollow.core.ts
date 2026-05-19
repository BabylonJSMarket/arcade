/**
 * CameraFollow core — pure, deterministic, renderer-free.
 *
 * Given the target's world position each frame, the core returns a smoothed
 * camera-target position that approaches the target exponentially. The curve
 * is frame-rate independent: doubling the frame rate produces the same arc.
 *
 * Zero imports from @babylonjs, three, solid-js, or the DOM.
 */

export interface CameraFollowParams {
  /**
   * Rate of exponential approach in 1/sec. Higher = snappier.
   * alpha_per_frame = 1 - exp(-smoothing * dt).
   * 0 locks the camera in place (no follow). 6 feels natural; 12 is tight.
   */
  smoothing: number;
  /** Added to target position each frame; useful for looking above the head. */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export interface CameraFollowInputs {
  targetX: number;
  targetY: number;
  targetZ: number;
}

export interface CameraFollowOutputs {
  camX: number;
  camY: number;
  camZ: number;
}

export interface CameraFollowInstance {
  update(inputs: CameraFollowInputs, dt: number): CameraFollowOutputs;
  setParams(partial: Partial<CameraFollowParams>): void;
  getParams(): Readonly<CameraFollowParams>;
  /** Snap the internal position to `pos`, or to the origin if omitted. */
  reset(pos?: CameraFollowOutputs): void;
}

export const DEFAULT_CAMERA_FOLLOW_PARAMS: CameraFollowParams = {
  smoothing: 6,
  offsetX: 0,
  offsetY: 1.2,
  offsetZ: 0,
};

export function createCameraFollow(
  params: Partial<CameraFollowParams> = {},
  initial: CameraFollowOutputs = { camX: 0, camY: 0, camZ: 0 },
): CameraFollowInstance {
  const active: CameraFollowParams = { ...DEFAULT_CAMERA_FOLLOW_PARAMS, ...params };
  let x = initial.camX;
  let y = initial.camY;
  let z = initial.camZ;

  return {
    update(inputs, dt) {
      const tx = inputs.targetX + active.offsetX;
      const ty = inputs.targetY + active.offsetY;
      const tz = inputs.targetZ + active.offsetZ;

      if (active.smoothing > 0 && dt > 0) {
        const alpha = 1 - Math.exp(-active.smoothing * dt);
        x += (tx - x) * alpha;
        y += (ty - y) * alpha;
        z += (tz - z) * alpha;
      }

      return { camX: x, camY: y, camZ: z };
    },
    setParams(partial) {
      Object.assign(active, partial);
    },
    getParams() {
      return active;
    },
    reset(pos) {
      x = pos?.camX ?? 0;
      y = pos?.camY ?? 0;
      z = pos?.camZ ?? 0;
    },
  };
}
