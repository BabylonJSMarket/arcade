/**
 * FirstPersonCamera — a walk-around, eye-height first-person camera driven by
 * the keyboard. Creates a FREE perspective camera through the RendererAdapter
 * and poses it every frame; W/S walk, A/D turn (tank), Q/E strafe, always at a
 * fixed eye height. Optional `bounds` keep the player inside the room.
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
import { FirstPersonCameraComponent } from './FirstPersonCamera.defs';

export { FirstPersonCameraComponent } from './FirstPersonCamera.defs';
export type {
  FirstPersonCameraInput,
  FirstPersonCameraBounds,
} from './FirstPersonCamera.defs';

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
}

/** Close enough to a GOTO target to call it arrived (metres / radians). */
const ARRIVE_DISTANCE = 0.05;
const ARRIVE_ANGLE = 0.02;

/** Shortest signed angle from `a` to `b`, so a turn never takes the long way. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
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
        if (comp) this.getRuntime(comp).goto = { x: e.x, z: e.z, yaw: e.yaw };
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
      if (comp) this.ensureCamera(comp);
    }
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(FirstPersonCameraComponent);
    if (comp) this.ensureCamera(comp);
  }

  protected onShutdown(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    }
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  private getRuntime(comp: FirstPersonCameraComponent): FirstPersonCameraRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { x: comp.startX, z: comp.startZ, yaw: comp.yaw };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  /** Create the perspective camera once, seeded at the component's start pose. */
  private ensureCamera(comp: FirstPersonCameraComponent): void {
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
  }

  /**
   * Advance one frame toward the active GOTO target: turn to face the walk
   * direction, then walk. Clears `rt.goto` on arrival.
   *
   * Turn-then-walk (rather than sliding sideways) is deliberate — it's the same
   * tank motion the keys produce, so an auto-walk looks like the player did it.
   */
  private stepToward(
    comp: FirstPersonCameraComponent,
    rt: FirstPersonCameraRuntime,
    dt: number,
  ): void {
    const target = rt.goto;
    if (!target) return;
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
        rt.x += (dx / distance) * step;
        rt.z += (dz / distance) * step;
        if (comp.bounds) {
          rt.x = clamp(rt.x, comp.bounds.minX, comp.bounds.maxX);
          rt.z = clamp(rt.z, comp.bounds.minZ, comp.bounds.maxZ);
        }
      }
      return;
    }

    // Arrived on the floor plane. Settle the final facing, if one was asked for.
    if (target.yaw !== undefined) {
      const dYaw = angleDelta(rt.yaw, target.yaw);
      if (Math.abs(dYaw) > ARRIVE_ANGLE) {
        const turnStep = comp.turnSpeed * dt;
        rt.yaw += Math.abs(dYaw) <= turnStep ? dYaw : Math.sign(dYaw) * turnStep;
        return;
      }
      rt.yaw = target.yaw;
    }
    rt.goto = undefined;
  }

  private setKey(code: string, value: 0 | 1): void {
    if (FORWARD_KEYS.has(code)) this.forward = value;
    else if (BACK_KEYS.has(code)) this.back = value;
    else if (TURN_LEFT_KEYS.has(code)) this.turnLeft = value;
    else if (TURN_RIGHT_KEYS.has(code)) this.turnRight = value;
    else if (STRAFE_LEFT_KEYS.has(code)) this.strafeLeft = value;
    else if (STRAFE_RIGHT_KEYS.has(code)) this.strafeRight = value;
  }

  protected onUpdate(dt: number): void {
    const r = this.world?.renderer;
    if (!r) return;

    const turn = this.turnRight - this.turnLeft;
    const fwd = this.forward - this.back;
    const strafe = this.strafeRight - this.strafeLeft;

    for (const entity of this.entities) {
      const comp = entity.get(FirstPersonCameraComponent);
      if (!comp) continue;
      // Idempotent: creates the camera on the first frame it can (covers the
      // case where the renderer wasn't ready when the entity was added), and
      // returns early once the handle exists.
      this.ensureCamera(comp);
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
          this.stepToward(comp, rt, dt);
          if (!rt.goto) {
            this.eventBus.emit(FirstPersonCameraEvents.ARRIVED, {
              entityId: entity.id,
              x: rt.x,
              z: rt.z,
              yaw: rt.yaw,
              cancelled: false,
            });
          }
          this._pos[0] = rt.x;
          this._pos[1] = comp.eyeHeight;
          this._pos[2] = rt.z;
          r.setCameraPose(rt.handle, this._pos, yawQuaternion(rt.yaw, this._quat));
          continue;
        }
      }

      rt.yaw += turn * comp.turnSpeed * dt;

      if (fwd !== 0 || strafe !== 0) {
        const sin = Math.sin(rt.yaw);
        const cos = Math.cos(rt.yaw);
        // Facing +Z at yaw 0: forward = (sin, 0, cos), right = (cos, 0, -sin).
        const step = comp.moveSpeed * dt;
        rt.x += (sin * fwd + cos * strafe) * step;
        rt.z += (cos * fwd - sin * strafe) * step;
        if (comp.bounds) {
          rt.x = clamp(rt.x, comp.bounds.minX, comp.bounds.maxX);
          rt.z = clamp(rt.z, comp.bounds.minZ, comp.bounds.maxZ);
        }
      }

      this._pos[0] = rt.x;
      this._pos[1] = comp.eyeHeight;
      this._pos[2] = rt.z;
      r.setCameraPose(rt.handle, this._pos, yawQuaternion(rt.yaw, this._quat));
    }
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
