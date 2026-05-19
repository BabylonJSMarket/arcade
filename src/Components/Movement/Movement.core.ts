/**
 * Movement — pure core.
 *
 * Kinematic character movement with jumping and grounding. The core consumes
 * an input intent (move vector `[x,y,z]` on the XZ plane + jump pressed) and a
 * per-frame grounding cue (a `groundY` for the column directly beneath the
 * character — the renderer supplies this via a raycast or a flat-floor
 * assumption), and returns the next position and velocity.
 *
 * The caller (System) is the bridge between the renderer and the core: it
 * reads the mesh's current position, hands it to the core, and writes the
 * result back to the renderer. All the bookkeeping — gravity integration,
 * jump impulse, ground snapping, facing yaw — happens here, in pure TS.
 *
 * No imports from @babylonjs, three, solid-js, or the DOM. Vec3 is a tuple.
 * Same (params, inputs, dt) ⇒ same outputs.
 */

import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface MovementParams {
  /** Horizontal speed at full input, world units / second. */
  speed: number;
  /** Yaw rotation speed toward movement direction, radians / second. */
  rotationSpeed: number;
  /** Vertical velocity applied on jump press, world units / second. */
  jumpForce: number;
  /** Gravity pulling the character down, world units / second^2. */
  gravity: number;
  /** Half-height of the capsule — "feet" are `feetOffset` below the pivot. */
  feetOffset: number;
  /** Terminal fall speed cap. 0 = uncapped. */
  maxFallSpeed: number;
  /** When true, the mesh yaws to face its horizontal direction of motion. */
  faceMotion: boolean;
}

export const DEFAULT_MOVEMENT_PARAMS: MovementParams = {
  speed: 5,
  rotationSpeed: Math.PI * 2,
  jumpForce: 8,
  gravity: 20,
  feetOffset: 1,
  maxFallSpeed: 50,
  faceMotion: true,
};

export interface MovementInputs {
  /** Desired horizontal motion; magnitude clamped to 1 inside the core. */
  moveX: number;
  moveZ: number;
  /** True on the frame the user pressed jump (edge-triggered). */
  jumpPressed: boolean;
  /**
   * World Y of the ground in the character's current column, or `null` if no
   * ground was found below. Renderers that want flat-floor semantics can pass
   * `0` every frame; richer games pass a raycast hit Y.
   */
  groundY: number | null;
}

export interface MovementTick {
  /** New position (pivot at character center, so feet are at `posY - feetOffset`). */
  posX: number;
  posY: number;
  posZ: number;
  /** New velocity. Horizontal components mirror the input each frame (kinematic). */
  velX: number;
  velY: number;
  velZ: number;
  /** Yaw in radians the mesh should rotate to. Unchanged when not moving. */
  yaw: number;
  /** True after integration if the character's feet touched the ground this frame. */
  isGrounded: boolean;
  /** True if horizontal input had any magnitude this frame. */
  isMoving: boolean;
  /** Edge-triggered: true only on the frame the character left the ground via jump. */
  jumpedThisFrame: boolean;
  /** Edge-triggered: true only on the frame `isGrounded` flipped. */
  groundedChanged: boolean;
}

export interface MovementState {
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
  yaw: number;
  isGrounded: boolean;
  isMoving: boolean;
}

export interface MovementInstance {
  getState(): Readonly<MovementState>;
  setPosition(x: number, y: number, z: number): void;
  setVelocity(x: number, y: number, z: number): void;
  setYaw(yaw: number): void;
  update(inputs: MovementInputs, dt: number): MovementTick;
  getParams(): Readonly<MovementParams>;
  setParams(partial: Partial<MovementParams>): void;
  reset(): void;
}

/**
 * Normalize a horizontal input vector into a [-1, 1] disc. Returns the input
 * length so callers can distinguish "holding" from "holding hard".
 */
export function clampMoveInput(x: number, z: number): { x: number; z: number; len: number } {
  const len = Math.hypot(x, z);
  if (len <= 1e-6) return { x: 0, z: 0, len: 0 };
  if (len > 1) return { x: x / len, z: z / len, len: 1 };
  return { x, z, len };
}

/**
 * Rotate current yaw toward target yaw by at most `rotationSpeed * dt`,
 * taking the shorter of the two arcs. Handles PI wrap.
 */
