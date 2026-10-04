/**
 * Physics — definitions.
 *
 * Holds the `PhysicsComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Physics in a query, or type an event it listens for, without pulling
 * Physics's behaviour into its own bundle. Import from here, not from
 * Physics.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { PhysicsBodyOpts } from '@babylonjsmarket/ecs/renderer-types';
// ============================================
// Events
// ============================================

export interface PhysicsSetVelocityEvent {
  entityId: string;
  vx: number;
  vy: number;
  vz: number;
}

export interface PhysicsSetTimeStepEvent {
  hz: number;
}

export interface PhysicsSetGravityEvent {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsSetRestitutionEvent {
  entityId: string;
  restitution: number;
}

export interface PhysicsSetCollidersVisibleEvent {
  visible: boolean;
}

// ============================================
// Component
// ============================================

/**
 * `'mesh'` collides with the mesh's own triangles — static or kinematic bodies
 * only; a dynamic body asking for it gets its bounding box. The shape for a
 * procedural rock, a level piece, anything whose silhouette a box lies about.
 */
export type PhysicsShapeTypeName = 'sphere' | 'box' | 'capsule' | 'mesh';

export type PhysicsMotionTypeName = 'dynamic' | 'static' | 'kinematic';

export interface PhysicsInput {
  shapeType?: PhysicsShapeTypeName;
  motionType?: PhysicsMotionTypeName;
  mass?: number;
  friction?: number;
  restitution?: number;
  lockRotation?: boolean;
  /**
   * When true (default), the System calls `physicsCreateBody` automatically
   * once the sibling MeshPrimitive's handle is ready. Set false to hand-drive
   * body creation (e.g., respawn flows that want to re-pose the mesh first).
   */
  autoCreate?: boolean;
  /**
   * Engine fixed simulation rate in Hertz. Applied once at system init via
   * `physicsSetTimeStep` and updateable live via the SET_TIME_STEP event
   * (e.g. the Physics debugger panel slider). The Hz lives on the component
   * so a scene-author can pin a higher rate per-game (pinball wants ~240).
   * Only one PhysicsComponent's `simulationHz` is consulted — the first one
   * encountered. Default 60.
   */
  simulationHz?: number;
}

export class PhysicsComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Physics must still match a copy in the project.
  static componentType = 'Physics';

  shapeType: PhysicsShapeTypeName;
  motionType: PhysicsMotionTypeName;
  mass: number;
  friction: number;
  restitution: number;
  lockRotation: boolean;
  autoCreate: boolean;
  simulationHz: number;

  /** Populated by the System once `physicsCreateBody` has run for this entity. */
  isCreated = false;

  constructor(data: PhysicsInput = {}) {
    super();
    this.shapeType = data.shapeType ?? 'sphere';
    // Mirror legacy default: a zero-mass body should be static even if the
    // caller omits `motionType`.
    this.motionType = data.motionType ?? (data.mass === 0 ? 'static' : 'dynamic');
    this.mass = data.mass ?? 1;
    this.friction = data.friction ?? 0.5;
    this.restitution = data.restitution ?? 0.5;
    this.lockRotation = data.lockRotation ?? false;
    this.autoCreate = data.autoCreate ?? true;
    this.simulationHz = data.simulationHz ?? 60;
  }

  toBodyOpts(): PhysicsBodyOpts {
    return {
      shapeType: this.shapeType,
      motionType: this.motionType,
      mass: this.mass,
      friction: this.friction,
      restitution: this.restitution,
      lockRotation: this.lockRotation,
    };
  }

  serialize(): PhysicsInput {
    return {
      shapeType: this.shapeType,
      motionType: this.motionType,
      mass: this.mass,
      friction: this.friction,
      restitution: this.restitution,
      lockRotation: this.lockRotation,
      autoCreate: this.autoCreate,
      simulationHz: this.simulationHz,
    };
  }
}

// ============================================
// Adapter plugin
// ============================================

/**
 * Name every component that needs a physics capability beyond create/step/
 * destroy looks the plugin up under.
 *
 * These six calls used to sit on the shared RendererAdapter. Each had exactly
 * one caller — Asteroid cast rays, Flipper reshaped a box, Plunger spun a body
 * and took its pre-step away — so each was a six-file change across four
 * adapters to serve one premium component, and Havok's cast plumbing lived in
 * the free `ecs` package forever.
 *
 * They belong together, and they belong HERE. Physics is the free core
 * component that already owns the body lifecycle; a raycast is not Asteroid's
 * private trick, it is the thing anyone with a body eventually wants. Putting
 * them behind one extension keeps a second component from writing a second
 * raycast, without the shared interface growing a method per caller.
 */
export const PHYSICS_EXTENSION = 'physicsQueriesAndBodyOps'

/** Where a cast landed. `meshId` is the body's mesh, not the caster's. */
export interface PhysicsQueryHit {
  meshId: string
  point: [number, number, number]
  normal: [number, number, number]
  /** World units from the cast's start to the contact. */
  distance: number
}

/** What the engine plugin has to be able to do. */
export interface PhysicsExtension {
  /**
   * Does this engine answer scene queries at all, right now?
   *
   * Both halves matter. Three's Rapier path and Lite have no casts to give, and
   * even under Havok the WASM lands a few frames after the scene does — so a
   * caller polls this and keeps its own geometry fallback until it turns true,
   * rather than reading a null hit as "nothing there".
   */
  canQuery(): boolean
  /** Nearest body along `from → to`, or null. The thin-projectile test. */
  raycast(from: readonly number[], to: readonly number[]): PhysicsQueryHit | null
  /**
   * A sphere of `radius` swept along `from → to`: the nearest body it touches,
   * or null. The moving-hull test — a ship is a sphere, a rock is a mesh, and
   * the sweep catches a contact that happened between two frames.
   */
  sphereCast(from: readonly number[], to: readonly number[], radius: number): PhysicsQueryHit | null
  /**
   * Hot-swap a body's collider for a box of `halfExtents`, keeping its motion
   * type, mass, restitution, friction, pose and velocity. For a collider that
   * has to track a mesh whose geometry changes under it — a flipper bat
   * swinging through its own swept volume.
   */
  resizeBoxBody(meshId: string, halfExtents: readonly number[]): void
  /** Spin a body directly, in radians/second about each world axis. */
  setBodyAngularVelocity(meshId: string, vx: number, vy: number, vz: number): void
  /**
   * `true` → the engine reads the mesh transform into the body each step;
   * `false` → physics owns the transform, so a teleport is not overwritten.
   */
  setBodyDrivenByMesh(meshId: string, drivenByMesh: boolean): void
}
