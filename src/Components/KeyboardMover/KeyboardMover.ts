/**
 * KeyboardMover — drives an entity's MeshPrimitive position via WASD / arrow
 * keys. Movement is camera-relative: "forward" is whatever direction the arc
 * camera is currently facing, so the character always walks away from the
 * viewer when the user presses W.
 *
 * Zero imports from @babylonjs or three. Mesh updates go through
 * world.renderer; camera orientation comes from renderer.getCameraAngles.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { CameraHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';

export interface KeyboardMoverInput {
  /** World units per second at full input. */
  speed?: number;
  /** When true, the mesh yaws to face its direction of motion. */
  faceMotion?: boolean;
}

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

export class KeyboardMoverComponent extends Component {
  speed: number;
  faceMotion: boolean;

  constructor(data: KeyboardMoverInput = {}) {
    super();
    this.speed = data.speed ?? 4;
    this.faceMotion = data.faceMotion ?? true;
  }

  serialize(): KeyboardMoverInput {
    return { speed: this.speed, faceMotion: this.faceMotion };
  }
}

export class KeyboardMoverSystem extends System {
  private forward = 0;
  private back = 0;
  private left = 0;
  private right = 0;
  private unsubscribes: Array<() => void> = [];
  private currentYaw = 0;
  private _fwdTmp: Vec3 = [0, 0, 0];
  private _rightTmp: Vec3 = [0, 0, 0];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [KeyboardMoverComponent, MeshPrimitiveComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on('keyboard.keydown', (e: { code: string }) => this.setKey(e.code, 1)),
      this.eventBus.on('keyboard.keyup', (e: { code: string }) => this.setKey(e.code, 0)),
    );
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
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