export function stepYaw(current: number, target: number, rotationSpeed: number, dt: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const maxStep = rotationSpeed * dt;
  if (Math.abs(delta) <= maxStep) return current + delta;
  return current + Math.sign(delta) * maxStep;
}

export function createMovement(params: Partial<MovementParams> = {}): MovementInstance {
  const active: MovementParams = { ...DEFAULT_MOVEMENT_PARAMS, ...params };
  const state: MovementState = {
    posX: 0,
    posY: 0,
    posZ: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    yaw: 0,
    isGrounded: true,
    isMoving: false,
  };

  return {
    getState() {
      return state;
    },

    setPosition(x, y, z) {
      state.posX = x;
      state.posY = y;
      state.posZ = z;
    },

    setVelocity(x, y, z) {
      state.velX = x;
      state.velY = y;
      state.velZ = z;
    },

    setYaw(yaw) {
      state.yaw = yaw;
    },

    update(inputs, dt) {
      const prevGrounded = state.isGrounded;
      const { x: ix, z: iz, len: inputLen } = clampMoveInput(inputs.moveX, inputs.moveZ);

      // Horizontal velocity is assigned from input each frame (kinematic, not
      // momentum-based). Matches the reference Movement's "move mesh by
      // desiredVelocity * speed * dt" semantics.
      state.velX = ix * active.speed;
      state.velZ = iz * active.speed;

      // Jump impulse: only honored when grounded; edge-triggered by the caller.
      let jumpedThisFrame = false;
      if (inputs.jumpPressed && state.isGrounded) {
        state.velY = active.jumpForce;
        state.isGrounded = false;
        jumpedThisFrame = true;
      }

      // Gravity integration. Clamp downward fall speed if configured.
      if (!state.isGrounded) {
        state.velY -= active.gravity * dt;
        if (active.maxFallSpeed > 0 && state.velY < -active.maxFallSpeed) {
          state.velY = -active.maxFallSpeed;
        }
      }

      // Integrate position.
      state.posX += state.velX * dt;
      state.posY += state.velY * dt;
      state.posZ += state.velZ * dt;

      // Ground resolution: snap feet to groundY when falling through it. The
      // character's pivot is at the capsule center, so feet = posY - feetOffset.
      if (inputs.groundY !== null) {
        const feetY = state.posY - active.feetOffset;
        if (state.velY <= 0 && feetY <= inputs.groundY) {
          state.posY = inputs.groundY + active.feetOffset;
          state.velY = 0;
          state.isGrounded = true;
        }
      }
      // No ground info means we stay in whatever state integration produced —
      // if the character was grounded and started falling this frame (no jump),
      // gravity will pull them off; the next frame the renderer needs to supply
      // a groundY or the character falls forever. That's the contract.
      if (inputs.groundY === null && !jumpedThisFrame && !inputs.jumpPressed) {
        // If we were grounded with no ground info, trust the previous state
        // rather than silently starting to fall.
        if (prevGrounded && state.velY === 0) {
          state.isGrounded = true;
        }
      }

      // Yaw toward horizontal direction of motion.
      if (active.faceMotion && inputLen > 1e-6) {
        const targetYaw = Math.atan2(ix, iz);
        state.yaw = stepYaw(state.yaw, targetYaw, active.rotationSpeed, dt);
      }

      state.isMoving = inputLen > 1e-6;

      return {
        posX: state.posX,
        posY: state.posY,
        posZ: state.posZ,
        velX: state.velX,
        velY: state.velY,
        velZ: state.velZ,
        yaw: state.yaw,
        isGrounded: state.isGrounded,
        isMoving: state.isMoving,
        jumpedThisFrame,
        groundedChanged: state.isGrounded !== prevGrounded,
      };
    },

    getParams() {
      return active;
    },

    setParams(partial) {
      Object.assign(active, partial);
    },

    reset() {
      state.posX = 0;
      state.posY = 0;
      state.posZ = 0;
      state.velX = 0;
      state.velY = 0;
      state.velZ = 0;
      state.yaw = 0;
      state.isGrounded = true;
      state.isMoving = false;
    },
  };
}

// Exported for parity with other mechanics; unused but imported via tuple types
// in some adapters.
export type MovementVec3 = Vec3;
