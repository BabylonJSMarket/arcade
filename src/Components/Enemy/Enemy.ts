/**
 * Enemy — chases the first entity tagged "player", separates from other
 * enemies so they don't stack, and deals contact damage when touching the
 * player.
 *
 * HP + bullet damage: hits arrive as `enemy.hit` events (BulletSystem
 * emits); on death the system emits `enemy.killed` and `score.add`.
 *
 * Contact damage: when an enemy is closer to the player than its
 * `contactRange`, it emits `health.damage` on the player. HealthSystem
 * absorbs subsequent hits during its invulnerability window, so the
 * player can survive briefly walking through a cluster.
 *
 * Separation: per-frame pairwise pass — if two enemies overlap each other's
 * `separationRadius`, the pair gets pushed apart (split by mass; equal mass =
 * half each). O(n²) over the live enemy count, which is small (a few dozen).
 *
 * Knockback: on death, an animated enemy is blown back along the killing shot
 * (direction taken from the bullet's `bullet.hit`) at `knockbackSpeed`, decaying
 * by `knockbackDamping`. The sliding corpse stays in the separation pass with a
 * heavier `knockbackMass`, so it barrels into the swarm and shoves the living
 * aside instead of bouncing off them.
 *
 * Chase vs wander: perception lives in LineOfSightSystem. This system just
 * listens for `lineofsight.acquired` / `lineofsight.lost` and chases while the
 * player is seen, wandering away from the crowd while it isn't. An enemy with no
 * LineOfSight component never emits, so it defaults to a plain chaser.
 */
import { System } from '@babylonjsmarket/ecs'
import type { Entity } from '@babylonjsmarket/ecs'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive'
import { EntityPoolInputEvents } from '../EntityPool/EntityPool.core'
import { SkeletonAnimatorInputEvents, SkeletonAnimatorEvents } from '../SkeletonAnimator/SkeletonAnimator.core'
import { HealthEvents, HealthInputEvents } from '../Health/Health'
import { ScoreInputEvents } from '../Score/Score'
import { BulletEvents } from '../Bullet/Bullet.core'
import { collectObstacleBoxes, resolveCircleVsBox } from '../Obstacle/Obstacle'
import { LineOfSightEvents } from '../LineOfSight/LineOfSight.core'
import {
  EnemyComponent,
  EnemyEvents,
  decideLocomotion,
  wanderHeading,
  allDeathClips,
  chooseDeathClip,
} from './Enemy.core'

export {
  EnemyComponent,
  EnemyEvents,
  decideLocomotion,
  wanderHeading,
  allDeathClips,
  chooseDeathClip,
  type EnemyInput,
} from './Enemy.core'

// Max radians a wander heading is rotated off "straight away from the crowd",
// so wanderers scatter instead of fleeing in a dead-straight radial line.
const WANDER_JITTER = 0.9

