/**
 * CameraFollow.ts — renderer-agnostic System.
 *
 * Math lives in CameraFollow.core.ts. This System watches for a target entity
 * (by id) to register its MeshHandle via the `meshprimitive.created` event,
 * then each frame reads that mesh's world position through the active
 * `RendererAdapter` and nudges the arc camera's target toward it.
 *
 * Zero imports from @babylonjs or three; all 3D access goes through
 * `world.renderer`.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { CameraHandle, MeshHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import {
  createCameraFollow,
  type CameraFollowInstance,
  type CameraFollowParams,
  DEFAULT_CAMERA_FOLLOW_PARAMS,
} from './CameraFollow.core';

export const CameraFollowEvents = {
  TARGET_CHANGED: 'cameraFollow.targetChanged',
} as const;

export interface CameraFollowInput extends Partial<CameraFollowParams> {
  /** Entity id of the thing to follow. Must own a MeshPrimitive. */
  target?: string;
}

export class CameraFollowComponent extends Component {
  params: CameraFollowParams;
  target: string;
  instance: CameraFollowInstance | null = null;

  constructor(data: CameraFollowInput = {}) {
    super();
    const { target, ...params } = data;
    this.target = target ?? '';
    this.params = { ...DEFAULT_CAMERA_FOLLOW_PARAMS, ...params };
  }

  serialize(): CameraFollowInput {
    return { target: this.target, ...this.params };
  }
}

export class CameraFollowSystem extends System {
  private unsubscribes: Array<() => void> = [];
  private targetHandles = new Map<string, MeshHandle>();
  private primed = new Set<string>();
  private _tmpPos: Vec3 = [0, 0, 0];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [CameraFollowComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on(
        'meshprimitive.created',
        (data: { entityId: string; handle: MeshHandle }) => {
          if (data?.entityId && data.handle) {
            this.targetHandles.set(data.entityId, data.handle);
          }
        },
      ),
    );

    // MeshPrimitiveSystem.onEntityAdded runs during world.addSystem and can
    // emit `meshprimitive.created` before this System's subscription above
    // exists. Scan existing entities to pick up anything we missed.
    if (this.world) {
      for (const entity of this.world.getEntities()) {
        const mesh = entity.get(MeshPrimitiveComponent);
        if (mesh?.handle) {
          this.targetHandles.set(entity.id, mesh.handle);
        }
      }
    }

    for (const entity of this.entities) {
      this.ensureInstance(entity);
    }
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.targetHandles.clear();
    this.primed.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    this.primed.delete(entity.id);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(CameraFollowComponent);
    if (!comp || comp.instance) return;
    comp.instance = createCameraFollow(comp.params);
  }

  protected onUpdate(deltaTime: number): void {
    const r = this.world?.renderer;
    if (!r) return;
    const cameraHandle = this.findArcCameraHandle();
    if (!cameraHandle) return;

    for (const entity of this.entities) {
      const comp = entity.get(CameraFollowComponent);
      if (!comp?.instance || !comp.target) continue;

      const targetHandle = this.targetHandles.get(comp.target);
      if (!targetHandle) continue;

      r.getMeshWorldPosition(targetHandle, this._tmpPos);

      // On the first frame we can read the target, snap the core there so
      // the camera doesn't swoop in from the origin.
      if (!this.primed.has(entity.id)) {
        comp.instance.reset({
          camX: this._tmpPos[0] + comp.params.offsetX,
          camY: this._tmpPos[1] + comp.params.offsetY,
          camZ: this._tmpPos[2] + comp.params.offsetZ,
        });
        this.primed.add(entity.id);
      }

      // The core is the source of truth for live params — the panel writes
      // directly to it. Pushing comp.params in here would clobber panel edits
      // each frame.
      const out = comp.instance.update(
        {
          targetX: this._tmpPos[0],
          targetY: this._tmpPos[1],
          targetZ: this._tmpPos[2],
        },
        deltaTime,
      );

      r.setCameraTarget(cameraHandle, out.camX, out.camY, out.camZ);

      this.eventBus.emit(CameraFollowEvents.TARGET_CHANGED, {
        entityId: entity.id,
        camX: out.camX,
        camY: out.camY,
        camZ: out.camZ,
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
