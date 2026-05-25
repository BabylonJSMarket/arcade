/**
 * HemisphericLight.ts — renderer-agnostic System for hemispheric ambient light.
 * Pure data lives in HemisphericLight.core.ts. This System drives world.renderer.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { LightHandle } from '@babylonjsmarket/ecs/renderer-types';
import { HemisphericLightComponent, type HemisphericLightInput } from './HemisphericLight.core';

export { HemisphericLightComponent, type HemisphericLightInput };

export const HemisphericLightEvents = {
  CREATED: 'hemisphericlight.created',
  INTENSITY_CHANGED: 'hemisphericlight.intensity.changed',
} as const;

interface HemisphericLightRuntime {
  handle?: LightHandle;
  initialized: boolean;
}

export class HemisphericLightSystem extends System {
  protected query = { required: [HemisphericLightComponent] };
  private lastIntensities = new WeakMap<HemisphericLightComponent, number>();
  private runtime = new WeakMap<HemisphericLightComponent, HemisphericLightRuntime>();

  private getRuntime(comp: HemisphericLightComponent): HemisphericLightRuntime {
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
    const comp = entity.get(HemisphericLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.handle) {
      this.world?.renderer?.disposeLight(rt.handle);
      rt.handle = undefined;
      rt.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    // Detect intensity changes driven from outside (e.g., the viz panel) and
    // push them to the adapter.
    for (const entity of this.entities) {
      const comp = entity.get(HemisphericLightComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.handle) continue;
      const prev = this.lastIntensities.get(comp);
      if (prev === undefined || Math.abs(prev - comp.intensity) > 0.001) {
        this.world?.renderer?.updateLightIntensity(rt.handle, comp.intensity);
        this.lastIntensities.set(comp, comp.intensity);
        if (prev !== undefined) {
          this.eventBus.emit(HemisphericLightEvents.INTENSITY_CHANGED, {
            entityId: entity.id,
            intensity: comp.intensity,
          });
        }
      }
    }
  }

  private ensureLight(entity: Entity): void {
    const comp = entity.get(HemisphericLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    rt.handle = r.createHemisphericLight(entity.id, comp.toSpec());
    rt.initialized = true;
    this.lastIntensities.set(comp, comp.intensity);

    this.eventBus.emit(HemisphericLightEvents.CREATED, {
      entityId: entity.id,
      intensity: comp.intensity,
    });
  }
}
