/**
 * Animation — pure core.
 *
 * A locomotion blend tree that maps a character's current movement `speed`
 * to weights on three animation clips (idle / walk / run), plus a scaled
 * playback speedRatio that keeps feet from sliding.
 *
 * Zero imports from @babylonjs, three, solid-js or the DOM. The core takes
 * numbers in, returns numbers out — the System is the only place allowed to
 * talk to the renderer. That means the same blend logic can be exercised in
 * a pure Node test and drives both adapters with no changes.
 *
 * Blend shape:
 *   speed < speedThreshold              → pure idle (weight 1,0,0)
 *   threshold ≤ speed < walkSpeed       → idle→walk blend (t linear)
 *   walkSpeed ≤ speed < runSpeed        → walk→run blend (t linear)
 *   speed ≥ runSpeed                    → pure run (weight 0,0,1)
 *
 * Output weights smooth toward targets via a framerate-aware `lerpTowards`
 * at `blendSpeed` units per second. A second, slower lerp on `speedRatio`
 * (rate 2) prevents jarring audible clicks when playback speed changes.
 *
 * Public surface:
 *   createAnimation(params)           — factory
 *   instance.update(speed, dt)        — returns AnimationOutputs snapshot
 *   instance.getState()               — read-only live state for HUDs
 *   instance.getParams() / setParams  — live-tune from panel
 *   instance.reset()                  — back to pure idle + default params
 */

export type AnimationState = 'idle' | 'walk' | 'run';

export interface AnimationParams {
  /** Movement speed at which `walk` weight reaches 1. */
  walkSpeed: number;
  /** Movement speed at which `run` weight reaches 1. */
  runSpeed: number;
  /** Weight transition speed per second. Higher = snappier blends. */
  blendSpeed: number;
  /** Movement-speed smoothing rate (per second). Higher = follows input faster. */
  speedSmoothRate: number;
  /** Dead-zone: any speed below this reads as "standing still". */
  speedThreshold: number;
  /** Min clamp on the animation playback rate multiplier. */
  minSpeedRatio: number;
  /** Max clamp on the animation playback rate multiplier. */
  maxSpeedRatio: number;
}

export const DEFAULT_ANIMATION_PARAMS: AnimationParams = {
  walkSpeed: 3,
  runSpeed: 6,
  blendSpeed: 8,
  speedSmoothRate: 4,
  speedThreshold: 0.5,
  minSpeedRatio: 0.5,
  maxSpeedRatio: 3,
};

export interface AnimationOutputs {
  /** Weight in [0,1] on the idle clip. */
  idleWeight: number;
  /** Weight in [0,1] on the walk clip. */
  walkWeight: number;
  /** Weight in [0,1] on the run clip. */
  runWeight: number;
  /** Playback speed multiplier for locomotion clips (idle stays at 1). */
  speedRatio: number;
  /** Dominant weight, resolved as an enum for HUD/event wiring. */
  state: AnimationState;
  /** True the frame `state` differs from the previous frame's state. */
  stateChanged: boolean;
  /** Smoothed speed used internally this frame — useful for debug. */
  smoothedSpeed: number;
}

export interface AnimationState_ {
  idleWeight: number;
  walkWeight: number;
  runWeight: number;
  speedRatio: number;
  state: AnimationState;
  smoothedSpeed: number;
}

export interface AnimationInstance {
  update(speed: number, dt: number): AnimationOutputs;
  getState(): Readonly<AnimationState_>;
  getParams(): Readonly<AnimationParams>;
  setParams(partial: Partial<AnimationParams>): void;
  reset(): void;
}

/**
 * Framerate-aware move-toward helper. Same signature as Babylon's
 * Scalar.MoveTowards. Snaps to `target` within `maxDelta` so the caller
 * never overshoots.
 */
function lerpTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

