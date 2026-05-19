/**
 * DirectionalLight.ts — renderer-agnostic System.
 * Pure data lives in DirectionalLight.core.ts. This System drives world.renderer.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { DirectionalLightComponent, type DirectionalLightInput } from './DirectionalLight.core';

export { DirectionalLightComponent, type DirectionalLightInput };

export const DirectionalLightEvents = {
  CREATED: 'directionallight.created',
  DIRECTION_CHANGED: 'directionallight.direction.changed',
  INTENSITY_CHANGED: 'directionallight.intensity.changed',
  COLOR_CHANGED: 'directionallight.color.changed',
  SHADOW_CREATED: 'directionallight.shadow.created',
} as const;

interface Snapshot {
  dir: [number, number, number];
  pos: [number, number, number];
  intensity: number;
  diffuse: [number, number, number];
  specular: [number, number, number];
}

export class DirectionalLightSystem extends System {
  private snapshots = new WeakMap<DirectionalLightComponent, Snapshot>();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [DirectionalLightComponent] };
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
    const comp = entity.get(DirectionalLightComponent);
    if (comp?.handle) {
      this.world?.renderer?.disposeLight(comp.handle);
      comp.handle = undefined;
      comp.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    for (const entity of this.entities) {
      const comp = entity.get(DirectionalLightComponent);
      if (!comp?.initialized || !comp.handle) continue;
      const prev = this.snapshots.get(comp);
      if (!prev) continue;

      if (Math.abs(prev.intensity - comp.intensity) > 0.001) {
        this.world?.renderer?.updateLightIntensity(comp.handle, comp.intensity);
        prev.intensity = comp.intensity;
        this.eventBus.emit(DirectionalLightEvents.INTENSITY_CHANGED, {
          entityId: entity.id,
          intensity: comp.intensity,
        });
      }
      if (this.vec3Changed(prev.dir, comp.direction)) {
        prev.dir = [...comp.direction] as [number, number, number];
        this.eventBus.emit(DirectionalLightEvents.DIRECTION_CHANGED, {
          entityId: entity.id,
          direction: [...comp.direction] as [number, number, number],
        });
      }
      if (this.vec3Changed(prev.diffuse, comp.diffuse) || this.vec3Changed(prev.specular, comp.specular)) {
        prev.diffuse = [...comp.diffuse] as [number, number, number];
        prev.specular = [...comp.specular] as [number, number, number];
        this.eventBus.emit(DirectionalLightEvents.COLOR_CHANGED, {
          entityId: entity.id,
          diffuse: [...comp.diffuse] as [number, number, number],
          specular: [...comp.specular] as [number, number, number],
        });
      }
    }
  }

  private vec3Changed(a: [number, number, number], b: [number, number, number]): boolean {
    return Math.abs(a[0] - b[0]) > 0.001 || Math.abs(a[1] - b[1]) > 0.001 || Math.abs(a[2] - b[2]) > 0.001;
  }

  private ensureLight(entity: Entity): void {
    const comp = entity.get(DirectionalLightComponent);
    if (!comp || comp.initialized || !comp.autoCreate) return;
    const r = this.world?.renderer;
    if (!r) return;

    comp.handle = r.createDirectionalLight(entity.id, comp.toSpec());
    comp.initialized = true;
    this.snapshots.set(comp, {
      dir: [...comp.direction] as [number, number, number],
      pos: [...comp.position] as [number, number, number],
      intensity: comp.intensity,
      diffuse: [...comp.diffuse] as [number, number, number],
      specular: [...comp.specular] as [number, number, number],
    });

    this.eventBus.emit(DirectionalLightEvents.CREATED, {
      entityId: entity.id,
      direction: [...comp.direction] as [number, number, number],
      position: [...comp.position] as [number, number, number],
      intensity: comp.intensity,
    });

    if (comp.shadowEnabled) {
      this.eventBus.emit(DirectionalLightEvents.SHADOW_CREATED, {
        entityId: entity.id,
        shadowMapSize: comp.shadowMapSize,
      });
    }
  }
}
