/**
 * TwinStickEnemy — definitions.
 *
 * Holds the `TwinStickEnemyComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name TwinStickEnemy in a query, or type an event it listens
 * for, without pulling TwinStickEnemy's behaviour into its own bundle.
 * Import from here, not from TwinStickEnemy.ts.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface TwinStickEnemyInput {
  speed?: number
  spawnerId?: string
  /** Points awarded to the player on kill. */
  pointsOnKill?: number
  /** XZ distance below which this enemy pushes against another. */
  separationRadius?: number
  /** XZ distance below which this enemy damages the player on contact. */
  contactRange?: number
  /** Damage dealt per contact event. HealthSystem's i-frames pace the rate. */
  contactDamage?: number
  /** Tag of the entity to chase + damage on contact. */
  targetTag?: string
  /** Arena half-extents to clamp the enemy inside (0 = unbounded). */
  arenaHalfWidth?: number
  arenaHalfDepth?: number
  /**
   * Optional animation clip names. When `walkClip` is set, TwinStickEnemySystem drives a
   * SkeletonAnimator on the same entity: it loops `walkClip` while chasing,
   * switches to `attackClip` within contact range, and on death plays one of
   * `deathClips` (chosen at random) once, re-parking only after it completes.
   * Empty = no animation (the classic sphere enemy).
   */
  walkClip?: string
  attackClip?: string
  /** Death clips; one is chosen at random per death. Empty = no death animation. */
  deathClips?: string[]
  /**
   * Directional death clips. When the killing shot's direction is known, the
   * clip is chosen by where it hit relative to the robot's facing instead of at
   * random: a hit to the FRONT (robot facing the shooter) plays a `fallBackClips`
   * entry, a hit to the BACK (facing away) plays a `fallForwardClips` entry.
   * Leave both empty to keep the random `deathClips` behaviour.
   */
  fallBackClips?: string[]
  fallForwardClips?: string[]
  /** Multiplier on contactRange for the attack→walk exit threshold (anti-flicker). */
  attackRangeHysteresis?: number
  /** Seconds to fade the model out after its death clip finishes, before recycling. */
  deathFadeSeconds?: number
  /**
   * On death (animated enemies only), the corpse is blown back along the
   * killing shot at this initial speed (units/sec) and barrels into the swarm.
   * 0 = no knockback (die in place).
   */
  knockbackSpeed?: number
  /** Per-second exponential decay of the knockback slide (higher = stops sooner). */
  knockbackDamping?: number
  /**
   * Relative mass of a corpse while it's sliding from knockback. Heavier than a
   * living enemy (weight 1) so separation shoves the living aside rather than
   * deflecting the corpse off them — that's the "knock into other robots" feel.
   */
  knockbackMass?: number
  /** Move speed while wandering (no line of sight). Usually slower than `speed`. */
  wanderSpeed?: number
  /** Seconds between picking a new wander heading. */
  wanderInterval?: number
}

export class TwinStickEnemyComponent extends Component {
  speed: number
  spawnerId: string
  pointsOnKill: number
  separationRadius: number
  contactRange: number
  contactDamage: number
  targetTag: string
  arenaHalfWidth: number
  arenaHalfDepth: number
  walkClip: string
  attackClip: string
  deathClips: string[]
  fallBackClips: string[]
  fallForwardClips: string[]
  attackRangeHysteresis: number
  deathFadeSeconds: number
  knockbackSpeed: number
  knockbackDamping: number
  knockbackMass: number
  wanderSpeed: number
  wanderInterval: number

  constructor(data: TwinStickEnemyInput = {}) {
    super()
    this.speed = data.speed ?? 2.5
    this.spawnerId = data.spawnerId ?? ''
    this.pointsOnKill = data.pointsOnKill ?? 100
    this.separationRadius = data.separationRadius ?? 1.0
    this.contactRange = data.contactRange ?? 1.1
    this.contactDamage = data.contactDamage ?? 1
    this.targetTag = data.targetTag ?? 'player'
    this.arenaHalfWidth = data.arenaHalfWidth ?? 0
    this.arenaHalfDepth = data.arenaHalfDepth ?? 0
    this.walkClip = data.walkClip ?? ''
    this.attackClip = data.attackClip ?? ''
    this.deathClips = data.deathClips ? [...data.deathClips] : []
    this.fallBackClips = data.fallBackClips ? [...data.fallBackClips] : []
    this.fallForwardClips = data.fallForwardClips ? [...data.fallForwardClips] : []
    this.attackRangeHysteresis = data.attackRangeHysteresis ?? 1.15
    this.deathFadeSeconds = data.deathFadeSeconds ?? 0.6
    this.knockbackSpeed = data.knockbackSpeed ?? 12
    this.knockbackDamping = data.knockbackDamping ?? 6
    this.knockbackMass = data.knockbackMass ?? 5
    this.wanderSpeed = data.wanderSpeed ?? 1.8
    this.wanderInterval = data.wanderInterval ?? 2.0
  }

  serialize(): TwinStickEnemyInput {
    return {
      speed: this.speed,
      spawnerId: this.spawnerId,
      pointsOnKill: this.pointsOnKill,
      separationRadius: this.separationRadius,
      contactRange: this.contactRange,
      contactDamage: this.contactDamage,
      targetTag: this.targetTag,
      arenaHalfWidth: this.arenaHalfWidth,
      arenaHalfDepth: this.arenaHalfDepth,
      walkClip: this.walkClip,
      attackClip: this.attackClip,
      deathClips: [...this.deathClips],
      fallBackClips: [...this.fallBackClips],
      fallForwardClips: [...this.fallForwardClips],
      attackRangeHysteresis: this.attackRangeHysteresis,
      deathFadeSeconds: this.deathFadeSeconds,
      knockbackSpeed: this.knockbackSpeed,
      knockbackDamping: this.knockbackDamping,
      knockbackMass: this.knockbackMass,
      wanderSpeed: this.wanderSpeed,
      wanderInterval: this.wanderInterval,
    }
  }
}