export function createAnimation(
  params: Partial<AnimationParams> = {},
): AnimationInstance {
  const active: AnimationParams = { ...DEFAULT_ANIMATION_PARAMS, ...params };

  let idleWeight = 1;
  let walkWeight = 0;
  let runWeight = 0;
  let speedRatio = 1;
  let smoothedSpeed = 0;
  let state: AnimationState = 'idle';

  const snapshot = (): AnimationState_ => ({
    idleWeight,
    walkWeight,
    runWeight,
    speedRatio,
    state,
    smoothedSpeed,
  });

  return {
    update(rawSpeed, dt) {
      // Guard negative dt (e.g., a replay step backwards) — treat as 0 so we
      // never unwind the blends and we stay deterministic.
      const stepDt = Math.max(0, dt);

      // 1. Smooth the input speed so physics micro-jitter doesn't flap the blend.
      smoothedSpeed = lerpTowards(
        smoothedSpeed,
        rawSpeed,
        active.speedSmoothRate * stepDt,
      );
      const s = smoothedSpeed;

      // 2. Compute target weights across the four speed bands.
      let tIdle = 0;
      let tWalk = 0;
      let tRun = 0;

      if (s < active.speedThreshold) {
        tIdle = 1;
      } else if (active.walkSpeed <= active.speedThreshold || s < active.walkSpeed) {
        if (active.walkSpeed <= active.speedThreshold) {
          // Degenerate config: threshold >= walkSpeed. Fall straight to walk.
          tWalk = 1;
        } else {
          const t = Math.min(
            1,
            (s - active.speedThreshold) / (active.walkSpeed - active.speedThreshold),
          );
          tIdle = 1 - t;
          tWalk = t;
        }
      } else if (active.runSpeed <= active.walkSpeed || s < active.runSpeed) {
        if (active.runSpeed <= active.walkSpeed) {
          // No meaningful run band; pin walk.
          tWalk = 1;
        } else {
          const t = Math.min(1, (s - active.walkSpeed) / (active.runSpeed - active.walkSpeed));
          tWalk = 1 - t;
          tRun = t;
        }
      } else {
        tRun = 1;
      }

      // 3. Smooth current weights toward their targets.
      const blendDelta = active.blendSpeed * stepDt;
      idleWeight = lerpTowards(idleWeight, tIdle, blendDelta);
      walkWeight = lerpTowards(walkWeight, tWalk, blendDelta);
      runWeight = lerpTowards(runWeight, tRun, blendDelta);

      // 4. Scale playback rate to match movement speed (prevents foot-sliding).
      let targetSpeedRatio = 1;
      if (s > active.speedThreshold) {
        const baseSpeed =
          runWeight > walkWeight && active.runSpeed > 0
            ? active.runSpeed
            : active.walkSpeed;
        if (baseSpeed > 0) {
          targetSpeedRatio = Math.max(
            active.minSpeedRatio,
            Math.min(active.maxSpeedRatio, s / baseSpeed),
          );
        }
      }
      speedRatio = lerpTowards(speedRatio, targetSpeedRatio, 2 * stepDt);

      // 5. Resolve dominant state.
      const prev = state;
      if (idleWeight > walkWeight && idleWeight > runWeight) {
        state = 'idle';
      } else if (runWeight > walkWeight) {
        state = 'run';
      } else {
        state = 'walk';
      }

      return {
        idleWeight,
        walkWeight,
        runWeight,
        speedRatio,
        state,
        stateChanged: prev !== state,
        smoothedSpeed,
      };
    },

    getState() {
      return snapshot();
    },

    getParams() {
      return active;
    },

    setParams(partial) {
      Object.assign(active, partial);
    },

    reset() {
      Object.assign(active, DEFAULT_ANIMATION_PARAMS);
      idleWeight = 1;
      walkWeight = 0;
      runWeight = 0;
      speedRatio = 1;
      smoothedSpeed = 0;
      state = 'idle';
    },
  };
}
