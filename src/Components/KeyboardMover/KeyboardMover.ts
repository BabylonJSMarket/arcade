/**
 * KeyboardMover — drives an entity's MeshPrimitive position via WASD / arrow
 * keys. Movement is camera-relative: "forward" is whatever direction the arc
 * camera is currently facing, so the character always walks away from the
 * viewer when the user presses W.
 *
 * Zero imports from @babylonjs or three. Mesh updates go through
 * world.renderer; camera orientation comes from renderer.getCameraAngles.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { CameraHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera.defs';
import { KeyboardInputEvents } from '../../inputEvents';
import { AnimationInputEvents } from '../../events';
import { KeyboardMoverComponent } from './KeyboardMover.defs';

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);

const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);

const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);

const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

export class KeyboardMoverSystem extends System {
  private forward = 0;
  private back = 0;
  private left = 0;
  private right = 0;
  private currentYaw = 0;
  private _fwdTmp: Vec3 = [0, 0, 0];
  private _rightTmp: Vec3 = [0, 0, 0];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  protected query = { required: [KeyboardMoverComponent, MeshPrimitiveComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(KeyboardInputEvents.KEYDOWN, (e: { code: string }) => this.setKey(e.code, 1));
    this.listen(KeyboardInputEvents.KEYUP, (e: { code: string }) => this.setKey(e.code, 0));

    // Bridge DOM keyboard events to the bus so scaffolded projects work
    // out of the box without needing a separate input-source system.
    // Tests skip this branch and emit the bus events directly.
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) =>
        this.eventBus.emit(KeyboardInputEvents.KEYDOWN, { code: e.code });
      this.keyupHandler = (e: KeyboardEvent) =>
        this.eventBus.emit(KeyboardInputEvents.KEYUP, { code: e.code });
      window.addEventListener('keydown', this.keydownHandler);
      window.addEventListener('keyup', this.keyupHandler);
    }
  }

  protected onShutdown(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    }
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  private setKey(code: string, value: 0 | 1): void {
    if (FORWARD_KEYS.has(code)) this.forward = value;
    else if (BACK_KEYS.has(code)) this.back = value;
    else if (LEFT_KEYS.has(code)) this.left = value;
    else if (RIGHT_KEYS.has(code)) this.right = value;
  }

  protected onUpdate(dt: number): void {
    const r = this.world?.renderer;
    if (!r) return;

    const inputZ = this.forward - this.back;
    const inputX = this.right - this.left;

    // Camera basis in world space. The adapter bakes in its own handedness —
    // Babylon (left-handed) and Three (right-handed) return oppositely-signed
    // right vectors for the same camera position, so the System doesn't need
    // to know which engine is in play.
    const cam = this.findArcCameraHandle();
    if (cam) {
      r.getCameraForward(cam, this._fwdTmp);
      r.getCameraRight(cam, this._rightTmp);
    } else {
      this._fwdTmp[0] = -1; this._fwdTmp[1] = 0; this._fwdTmp[2] = 0;
      this._rightTmp[0] = 0; this._rightTmp[1] = 0; this._rightTmp[2] = -1;
    }

    // Project to the XZ plane (ignore Y so a tilted camera still walks flat)
    // and re-normalize.
    let fwdX = this._fwdTmp[0], fwdZ = this._fwdTmp[2];
    let rightX = this._rightTmp[0], rightZ = this._rightTmp[2];
    const fLen = Math.hypot(fwdX, fwdZ);
    if (fLen > 1e-6) { fwdX /= fLen; fwdZ /= fLen; }
    const rLen = Math.hypot(rightX, rightZ);
    if (rLen > 1e-6) { rightX /= rLen; rightZ /= rLen; }

    let vx = fwdX * inputZ + rightX * inputX;
    let vz = fwdZ * inputZ + rightZ * inputX;
    const len = Math.hypot(vx, vz);
    if (len > 1) {
      vx /= len;
      vz /= len;
    }

    const inputMag = Math.hypot(vx, vz);

    for (const entity of this.entities) {
      const mover = entity.get(KeyboardMoverComponent);
      const mesh = entity.get(MeshPrimitiveComponent);
      if (!mover || !mesh?.handle) continue;

      if (vx !== 0 || vz !== 0) {
        mesh.position[0] += vx * mover.speed * dt;
        mesh.position[2] += vz * mover.speed * dt;
        r.setMeshPosition(mesh.handle, mesh.position[0], mesh.position[1], mesh.position[2]);

        if (mover.faceMotion) {
          this.currentYaw = Math.atan2(vx, vz);
          mesh.rotation[1] = this.currentYaw;
          r.setMeshRotation(mesh.handle, 0, this.currentYaw, 0);
        }
      }

      // Drive a sibling Animation's locomotion blend: our current speed in
      // world units/s (0 while standing → the idle clip). Harmless without an
      // AnimationSystem listening.
      this.eventBus.emit(AnimationInputEvents.SET_SPEED, {
        entityId: String(entity.id),
        speed: inputMag * mover.speed,
      });
    }
  }

  private findArcCameraHandle(): CameraHandle | undefined {
    if (!this.world) return undefined;
    for (const entity of this.world.getEntities()) {
      const arc = entity.get(ArcCameraComponent);
      if (arc?.handle) return arc.handle;
    }
    return undefined;
  }
}

// The definitions live in KeyboardMover.defs.ts; re-exported so existing importers
// keep working. New code should import them from './KeyboardMover.defs' directly.
export { KeyboardMoverComponent, type KeyboardMoverInput } from './KeyboardMover.defs';
