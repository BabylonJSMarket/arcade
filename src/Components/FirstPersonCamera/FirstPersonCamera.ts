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
  /** Active GOTO target, if the camera is currently walking itself somewhere. */
  goto?: { x: number; z: number; yaw?: number };
  /** Seconds a GOTO has spent pressed against something without gaining ground. */
  stalled: number;
  /** Seconds since the pose was last written to storage. */
  persistAccum: number;
  /** The pose last written, so an idle player costs no storage writes. */
  persisted?: { x: number; z: number; yaw: number };
}

/** Close enough to a GOTO target to call it arrived (metres / radians). */
const ARRIVE_DISTANCE = 0.05;
const ARRIVE_ANGLE = 0.02;
/**
 * A GOTO that has made no headway for this long is given up (ARRIVED with
 * `cancelled: true`). Without it a walk blocked by a cabinet in the way would
 * press the player against it forever, waiting for a key.
 */
const STALL_SECONDS = 0.5;
/** Less than this much progress per frame toward the target counts as none. */
const STALL_EPSILON = 1e-4;
/** How often the pose is remembered while the player moves, in seconds. */
const PERSIST_INTERVAL = 1;

type GotoStep = 'walking' | 'arrived' | 'blocked';

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
          rt.goto = { x: e.x, z: e.z, yaw: e.yaw };
          rt.stalled = 0;
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
      rt = { x: comp.startX, z: comp.startZ, yaw: comp.yaw, stalled: 0, persistAccum: 0 };
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
    if (comp.bounds) {
      nx = clamp(nx, comp.bounds.minX, comp.bounds.maxX);
      nz = clamp(nz, comp.bounds.minZ, comp.bounds.maxZ);
    }
    rt.x = nx;
    rt.z = nz;
  }

  /**
   * Advance one frame toward the active GOTO target: turn to face the walk
   * direction, then walk. Clears `rt.goto` on arrival, or when the way is
   * blocked and stays blocked.
   *
   * Turn-then-walk (rather than sliding sideways) is deliberate — it's the same
   * tank motion the keys produce, so an auto-walk looks like the player did it.
   */
  private stepToward(
    comp: FirstPersonCameraComponent,
    rt: FirstPersonCameraRuntime,
    dt: number,
  ): GotoStep {
    const target = rt.goto;
    if (!target) return 'arrived';
    const dx = target.x - rt.x;
    const dz = target.z - rt.z;
    const distance = Math.hypot(dx, dz);

    if (distance > ARRIVE_DISTANCE) {
      // Face the walk direction first; only move once roughly aligned, so the
      // camera doesn't crab sideways across the room.
      const want = Math.atan2(dx, dz); // yaw 0 faces +Z
      const turnStep = comp.turnSpeed * dt;
      const dYaw = angleDelta(rt.yaw, want);
      rt.yaw += Math.abs(dYaw) <= turnStep ? dYaw : Math.sign(dYaw) * turnStep;

      if (Math.abs(dYaw) < 0.35) {
        const step = Math.min(comp.moveSpeed * dt, distance);
        this.moveTo(comp, rt, rt.x + (dx / distance) * step, rt.z + (dz / distance) * step);
        // A cabinet in the way: the sweep leaves us short of the step we
        // asked for. Give the walk a moment (it may be sliding round), then
        // give it up rather than lean on the furniture until a key is pressed.
        const gained = distance - Math.hypot(target.x - rt.x, target.z - rt.z);
        rt.stalled = gained > STALL_EPSILON ? 0 : rt.stalled + dt;
        if (rt.stalled >= STALL_SECONDS) {
          rt.goto = undefined;
          rt.stalled = 0;
          return 'blocked';
        }
      }
      return 'walking';
    }

    // Arrived on the floor plane. Settle the final facing, if one was asked for.
    if (target.yaw !== undefined) {
      const dYaw = angleDelta(rt.yaw, target.yaw);
      if (Math.abs(dYaw) > ARRIVE_ANGLE) {
        const turnStep = comp.turnSpeed * dt;
        rt.yaw += Math.abs(dYaw) <= turnStep ? dYaw : Math.sign(dYaw) * turnStep;
        return 'walking';
      }
      rt.yaw = target.yaw;
    }
    rt.goto = undefined;
    rt.stalled = 0;
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

    const turn = this.turnRight - this.turnLeft;
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
          rt.stalled = 0;
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
              cancelled: step === 'blocked',
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
        // Facing +Z at yaw 0: forward = (sin, 0, cos), right = (cos, 0, -sin).
        const step = comp.moveSpeed * dt;
        this.moveTo(
          comp,
          rt,
          rt.x + (sin * fwd + cos * strafe) * step,
          rt.z + (cos * fwd - sin * strafe) * step,
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
