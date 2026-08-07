/**
 * PointLight.ts — renderer-agnostic System for positioned, falling-off lights.
 * Pure data lives in PointLight.core.ts. This System drives world.renderer.
 */

import { PointLightEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { LightHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { PointLightComponent, type PointLightInput } from './PointLight.core';

export { PointLightComponent, type PointLightInput };

interface PointLightRuntime {
  handle?: LightHandle;
  initialized: boolean;
}

export class PointLightSystem extends System {
  protected query = { required: [PointLightComponent] };
  private lastIntensities = new WeakMap<PointLightComponent, number>();
  private lastPositions = new WeakMap<PointLightComponent, Vec3>();
  private runtime = new WeakMap<PointLightComponent, PointLightRuntime>();

  private getRuntime(comp: PointLightComponent): PointLightRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { initialized: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      this.ensureLight(entity);
    }
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureLight(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(PointLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.handle) {
      this.world?.renderer?.disposeLight(rt.handle);
      rt.handle = undefined;
      rt.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    // Diff intensity + position each frame so an outside mutation (a control
    // panel, a flicker system, a lamp carried by the player) reaches the
    // adapter without anyone having to call us.
    for (const entity of this.entities) {
      const comp = entity.get(PointLightComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.handle) continue;

      const prev = this.lastIntensities.get(comp);
      if (prev === undefined || Math.abs(prev - comp.intensity) > 0.001) {
        this.world?.renderer?.updateLightIntensity(rt.handle, comp.intensity);
        this.lastIntensities.set(comp, comp.intensity);
        if (prev !== undefined) {
          this.eventBus.emit(PointLightEvents.INTENSITY_CHANGED, {
            entityId: entity.id,
            intensity: comp.intensity,
          });
        }
      }

      const prevPos = this.lastPositions.get(comp);
      const p = comp.position;
      if (
        !prevPos ||
        Math.abs(prevPos[0] - p[0]) > 0.001 ||
        Math.abs(prevPos[1] - p[1]) > 0.001 ||
        Math.abs(prevPos[2] - p[2]) > 0.001
      ) {
        this.world?.renderer?.setLightPosition(rt.handle, p[0], p[1], p[2]);
        this.lastPositions.set(comp, [p[0], p[1], p[2]]);
        if (prevPos) {
          this.eventBus.emit(PointLightEvents.MOVED, {
            entityId: entity.id,
            position: [p[0], p[1], p[2]] as Vec3,
          });
        }
      }
    }
  }

  private ensureLight(entity: Entity): void {
    const comp = entity.get(PointLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    rt.handle = r.createPointLight(entity.id, comp.toSpec());
    rt.initialized = true;
    this.lastIntensities.set(comp, comp.intensity);
    this.lastPositions.set(comp, [comp.position[0], comp.position[1], comp.position[2]]);

    this.eventBus.emit(PointLightEvents.CREATED, {
      entityId: entity.id,
      intensity: comp.intensity,
    });
  }
}
