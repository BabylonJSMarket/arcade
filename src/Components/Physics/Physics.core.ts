/**
 * Physics — pure core.
 *
 * A minimal rigid-body world used by adapters that don't have a dedicated
 * physics engine (ThreeAdapter today, MockRendererAdapter in tests). Tracks a
 * list of bodies by meshId, applies gravity each step, integrates forward with
 * plain Euler, clamps bodies to a ground plane at y=0, and exposes each body's
 * current position so the adapter can push it back to the 3D mesh.
 *
 * No imports from @babylonjs, three, solid-js, or the DOM. Inputs and outputs
 * are primitives or tuples. Same (params, inputs) ⇒ same outputs.
 *
 * This is intentionally simpler than a real constraint solver: Babylon's
 * adapter delegates to Havok, which handles collisions, friction/restitution
 * materials, and contact manifolds. This core exists so Physics still ticks
 * predictably under renderers without a native engine.
 */

export type PhysicsShapeType = 'sphere' | 'box' | 'capsule';
export type PhysicsMotionType = 'dynamic' | 'static' | 'kinematic';

export interface PhysicsBodyOpts {
  shapeType: PhysicsShapeType;
  motionType: PhysicsMotionType;
  mass: number;
  friction: number;
  restitution: number;
  lockRotation: boolean;
  /** Initial world position for the body. */
  posX?: number;
  posY?: number;
  posZ?: number;
}

export interface PhysicsWorldParams {
  /** Vertical gravity in world units / sec^2 (negative = pulls downward). */
  gravityY: number;
  /** Per-frame horizontal velocity damping. 1 = no damping. */
  linearDamping: number;
  /** When a body bottoms out at groundY, vertical velocity scales by this. */
  groundBounce: number;
  /** Plane height the body cannot fall below. Matches BouncyDemo (y=0). */
  groundY: number;
}

export const DEFAULT_PHYSICS_WORLD_PARAMS: PhysicsWorldParams = {
  gravityY: -30,
  linearDamping: 0.995,
  groundBounce: 0.35,
  groundY: 0,
};

export interface PhysicsBodyState {
  meshId: string;
  shapeType: PhysicsShapeType;
  motionType: PhysicsMotionType;
  mass: number;
  friction: number;
  restitution: number;
  lockRotation: boolean;
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
}

export interface PhysicsInstance {
  /** Register a new body in the simulation. */
  createBody(meshId: string, opts: PhysicsBodyOpts): PhysicsBodyState;
  /** Remove a body. No-op if unknown. */
  destroyBody(meshId: string): void;
  /** Read snapshot of a body. Returns `undefined` for unknown ids. */
  getBody(meshId: string): Readonly<PhysicsBodyState> | undefined;
  /** Replace the linear velocity of a body. */
  setBodyVelocity(meshId: string, vx: number, vy: number, vz: number): void;
  /** Replace the position of a body. */
  setBodyPosition(meshId: string, px: number, py: number, pz: number): void;
  /** Advance every body by `dt` seconds. */
  step(dt: number): void;
  /** Iterate all bodies in insertion order. */
  bodies(): ReadonlyArray<Readonly<PhysicsBodyState>>;
  setParams(partial: Partial<PhysicsWorldParams>): void;
  getParams(): Readonly<PhysicsWorldParams>;
  /** Clear all bodies; parameters are untouched. */
  reset(): void;
}

export function createPhysics(params: Partial<PhysicsWorldParams> = {}): PhysicsInstance {
  const active: PhysicsWorldParams = { ...DEFAULT_PHYSICS_WORLD_PARAMS, ...params };
  const bodyList: PhysicsBodyState[] = [];
  const bodyById = new Map<string, PhysicsBodyState>();

  const getBody = (meshId: string) => bodyById.get(meshId);

  return {
    createBody(meshId, opts) {
      // Replace if a body under this meshId already exists so callers don't
      // have to destroyBody first on re-creation (happens during hot-reload).
      const existing = bodyById.get(meshId);
      if (existing) {
        const idx = bodyList.indexOf(existing);
        if (idx >= 0) bodyList.splice(idx, 1);
        bodyById.delete(meshId);
      }
      const body: PhysicsBodyState = {
        meshId,
        shapeType: opts.shapeType,
        motionType: opts.motionType,
        mass: opts.mass,
        friction: opts.friction,
        restitution: opts.restitution,
        lockRotation: opts.lockRotation,
        posX: opts.posX ?? 0,
        posY: opts.posY ?? 0,
        posZ: opts.posZ ?? 0,
        velX: 0,
        velY: 0,
        velZ: 0,
      };
      bodyList.push(body);
      bodyById.set(meshId, body);
      return body;
    },

    destroyBody(meshId) {
      const body = bodyById.get(meshId);
      if (!body) return;
      const idx = bodyList.indexOf(body);
      if (idx >= 0) bodyList.splice(idx, 1);
      bodyById.delete(meshId);
    },

    getBody,

    setBodyVelocity(meshId, vx, vy, vz) {
      const body = bodyById.get(meshId);
      if (!body) return;
      body.velX = vx;
      body.velY = vy;
      body.velZ = vz;
    },

    setBodyPosition(meshId, px, py, pz) {
      const body = bodyById.get(meshId);
      if (!body) return;
      body.posX = px;
      body.posY = py;
      body.posZ = pz;
    },

    step(dt) {
      // Clamp dt so a stutter can't throw bodies off the map.
      const clampedDt = Math.max(0, Math.min(dt, 0.1));
      for (let i = 0; i < bodyList.length; i++) {
        const b = bodyList[i];
        if (b.motionType === 'static') continue;

        // Kinematic bodies ignore gravity — caller drives them via setBodyVelocity / setBodyPosition.
        if (b.motionType !== 'kinematic') {
          b.velY += active.gravityY * clampedDt;
        }

        // Integrate.
        b.posX += b.velX * clampedDt;
        b.posY += b.velY * clampedDt;
        b.posZ += b.velZ * clampedDt;

        // Horizontal damping. Matches how Havok's `linearDamping` attenuates motion per step.
        b.velX *= active.linearDamping;
        b.velZ *= active.linearDamping;

        // Ground plane: reflect vertical velocity by restitution * groundBounce.
        if (b.posY < active.groundY) {
          b.posY = active.groundY;
          b.velY = Math.abs(b.velY) * b.restitution * active.groundBounce;
          // Apply friction on the ground tick to bleed off sliding speed.
          b.velX *= 1 - b.friction;
          b.velZ *= 1 - b.friction;
          // Snap tiny residual bounces to rest so bodies actually settle.
          if (b.velY < 0.01) b.velY = 0;
        }
      }
    },

    bodies() {
      return bodyList;
    },

    setParams(partial) {
      Object.assign(active, partial);
    },

    getParams() {
      return active;
    },

    reset() {
      bodyList.length = 0;
      bodyById.clear();
    },
  };
}
