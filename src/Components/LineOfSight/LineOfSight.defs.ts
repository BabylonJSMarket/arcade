/**
 * LineOfSight — definitions.
 *
 * The LineOfSight component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * LineOfSight in a query or react to what it emits: this file carries no System, so
 * naming LineOfSight never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
export interface LineOfSightInput {
  /** Tag of the entity to look for. */
  targetTag?: string
  /** Field-of-view cone width in degrees (>=360 = omnidirectional). */
  fov?: number
  /** Max sight distance (0 = unbounded). */
  range?: number
  /** Rays fanned across the target's width (1 = a single centre ray). */
  rayCount?: number
  /** Radius another body occupies as a ray blocker (also the fan half-width). */
  blockRadius?: number
  /** Seconds between sight re-checks. */
  interval?: number
}

export class LineOfSightComponent extends Component {
  targetTag: string
  fov: number
  range: number
  rayCount: number
  blockRadius: number
  interval: number

  constructor(data: LineOfSightInput = {}) {
    super()
    this.targetTag = data.targetTag ?? 'player'
    this.fov = data.fov ?? 220
    this.range = data.range ?? 32
    this.rayCount = data.rayCount ?? 3
    this.blockRadius = data.blockRadius ?? 0.6
    this.interval = data.interval ?? 1.5
  }

  serialize(): LineOfSightInput {
    return {
      targetTag: this.targetTag,
      fov: this.fov,
      range: this.range,
      rayCount: this.rayCount,
      blockRadius: this.blockRadius,
      interval: this.interval,
    }
  }
}

/** Emitted by LineOfSightSystem when an entity's visibility of its target flips. */
/** Listened to by LineOfSightSystem — toggles the ray-cast debug helpers. */
/** An XZ point that blocks sightlines — in practice another body's position. */
export interface Occluder {
  x: number
  z: number
}