export class EnemySystem extends System {
  // Parked (pooled) enemies are inactive, so the query already excludes them —
  // no tag needed. A `dying` enemy (playing its death animation before the
  // pool re-parks it) is excluded so it stops chasing / dealing contact damage
  // while the corpse falls.
  protected query = { required: [EnemyComponent, MeshPrimitiveComponent], excludedTags: ['dying'] }
  // Enemies that (re)entered the query this frame — e.g. a pooled enemy
  // un-parked by EntityPool. MeshPrimitiveSystem repositions their mesh on that
  // same frame; committing a position here too would make two systems write the
  // one handle (an adapter race). Skip them once; they start chasing next frame.
  private newborns = new Set<string>()
  // Animation state per enemy (animated enemies only) so a clip change only
  // fires on a transition: 'walk' loops the walk clip, 'idle' stops it (freeze
  // when not moving), 'attack' stops the loop and throws punches on top.
  // Cleared on (re)spawn so the state re-emits. undefined = not yet decided.
  private animState = new Map<string, 'idle' | 'walk' | 'attack'>()
  // Enemies with a punch one-shot in flight. Gates one swing at a time; cleared
  // when the punch completes (where the hit lands) so the next swing can start.
  private punching = new Set<string>()
  // Last committed XZ per enemy, to tell whether it actually moved this frame
  // (a wall-blocked or fully-separated enemy stops walking). Cleared on respawn.
  private prevPos = new Map<string, { x: number; z: number }>()
  // Enemies fading out after their death clip: entityId → fade countdown. A
  // dying enemy is excluded from the query, so this is driven directly each
  // frame (independent of `this.entities`); on completion the slot recycles.
  private fading = new Map<string, { t: number; total: number }>()
  // Last shot direction per enemy, recorded off `bullet.hit` (normalized XZ).
  // Read when the enemy dies to aim the knockback slide; cleared on (re)spawn.
  private lastHitDir = new Map<string, { x: number; z: number }>()
  // Enemies currently sliding from a death knockback: entityId → XZ velocity.
  // Dying enemies are excluded from the query, so this drives them directly —
  // each frame we integrate + decay the slide and fold them into separation so
  // the corpse shoves the living swarm. Dropped once the slide dies out.
  private knockback = new Map<string, { vx: number; vz: number }>()
  // Per-enemy wander state. `wanderTimer` counts down to the next re-heading.
  // `facingX/facingZ` is the travel direction (matching the visual yaw), used at
  // death to pick a directional fall clip from the shot angle. Cleared on respawn.
  private ai = new Map<
    string,
    { wanderTimer: number; wanderX: number; wanderZ: number; facingX: number; facingZ: number }
  >()
  // Whether each enemy currently sees its target, fed by LineOfSightSystem's
  // `lineofsight.acquired`/`lost` events. Missing entry → not yet reported →
  // default to chasing (an enemy with no LineOfSight component just chases).
  private canSee = new Map<string, boolean>()

  protected onEntityAdded(entity: Entity): void {
    this.newborns.add(entity.id)
    // Force a fresh clip on (re)spawn — a recycled slot's animator forgot its
    // loop on park, so we must re-tell it. Also drop any in-flight punch.
    this.animState.delete(entity.id)
    this.punching.delete(entity.id)
    this.prevPos.delete(entity.id)
    // Drop any stale death-fade for a recycled slot (defensive against a
    // pool recycling a still-fading enemy under pressure).
    this.fading.delete(entity.id)
    // Clear knockback bookkeeping so a recycled slot doesn't inherit the
    // previous occupant's hit direction or a half-finished slide.
    this.lastHitDir.delete(entity.id)
    this.knockback.delete(entity.id)
    // Fresh AI state — a recycled slot must re-decide chase/wander from scratch.
    this.ai.delete(entity.id)
    // Default to chasing until LineOfSightSystem reports otherwise.
    this.canSee.delete(entity.id)
  }

