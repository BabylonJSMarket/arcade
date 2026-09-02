/**
 * FirstPersonCamera — a walk-around, eye-height first-person camera driven by
 * the keyboard. Creates a FREE perspective camera through the RendererAdapter
 * and poses it every frame; W/S walk, A/D turn (tank), Q/E strafe, always at a
 * fixed eye height. Optional `bounds` keep the player inside the room, and
 * the scene's Obstacle footprints keep them out of the furniture: every step
 * — a key press or a GOTO auto-walk — goes through the pure sweep in
 * FirstPersonCamera.core.ts, which slides the player along a cabinet face
 * rather than stopping them dead.
 *
 * Zero imports from @babylonjs or three — the camera is created and posed
 * entirely through `world.renderer` (createPerspectiveCamera / setCameraPose),
 * so the same component runs under the Babylon and Three adapters unchanged.
 */

import { System } from '@babylonjsmarket/ecs';
import type { Entity, EventBus } from '@babylonjsmarket/ecs';
import type { CameraHandle, Quaternion, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { KeyboardInputEvents } from '../../inputEvents';
import { FirstPersonCameraEvents } from '../../events';
import { collectObstacleBoxes, type ObstacleBox } from '../Obstacle/Obstacle';
import { readPose, resolveWalk, writePose, type PoseStore } from './FirstPersonCamera.core';
import { FirstPersonCameraComponent } from './FirstPersonCamera.defs';

export { FirstPersonCameraComponent } from './FirstPersonCamera.defs';
export type {
  FirstPersonCameraInput,
  FirstPersonCameraBounds,
} from './FirstPersonCamera.defs';
export { resolveWalk, readPose, writePose } from './FirstPersonCamera.core';
export type { PersistedPose, PoseStore, WalkPoint } from './FirstPersonCamera.core';

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const TURN_LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const TURN_RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);
const STRAFE_LEFT_KEYS = new Set(['KeyQ']);
const STRAFE_RIGHT_KEYS = new Set(['KeyE']);

/** Live (non-serializable) pose + camera handle, kept off the pure-data Component. */
interface FirstPersonCameraRuntime {
  handle?: CameraHandle;
  x: number;
  z: number;
  yaw: number;
  /**
   * An in-flight approach: where it started, where it ends, and how far through
   * it is. Held as a whole path rather than a target, because the move is a
   * timed glide, not a walk that is re-steered every frame.
   */
  goto?: {
    fromX: number; fromZ: number; fromYaw: number;
    x: number; z: number; yaw?: number;
    /** Signed shortest turn from fromYaw to the final facing. */
    dYaw: number;
    t: number;
    duration: number;
  };
  /** Seconds since the pose was last written to storage. */
  persistAccum: number;
  /** The pose last written, so an idle player costs no storage writes. */
  persisted?: { x: number; z: number; yaw: number };
}

/** Close enough to a GOTO target to call it arrived (metres / radians). */
const ARRIVE_DISTANCE = 0.05;
const ARRIVE_ANGLE = 0.02;
/** An approach shorter than this is already there; don't bother gliding. */
const APPROACH_MIN_DISTANCE = 1e-3;
/** How often the pose is remembered while the player moves, in seconds. */
const PERSIST_INTERVAL = 1;

type GotoStep = 'walking' | 'arrived';

/** Shortest signed angle from `a` to `b`, so a turn never takes the long way. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The browser's localStorage, or null where there is none (SSR, tests
 * without a DOM) or where merely touching it throws (sandboxed iframes).
 */
