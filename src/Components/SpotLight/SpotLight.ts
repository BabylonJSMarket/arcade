/**
 * SpotLight.ts — renderer-agnostic System for aimed cones of light.
 * Pure data lives in SpotLight.defs.ts. This System drives world.renderer.
 */

import { SpotLightEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { LightHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { SpotLightComponent, type SpotLightInput } from './SpotLight.defs';

export { SpotLightComponent, type SpotLightInput };

interface SpotLightRuntime {
  handle?: LightHandle;
  initialized: boolean;
}

/** True when any component of `a` and `b` differ by more than a thousandth. */
function moved(a: Vec3 | undefined, b: Vec3): boolean {
  return (
    !a ||
    Math.abs(a[0] - b[0]) > 0.001 ||
    Math.abs(a[1] - b[1]) > 0.001 ||
    Math.abs(a[2] - b[2]) > 0.001
  );
}

export class SpotLightSystem extends System {
  protected query = { required: [SpotLightComponent] };
  private lastIntensities = new WeakMap<SpotLightComponent, number>();
  private lastPositions = new WeakMap<SpotLightComponent, Vec3>();
  private lastDirections = new WeakMap<SpotLightComponent, Vec3>();
  private lastColors = new WeakMap<SpotLightComponent, Vec3>();
  private runtime = new WeakMap<SpotLightComponent, SpotLightRuntime>();

  private getRuntime(comp: SpotLightComponent): SpotLightRuntime {
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
    const comp = entity.get(SpotLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.handle) {
      this.world?.renderer?.disposeLight(rt.handle);
      rt.handle = undefined;
      rt.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    // Diff intensity, position, aim and colour each frame so an outside
    // mutation (a control panel, a sweeping searchlight, a sign that cycles
    // hue) reaches the adapter without anyone having to call us.
    for (const entity of this.entities) {
      const comp = entity.get(SpotLightComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.handle) continue;
      const r = this.world?.renderer;
      if (!r) continue;

      const prev = this.lastIntensities.get(comp);
      if (prev === undefined || Math.abs(prev - comp.intensity) > 0.001) {
        r.updateLightIntensity(rt.handle, comp.intensity);
        this.lastIntensities.set(comp, comp.intensity);
        if (prev !== undefined) {
          this.eventBus.emit(SpotLightEvents.INTENSITY_CHANGED, {
            entityId: entity.id,
            intensity: comp.intensity,
          });
        }
      }

      const p = comp.position;
      const prevPos = this.lastPositions.get(comp);
      if (moved(prevPos, p)) {
        r.setLightPosition(rt.handle, p[0], p[1], p[2]);
        this.lastPositions.set(comp, [p[0], p[1], p[2]]);
        if (prevPos) {
          this.eventBus.emit(SpotLightEvents.MOVED, {
            entityId: entity.id,
            position: [p[0], p[1], p[2]] as Vec3,
          });
        }
      }

      const d = comp.direction;
      if (moved(this.lastDirections.get(comp), d)) {
        r.setLightDirection(rt.handle, d[0], d[1], d[2]);
        this.lastDirections.set(comp, [d[0], d[1], d[2]]);
      }

      const c = comp.diffuse;
      if (moved(this.lastColors.get(comp), c)) {
        r.setLightColor(rt.handle, c[0], c[1], c[2]);
        this.lastColors.set(comp, [c[0], c[1], c[2]]);
      }
    }
  }

  private ensureLight(entity: Entity): void {
    const comp = entity.get(SpotLightComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    rt.handle = r.createSpotLight(entity.id, comp.toSpec());
    rt.initialized = true;
    // Seed every diff from the spec we just sent, so the first frame stays quiet.
    this.lastIntensities.set(comp, comp.intensity);
    this.lastPositions.set(comp, [comp.position[0], comp.position[1], comp.position[2]]);
    this.lastDirections.set(comp, [comp.direction[0], comp.direction[1], comp.direction[2]]);
    this.lastColors.set(comp, [comp.diffuse[0], comp.diffuse[1], comp.diffuse[2]]);

    this.eventBus.emit(SpotLightEvents.CREATED, {
      entityId: entity.id,
      intensity: comp.intensity,
    });
  }
}