  protected onInitialize(): void {
    // HP lives on the entity's HealthComponent — when HealthSystem decrements
    // it to 0 it fires `health.died`, and we do the enemy-specific post-death
    // cleanup (score award + emit `enemy.killed`). We do NOT destroy the
    // entity: it's pooled, so we ask EntityPool to re-park the slot via
    // `entityPool.release` — immediately for a plain enemy, or after the death
    // clip finishes for an animated one. HealthSystem listens for
    // `health.damage` events emitted by BulletSystem.
    // Perception lives in LineOfSightSystem; we just track the latest result
    // per enemy and let it drive chase vs wander.
    this.listen(LineOfSightEvents.ACQUIRED, (data: { entityId: string }) => {
      this.canSee.set(data.entityId, true)
    })
    this.listen(LineOfSightEvents.LOST, (data: { entityId: string }) => {
      this.canSee.set(data.entityId, false)
      // Re-path immediately instead of coasting on a stale wander heading.
      const ai = this.ai.get(data.entityId)
      if (ai) ai.wanderTimer = 0
    })
    // Record each shot's heading so a fatal hit can fling the corpse the way
    // the bullet was travelling. Fires for every hit; the latest wins.
    this.listen(
      BulletEvents.HIT,
      (data: { entityId: string; dirX?: number; dirZ?: number }) => {
        if (typeof data.dirX !== 'number' || typeof data.dirZ !== 'number') return
        const len = Math.hypot(data.dirX, data.dirZ)
        if (len < 1e-4) return
        this.lastHitDir.set(data.entityId, { x: data.dirX / len, z: data.dirZ / len })
      },
    )
    this.listen(HealthEvents.DIED, (data: { entityId: string }) => {
      const w = this.world
      if (!w) return
      const ent = w.getEntity(data.entityId)
      const e = ent?.get(EnemyComponent)
      // Only fire enemy-specific cleanup for entities that actually
      // had an EnemyComponent — Player death goes through Health's
      // respawn path and shouldn't trigger score/killed events here.
      if (!ent || !e) return
      this.eventBus.emit(EnemyEvents.KILLED, {
        entityId: data.entityId,
        spawnerId: e.spawnerId,
      })
      this.eventBus.emit(ScoreInputEvents.ADD, {
        ownerEntity: 'Player',
        points: e.pointsOnKill,
      })
      // Animated enemies fall before recycling: tag `dying` (which drops them
      // from this system's query, stopping chase/contact) and play a death clip
      // once, holding its last frame (no resume to walk). When that clip
      // finishes (`completed` below) the corpse fades out, then the slot
      // re-parks. A plain (non-animated) enemy has no death clips, so recycle
      // its slot immediately.
      if (allDeathClips(e.deathClips, e.fallBackClips, e.fallForwardClips).length > 0) {
        ent.addTag('dying')
        // Blow the corpse back along the killing shot. It keeps separating
        // (heavier, in onUpdate) so it knocks into the living swarm. No
        // recorded direction (e.g. died to contact) → just fall in place.
        const dir = this.lastHitDir.get(data.entityId)
        if (e.knockbackSpeed > 0 && dir) {
          this.knockback.set(data.entityId, {
            vx: dir.x * e.knockbackSpeed,
            vz: dir.z * e.knockbackSpeed,
          })
        }
        // Pick the fall direction from the shot angle: dot of the robot's
        // facing with the bullet's travel direction. < 0 → shot in the front
        // (faces the shooter) → fall back; >= 0 → shot in the back → fall
        // forward. null (no shot dir or facing) → random over deathClips.
        const ai = this.ai.get(data.entityId)
        let dot: number | null = null
        if (dir && ai && Math.hypot(ai.facingX, ai.facingZ) > 1e-3) {
          dot = ai.facingX * dir.x + ai.facingZ * dir.z
        }
        this.lastHitDir.delete(data.entityId)
        const clip = chooseDeathClip(
          e.deathClips,
          e.fallBackClips,
          e.fallForwardClips,
          dot,
          Math.random(),
        )
        if (clip) {
          this.eventBus.emit(SkeletonAnimatorInputEvents.PLAY_ONCE, {
            entityId: data.entityId,
            clip,
            hold: true,
          })
        }
      } else {
        this.eventBus.emit(EntityPoolInputEvents.RELEASE, { entityId: data.entityId })
      }
    })
    // One-shot finished. A death clip → fade the corpse out (driven in
    // onUpdate) then re-park, or recycle now if no fade. A punch clip → the
    // swing lands NOW: damage the target if it's still in contact, then free
    // the slot for the next swing. Pacing the hit to the punch's completion is
    // what keeps the attack rate in step with the animation.
    this.listen(
      SkeletonAnimatorEvents.COMPLETED,
      (data: { entityId: string; clip: string }) => {
        const w = this.world
        const ent = w?.getEntity(data.entityId)
        const e = ent?.get(EnemyComponent)
        if (!w || !ent || !e) return

        if (allDeathClips(e.deathClips, e.fallBackClips, e.fallForwardClips).includes(data.clip)) {
          if (e.deathFadeSeconds > 0) {
            this.fading.set(data.entityId, { t: e.deathFadeSeconds, total: e.deathFadeSeconds })
          } else {
            this.eventBus.emit(EntityPoolInputEvents.RELEASE, { entityId: data.entityId })
          }
          return
        }

        if (e.attackClip && data.clip === e.attackClip) {
          this.punching.delete(data.entityId)
          // Don't connect if the enemy started dying mid-swing (the death clip
          // overrides the punch and excludes it from the query).
          if (ent.hasTag('dying')) return
          const m = ent.get(MeshPrimitiveComponent)
          const target = w.getEntitiesByTag(e.targetTag)[0]
          const tm = target?.get(MeshPrimitiveComponent)
          if (m && target && tm) {
            const cx = tm.position[0] - m.position[0]
            const cz = tm.position[2] - m.position[2]
            if (cx * cx + cz * cz <= e.contactRange * e.contactRange) {
              this.eventBus.emit(HealthInputEvents.DAMAGE, {
                entityId: target.id,
                damage: e.contactDamage,
                source: data.entityId,
              })
            }
          }
        }
      },
    )
  }