function poseStore(): PoseStore | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export class FirstPersonCameraSystem extends System {
  private forward = 0;
  private back = 0;
  private turnLeft = 0;
  private turnRight = 0;
  private strafeLeft = 0;
  private strafeRight = 0;

  private readonly runtime = new WeakMap<FirstPersonCameraComponent, FirstPersonCameraRuntime>();
  private readonly _quat: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
  private readonly _pos: Vec3 = [0, 0, 0];
  /** This frame's obstacle snapshot; collected on first use, dropped at frame end. */
  private frameBoxes: ObstacleBox[] | null = null;

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  protected query = { required: [FirstPersonCameraComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(KeyboardInputEvents.KEYDOWN, (e: { code: string }) => this.setKey(e.code, 1));
    // Walk-me-there requests (e.g. clicking a cabinet). Event-driven so nothing
    // needs a reference to this System.
    this.listen(FirstPersonCameraEvents.GOTO, (e: { x: number; z: number; yaw?: number }) => {
      for (const entity of this.entities) {
        const comp = entity.get(FirstPersonCameraComponent);
        if (comp) {
          const rt = this.getRuntime(comp);
          rt.goto = this.planApproach(comp, rt, e);
        }
      }
    });
    this.listen(KeyboardInputEvents.KEYUP, (e: { code: string }) => this.setKey(e.code, 0));

    // Bridge DOM keyboard events to the bus so scaffolded projects walk around
    // out of the box without a separate input-source system. Tests skip this
    // branch (no `window`) and emit the bus events directly.
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) =>
        this.eventBus.emit(KeyboardInputEvents.KEYDOWN, { code: e.code });
      this.keyupHandler = (e: KeyboardEvent) =>
        this.eventBus.emit(KeyboardInputEvents.KEYUP, { code: e.code });
      window.addEventListener('keydown', this.keydownHandler);
      window.addEventListener('keyup', this.keyupHandler);
    }

    // Systems-after-entities (live SceneLoader) path: the entity already exists
    // when we initialize, so create its camera now.
    for (const entity of this.entities) {
      const comp = entity.get(FirstPersonCameraComponent);
      if (comp) this.ensureCamera(entity, comp);
    }
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(FirstPersonCameraComponent);
    if (comp) this.ensureCamera(entity, comp);
  }

  protected onEntityRemoved(entity: Entity): void {
    // A scene swap mid-walk still remembers where you were.
    const comp = entity.get(FirstPersonCameraComponent);
    if (comp) this.persist(comp, this.getRuntime(comp), true);
  }

  protected onShutdown(): void {
    for (const entity of this.entities) {
      const comp = entity.get(FirstPersonCameraComponent);
      if (comp) this.persist(comp, this.getRuntime(comp), true);
    }
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    }
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  /**
   * The live pose for a component, seeded from its start pose — or, when it
   * has a `persistKey`, from wherever the player stood last time.
   */
  private getRuntime(comp: FirstPersonCameraComponent): FirstPersonCameraRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { x: comp.startX, z: comp.startZ, yaw: comp.yaw, persistAccum: 0 };
      const saved = comp.persistKey ? readPose(poseStore(), comp.persistKey) : null;
      if (saved) {
        rt.x = saved.x;
        rt.z = saved.z;
        rt.yaw = saved.yaw;
        rt.persisted = { ...saved };
      }
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  /** Create the perspective camera once, seeded at the component's start pose. */
  private ensureCamera(entity: Entity, comp: FirstPersonCameraComponent): void {
    const r = this.world?.renderer;
    if (!r) return;
    const rt = this.getRuntime(comp);
    if (rt.handle) return;
    rt.handle = r.createPerspectiveCamera('firstPerson', {
      fov: comp.fov,
      near: comp.near,
      far: comp.far,
      position: [rt.x, comp.eyeHeight, rt.z],
      orientation: yawQuaternion(rt.yaw, this._quat),
    });
    // Announce the handle: the audio listener (Sound) rides this camera so
    // spatial falloff is judged from the player's head, not the world origin.
    this.eventBus.emit(FirstPersonCameraEvents.CREATED, {
      entityId: entity.id,
      handle: rt.handle,
    });
  }

  /** The obstacle footprints, collected at most once per frame. */
  private boxes(): ObstacleBox[] {
    if (!this.frameBoxes) this.frameBoxes = this.world ? collectObstacleBoxes(this.world) : [];
    return this.frameBoxes;
  }

  /**
   * Move the player toward (nx, nz): the collision sweep first, then the
   * bounds clamp as the outer belt. Every step, keyed or automatic, comes
   * through here.
   */
  private moveTo(comp: FirstPersonCameraComponent, rt: FirstPersonCameraRuntime, nx: number, nz: number): void {
    if (comp.collide) {
      [nx, nz] = resolveWalk([rt.x, rt.z], [nx, nz], comp.radius, this.boxes());
    }
    rt.x = nx;
    rt.z = nz;
    this.clampToBounds(comp, rt);
  }

  /** Keep the camera inside the room rectangle. The outer belt, always on. */
  private clampToBounds(comp: FirstPersonCameraComponent, rt: FirstPersonCameraRuntime): void {
    if (!comp.bounds) return;
    rt.x = clamp(rt.x, comp.bounds.minX, comp.bounds.maxX);
    rt.z = clamp(rt.z, comp.bounds.minZ, comp.bounds.maxZ);
  }

  /**
   * Lay out an approach: a fixed-length glide from where the camera is now to
   * the spot in front of the machine, ending on the facing that looks at it.
   *
   * Held as a path rather than re-solved each frame so the motion is one smooth
   * move. Duration is fixed, not distance-based, which is what makes a click
   * across the hall and a click at your elbow both feel like one gesture.
   */
  private planApproach(
    comp: FirstPersonCameraComponent,
    rt: FirstPersonCameraRuntime,
    e: { x: number; z: number; yaw?: number },
  ): FirstPersonCameraRuntime['goto'] {
    const finalYaw = e.yaw ?? rt.yaw;
    return {
      fromX: rt.x,
      fromZ: rt.z,
      fromYaw: rt.yaw,
      x: e.x,
      z: e.z,
      yaw: e.yaw,
      // Take the short way round, so a machine behind you never spins the
      // camera the long way through 300 degrees.
      dYaw: angleDelta(rt.yaw, finalYaw),
      t: 0,
      duration: Math.max(1e-3, comp.approachDuration),
    };
  }

  /**
   * Advance an approach by `dt`.
   *
   * This is a GLIDE, and deliberately not the tank motion the keys produce.
   * Turning to face the target, walking, then turning again to face the machine
   * reads as three separate robotic moves and takes as long as the room is
   * wide. Easing position and facing together over a fixed time is what the
   * hand-written room did, and it is the thing that made clicking a cabinet
   * feel like walking up to one.
   *
   * It is also on rails: obstacles are ignored for the duration. A glide that
   * caught on a cabinet corner would stall in the open with no way to explain
   * itself, and the destination is always a clear spot in front of a machine.
   * The player still wins instantly — any movement key cancels.
   */
  private stepToward(
    comp: FirstPersonCameraComponent,
    rt: FirstPersonCameraRuntime,
    dt: number,
  ): GotoStep {
    const g = rt.goto;
    if (!g) return 'arrived';

    g.t += dt;
    const u = Math.min(1, g.t / g.duration);
    // Ease out: quick off the mark, settling into the spot rather than
    // stopping dead. Same curve the old room used.
    const k = 1 - (1 - u) * (1 - u);

    rt.x = g.fromX + (g.x - g.fromX) * k;
    rt.z = g.fromZ + (g.z - g.fromZ) * k;
    rt.yaw = g.fromYaw + g.dYaw * k;
    this.clampToBounds(comp, rt);

    if (u < 1) return 'walking';

    rt.x = g.x;
    rt.z = g.z;
    if (g.yaw !== undefined) rt.yaw = g.yaw;
    this.clampToBounds(comp, rt);
    rt.goto = undefined;
    return 'arrived';
  }

  private setKey(code: string, value: 0 | 1): void {
    if (FORWARD_KEYS.has(code)) this.forward = value;
    else if (BACK_KEYS.has(code)) this.back = value;
    else if (TURN_LEFT_KEYS.has(code)) this.turnLeft = value;
    else if (TURN_RIGHT_KEYS.has(code)) this.turnRight = value;
    else if (STRAFE_LEFT_KEYS.has(code)) this.strafeLeft = value;
    else if (STRAFE_RIGHT_KEYS.has(code)) this.strafeRight = value;
  }

  /**
   * Remember the pose under `persistKey`: about once a second while it
   * changes, and always when `force` (shutdown, entity removal). Storage that
   * is missing or refuses is simply skipped.
   */
  private persist(comp: FirstPersonCameraComponent, rt: FirstPersonCameraRuntime, force: boolean, dt = 0): void {
    if (!comp.persistKey) return;
    rt.persistAccum += dt;
    if (!force && rt.persistAccum < PERSIST_INTERVAL) return;
    rt.persistAccum = 0;
    const p = rt.persisted;
    if (p && p.x === rt.x && p.z === rt.z && p.yaw === rt.yaw) return;
    if (writePose(poseStore(), comp.persistKey, rt)) {
      rt.persisted = { x: rt.x, z: rt.z, yaw: rt.yaw };
    }
  }

  protected onUpdate(dt: number): void {
    const r = this.world?.renderer;
    if (!r) return;
    this.frameBoxes = null;

    // Both signs are set by the CANONICAL frame, not by taste. Yaw 0 looks +Z
    // and forward(yaw) = (sin yaw, 0, cos yaw), so d/dyaw of forward at the
    // spawn pose (yaw = π, looking -Z) is -X — increasing yaw swings the view
    // toward -X, which the right-handed renderer draws on the LEFT. So turning
    // RIGHT has to DECREASE yaw. Both of these read the other way round until
    // 2026-09-02, carried over from a left-handed room where they were right.
    const turn = this.turnLeft - this.turnRight;
    const fwd = this.forward - this.back;
    const strafe = this.strafeRight - this.strafeLeft;

    for (const entity of this.entities) {
      const comp = entity.get(FirstPersonCameraComponent);
      if (!comp) continue;
      // Idempotent: creates the camera on the first frame it can (covers the
      // case where the renderer wasn't ready when the entity was added), and
      // returns early once the handle exists.
      this.ensureCamera(entity, comp);
      const rt = this.getRuntime(comp);
      if (!rt.handle) continue;

      // A GOTO walks the camera to a spot on its own. The player always wins:
      // ANY movement key cancels it, so you can never be stuck watching the
      // camera drive itself somewhere you didn't want to go.
      if (rt.goto) {
        if (turn !== 0 || fwd !== 0 || strafe !== 0) {
          rt.goto = undefined;
          this.eventBus.emit(FirstPersonCameraEvents.ARRIVED, {
            entityId: entity.id,
            x: rt.x,
            z: rt.z,
            yaw: rt.yaw,
            cancelled: true,
          });
        } else {
          const step = this.stepToward(comp, rt, dt);
          if (step !== 'walking') {
            this.eventBus.emit(FirstPersonCameraEvents.ARRIVED, {
              entityId: entity.id,
              x: rt.x,
              z: rt.z,
              yaw: rt.yaw,
              // A glide always finishes. `cancelled` is now only ever true on
              // the branch above, where a movement key took over.
              cancelled: false,
            });
          }
          this._pos[0] = rt.x;
          this._pos[1] = comp.eyeHeight;
          this._pos[2] = rt.z;
          r.setCameraPose(rt.handle, this._pos, yawQuaternion(rt.yaw, this._quat));
          this.persist(comp, rt, false, dt);
          continue;
        }
      }

      rt.yaw += turn * comp.turnSpeed * dt;

      if (fwd !== 0 || strafe !== 0) {
        const sin = Math.sin(rt.yaw);
        const cos = Math.cos(rt.yaw);
        // forward = (sin, 0, cos). The player's right hand is forward × up,
        // which in a right-handed frame is (-cos, 0, sin) — NOT (cos, 0, -sin),
        // the left-handed answer this used to carry. At the spawn pose that is
        // the difference between strafing toward +X (what you see on your
        // right) and toward -X.
        const step = comp.moveSpeed * dt;
        this.moveTo(
          comp,
          rt,
          rt.x + (sin * fwd - cos * strafe) * step,
          rt.z + (cos * fwd + sin * strafe) * step,
        );
      }

      this._pos[0] = rt.x;
      this._pos[1] = comp.eyeHeight;
      this._pos[2] = rt.z;
      r.setCameraPose(rt.handle, this._pos, yawQuaternion(rt.yaw, this._quat));
      this.persist(comp, rt, false, dt);
    }
    this.frameBoxes = null;
  }
}

/** A yaw-only orientation quaternion (rotation about +Y), written into `out`. */
function yawQuaternion(yaw: number, out: Quaternion): Quaternion {
  const half = yaw * 0.5;
  out.x = 0;
  out.y = Math.sin(half);
  out.z = 0;
  out.w = Math.cos(half);
  return out;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
