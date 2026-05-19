/**
 * HemisphericLight.ts — renderer-agnostic System for hemispheric ambient light.
 * Pure data lives in HemisphericLight.core.ts. This System drives world.renderer.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { HemisphericLightComponent, type HemisphericLightInput } from './HemisphericLight.core';

export { HemisphericLightComponent, type HemisphericLightInput };

export const HemisphericLightEvents = {
  CREATED: 'hemisphericlight.created',
  INTENSITY_CHANGED: 'hemisphericlight.intensity.changed',
} as const;

export class HemisphericLightSystem extends System {
  private lastIntensities = new WeakMap<HemisphericLightComponent, number>();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [HemisphericLightComponent] };
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
    if (comp?.handle) {
      this.world?.renderer?.disposeLight(comp.handle);
      comp.handle = undefined;
      comp.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    // Detect intensity changes driven from outside (e.g., the viz panel) and
    // push them to the adapter.
    for (const entity of this.entities) {
      const comp = entity.get(HemisphericLightComponent);
      if (!comp?.initialized || !comp.handle) continue;
      const prev = this.lastIntensities.get(comp);
      if (prev === undefined || Math.abs(prev - comp.intensity) > 0.001) {
        this.world?.renderer?.updateLightIntensity(comp.handle, comp.intensity);
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
    if (!comp || comp.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    comp.handle = r.createHemisphericLight(entity.id, comp.toSpec());
    comp.initialized = true;
    this.lastIntensities.set(comp, comp.intensity);

    this.eventBus.emit(HemisphericLightEvents.CREATED, {
      entityId: entity.id,
      intensity: comp.intensity,
    });
  }
}