  protected onShutdown(): void {
    this.animState.clear()
    this.punching.clear()
    this.prevPos.clear()
    this.fading.clear()
    this.lastHitDir.clear()
    this.knockback.clear()
    this.ai.clear()
    this.canSee.clear()
  }

  protected onUpdate(dt: number): void {
    const w = this.world
    const r = w?.renderer
    // Consume this frame's newborns: they're skipped exactly once (their mesh
    // was just positioned at creation), then driven normally from next frame.
    const newborns = this.newborns
    this.newborns = new Set<string>()
    if (!w || !r) return

    // Advance death-fades. Dying enemies are excluded from the query, so this
    // runs off the `fading` map rather than `this.entities`: ramp the model's
    // alpha to 0, then release the slot back to the pool.
    if (this.fading.size > 0) {
      for (const [id, f] of this.fading) {
        f.t -= dt
        r.setModelAlpha(id, f.t <= 0 ? 0 : f.t / f.total)
        if (f.t <= 0) {
          this.fading.delete(id)
          this.eventBus.emit(EntityPoolInputEvents.RELEASE, { entityId: id })
        }
      }
    }

    // Snapshot of (enemy, EnemyComponent, MeshPrimitiveComponent) so the
    // separation pass can mutate positions in-place without re-querying.
    const live: Array<{ id: string; e: EnemyComponent; m: MeshPrimitiveComponent }> = []
    for (const ent of this.entities) {
      if (newborns.has(ent.id)) continue
      const e = ent.get(EnemyComponent)
      const m = ent.get(MeshPrimitiveComponent)
      if (e && m?.handle) live.push({ id: ent.id, e, m })
    }

    // Snapshot corpses still sliding from a death knockback. They're tagged
    // `dying` (so excluded from the query above), but still occupy space:
    // integrate + decay their slide here, then fold them into separation so a
    // blown-back corpse barrels into the living swarm and shoves it aside.
    const knocked: Array<{ e: EnemyComponent; m: MeshPrimitiveComponent }> = []
    for (const [id, kv] of this.knockback) {
      const ent = w.getEntity(id)
      const e = ent?.get(EnemyComponent)
      const m = ent?.get(MeshPrimitiveComponent)
      if (!ent || !ent.active || !e || !m?.handle) {
        this.knockback.delete(id)
        continue
      }
      m.position[0] += kv.vx * dt
      m.position[2] += kv.vz * dt
      const decay = Math.exp(-e.knockbackDamping * dt)
      kv.vx *= decay
      kv.vz *= decay
      knocked.push({ e, m })
      // Stop tracking once the slide all but dies out — the corpse holds its
      // resting spot and fades on its own.
      if (Math.hypot(kv.vx, kv.vz) < 0.1) this.knockback.delete(id)
    }

    if (live.length === 0 && knocked.length === 0) return

    // Living enemies share the same `targetTag` (per-entity input, but in
    // practice one shared target). Grab the first match — if the scene has no
    // such entity (or there are no living enemies), we skip chase + contact but
    // still run separation so corpses and any swarm don't stack.
    const targetTag = live[0]?.e.targetTag
    const targets = targetTag ? w.getEntitiesByTag(targetTag) : []
    const target = targets[0]
    const targetMesh = target?.get(MeshPrimitiveComponent)
    const targetId = target?.id

    // Obstacle footprints this frame: every barrier blocks movement (resolved
    // after separation). Static, so collect once. (Sight occlusion now lives in
    // LineOfSightSystem.)
    const obstacleBoxes = collectObstacleBoxes(w)

    // Crowd centroid (XZ) of the living swarm — wanderers steer away from it so
    // the pack spreads out instead of all funnelling onto the player.
    let crowdX = 0
    let crowdZ = 0
    for (const { m } of live) {
      crowdX += m.position[0]
      crowdZ += m.position[2]
    }
    crowdX /= live.length
    crowdZ /= live.length

    // CHASE vs WANDER — driven by LineOfSightSystem's acquired/lost events
    // (default: chase until told otherwise). Sees the player → walk straight at
    // it (planting in contact range). Can't see it (buried in the pack, behind
    // a wall, or outside its FOV) → wander away from the crowd, so the swarm
    // fans out and flanks instead of single-filing the player.
    for (const { id, e, m } of live) {
      let ai = this.ai.get(id)
      if (!ai) {
        ai = { wanderTimer: 0, wanderX: 0, wanderZ: 0, facingX: 0, facingZ: 0 }
        this.ai.set(id, ai)
      }
      const canSee = this.canSee.get(id) ?? true

      if (canSee && targetMesh) {
        const dx = targetMesh.position[0] - m.position[0]
        const dz = targetMesh.position[2] - m.position[2]
        const len = Math.hypot(dx, dz)
        // A chaser faces the player even when planted in contact range, so track
        // facing here (before the movement guard).
        if (len > 1e-4) {
          ai.facingX = dx / len
          ai.facingZ = dz / len
        }
        // Plant once in contact range: hold position so the punch plays
        // sustained instead of pushing through the player.
        if (len > e.contactRange) {
          m.position[0] += (dx / len) * e.speed * dt
          m.position[2] += (dz / len) * e.speed * dt
        }
      } else {
        // WANDER — re-pick a heading away from the crowd every `wanderInterval`,
        // then drift along it. Confinement (below) keeps it inside the arena.
        ai.wanderTimer -= dt
        if (ai.wanderTimer <= 0) {
          ai.wanderTimer = e.wanderInterval
          const jitter = (Math.random() * 2 - 1) * WANDER_JITTER
          const [hx, hz] = wanderHeading(
            m.position[0] - crowdX,
            m.position[2] - crowdZ,
            jitter,
            Math.random() * Math.PI * 2,
          )
          ai.wanderX = hx
          ai.wanderZ = hz
        }
        m.position[0] += ai.wanderX * e.wanderSpeed * dt
        m.position[2] += ai.wanderZ * e.wanderSpeed * dt
        ai.facingX = ai.wanderX
        ai.facingZ = ai.wanderZ
      }

      // Aim the model: write the AI's facing (player-ward while chasing, the
      // heading while wandering) onto the proxy's rotation. The follow mesh
      // (faceMode:'proxy') copies it, so a planted, crowded robot keeps facing
      // the player instead of spinning toward separation nudges.
      if (Math.hypot(ai.facingX, ai.facingZ) > 1e-4) {
        m.rotation[1] = Math.atan2(ai.facingX, ai.facingZ)
      }
    }

    // SEPARATION — pairwise push apart over every body that occupies space:
    // living enemies (weight 1) plus knocked-back corpses (weight
    // `knockbackMass`, heavier). O(n²) is fine for the small live count. The
    // pair splits the overlap by mass: equal weights → half each (the original
    // behaviour), while a heavy sliding corpse barely deflects and the light
    // living enemy it hits takes most of the push — so it gets knocked aside.
    const bodies: Array<{ e: EnemyComponent; m: MeshPrimitiveComponent; weight: number }> = []
    for (const l of live) bodies.push({ e: l.e, m: l.m, weight: 1 })
    for (const k of knocked) bodies.push({ e: k.e, m: k.m, weight: k.e.knockbackMass })
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!
        const b = bodies[j]!
        const dx = b.m.position[0] - a.m.position[0]
        const dz = b.m.position[2] - a.m.position[2]
        const dist = Math.hypot(dx, dz)
        const minDist = a.e.separationRadius + b.e.separationRadius
        if (dist >= minDist || dist < 1e-4) continue
        const overlap = minDist - dist
        const ux = dx / dist
        const uz = dz / dist
        // Lighter body takes the larger share of the push.
        const total = a.weight + b.weight
        const pushA = overlap * (b.weight / total)
        const pushB = overlap * (a.weight / total)
        a.m.position[0] -= ux * pushA
        a.m.position[2] -= uz * pushA
        b.m.position[0] += ux * pushB
        b.m.position[2] += uz * pushB
      }
    }

    // CONFINE — keep bodies inside the arena (chase, separation, and knockback
    // can push an edge body past the walls). 0 = unbounded.
    for (const { e, m } of bodies) {
      if (e.arenaHalfWidth > 0) {
        m.position[0] = clamp(m.position[0], -e.arenaHalfWidth, e.arenaHalfWidth)
      }
      if (e.arenaHalfDepth > 0) {
        m.position[2] = clamp(m.position[2], -e.arenaHalfDepth, e.arenaHalfDepth)
      }
    }

    // OBSTACLES — every barrier (full or low cover) blocks movement; push each
    // body's circle out of any box it ended up overlapping. Runs last so it has
    // the final say over chase/wander/separation/knockback motion.
    if (obstacleBoxes.length > 0) {
      for (const { m } of bodies) {
        const radius = m.diameter > 0 ? m.diameter / 2 : 0.5
        for (const b of obstacleBoxes) {
          const [nx, nz] = resolveCircleVsBox(m.position[0], m.position[2], radius, b)
          m.position[0] = nx
          m.position[2] = nz
        }
      }
    }

    // Commit the sliding corpses' positions. They're dead — no contact damage
    // or locomotion anim, just the moved transform under their death clip.
    for (const { m } of knocked) {
      r.setMeshPosition(m.handle!, m.position[0], m.position[1], m.position[2])
    }

    // Commit living positions to the renderer, then drive contact + animation.
    if (targetMesh && targetId) {
      for (const { id, e, m } of live) {
        r.setMeshPosition(m.handle!, m.position[0], m.position[1], m.position[2])
        const cx = targetMesh.position[0] - m.position[0]
        const cz = targetMesh.position[2] - m.position[2]
        const inContact = cx * cx + cz * cz <= e.contactRange * e.contactRange

        if (e.walkClip) {
          // Animated enemy: idle / walk / attack. The hit no longer fires every
          // frame — it lands on each punch's completion (in the COMPLETED
          // listener above), so the attack rate matches the punch animation.
          const dist = Math.hypot(cx, cz)
          const prev = this.animState.get(id)
          const basis = prev === 'attack' ? 'attack' : 'walk'
          const attacking =
            !!e.attackClip &&
            decideLocomotion(dist, e.contactRange, basis, e.attackRangeHysteresis) === 'attack'

          // Did it actually move? Enemies face their travel direction, so a still
          // enemy isn't rotating either — a wall-blocked or fully-separated one
          // reads as not moving and stops the walk cycle.
          const pp = this.prevPos.get(id)
          const moved = pp ? Math.hypot(m.position[0] - pp.x, m.position[2] - pp.z) : Infinity
          const moving = moved > 1e-3 + e.speed * dt * 0.1

          const next: 'idle' | 'walk' | 'attack' = attacking ? 'attack' : moving ? 'walk' : 'idle'
          if (next !== prev) {
            this.animState.set(id, next)
            if (next === 'walk') {
              this.eventBus.emit(SkeletonAnimatorInputEvents.SET_LOOP, { entityId: id, clip: e.walkClip })
            } else {
              // idle OR attack: stop the base loop ('' freezes the current
              // frame). For attack the punch one-shots play on top, so the model
              // doesn't shuffle its feet between swings.
              this.eventBus.emit(SkeletonAnimatorInputEvents.SET_LOOP, { entityId: id, clip: '' })
              if (next === 'attack') this.punching.delete(id) // let the first swing fire now
            }
          }
          // Keep swinging while in range — one punch at a time; the hit lands on
          // its completion (above).
          if (next === 'attack' && !this.punching.has(id)) {
            this.punching.add(id)
            this.eventBus.emit(SkeletonAnimatorInputEvents.PLAY_ONCE, { entityId: id, clip: e.attackClip })
          }
        } else if (inContact) {
          // Plain (non-animated) enemy: damage every frame in contact, paced by
          // HealthSystem's i-frames — the original behaviour.
          this.eventBus.emit(HealthInputEvents.DAMAGE, {
            entityId: targetId,
            damage: e.contactDamage,
            source: id,
          })
        }

        this.prevPos.set(id, { x: m.position[0], z: m.position[2] })
      }
    } else {
      // No target — only positions need committing.
      for (const { id, m } of live) {
        r.setMeshPosition(m.handle!, m.position[0], m.position[1], m.position[2])
        this.prevPos.set(id, { x: m.position[0], z: m.position[2] })
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
