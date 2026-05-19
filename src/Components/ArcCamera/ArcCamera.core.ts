/**
 * ArcCamera.core.ts — pure data Component for an orbiting arc camera.
 * Zero imports from @babylonjs, three, or the DOM.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { ArcCameraSpec, CameraHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface ArcCameraInput {
  target?: string;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  minBeta?: number;
  maxBeta?: number;
  allowBelowGround?: boolean;
  alpha?: number;
  beta?: number;
  inertia?: number;
  panningInertia?: number;
  wheelPrecision?: number;
  angularSensibility?: number;
  speed?: number;
  targetOffset?: Vec3;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]];
}

export class ArcCameraComponent extends Component {
  target?: string;

  distance: number;
  minDistance: number;
  maxDistance: number;

  minBeta: number;
  maxBeta: number;
  allowBelowGround: boolean;

  alpha: number;
  beta: number;

  inertia: number;
  panningInertia: number;
  wheelPrecision: number;
  angularSensibility: number;

  speed: number;

  targetOffset: Vec3;

  autoRotate: boolean;
  autoRotateSpeed: number;

  handle?: CameraHandle;
  initialized = false;

  // Change-detection snapshots; updated by the System after each adapter read.
  lastAlpha = 0;
  lastBeta = 0;
  lastRadius = 0;

  constructor(data: ArcCameraInput = {}) {
    super();
    this.target = data.target;
    this.distance = data.distance ?? 15;
    this.minDistance = data.minDistance ?? 5;
    this.maxDistance = data.maxDistance ?? 50;
    this.allowBelowGround = data.allowBelowGround ?? false;
    this.minBeta = data.minBeta ?? 0.1;
    this.maxBeta = data.maxBeta ?? (this.allowBelowGround ? Math.PI - 0.1 : Math.PI / 2 - 0.1);
    this.alpha = data.alpha ?? Math.PI / 2;
    this.beta = data.beta ?? Math.PI / 3;
    this.inertia = data.inertia ?? 0.9;
    this.panningInertia = data.panningInertia ?? 0.9;
    this.wheelPrecision = data.wheelPrecision ?? 50;
    this.angularSensibility = data.angularSensibility ?? 1000;
    this.speed = data.speed ?? 1;
    this.targetOffset = data.targetOffset ? cloneVec3(data.targetOffset) : [0, 0, 0];
    this.autoRotate = data.autoRotate ?? false;
    this.autoRotateSpeed = data.autoRotateSpeed ?? 0.5;
  }

  toSpec(): ArcCameraSpec {
    return {
      alpha: this.alpha,
      beta: this.beta,
      radius: this.distance,
      minRadius: this.minDistance,
      maxRadius: this.maxDistance,
      minBeta: this.minBeta,
      maxBeta: this.maxBeta,
      target: [0, 0, 0],
      inertia: this.inertia,
      wheelPrecision: this.wheelPrecision,
      angularSensibility: this.angularSensibility,
    };
  }

  serialize(): ArcCameraInput {
    return {
      target: this.target,
      distance: this.distance,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      minBeta: this.minBeta,
      maxBeta: this.maxBeta,
      allowBelowGround: this.allowBelowGround,
      alpha: this.alpha,
      beta: this.beta,
      inertia: this.inertia,
      panningInertia: this.panningInertia,
      wheelPrecision: this.wheelPrecision,
      angularSensibility: this.angularSensibility,
      speed: this.speed,
      targetOffset: cloneVec3(this.targetOffset),
      autoRotate: this.autoRotate,
      autoRotateSpeed: this.autoRotateSpeed,
    };
  }
}
