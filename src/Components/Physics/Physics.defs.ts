/**
 * Physics — definitions.
 *
 * The Physics component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Physics in a query or react to what it emits: this file carries no System, so
 * naming Physics never drags its behaviour into your bundle.
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

export type PhysicsShapeTypeName = 'sphere' | 'box' | 'capsule';

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