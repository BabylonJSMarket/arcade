/**
 * Skybox.ts — renderer-agnostic System.
 * Pure data lives in Skybox.core.ts. This System drives world.renderer.createSkybox.
 *
 * If the component's `followLight` is set, every frame the System looks up the
 * matching DirectionalLight entity and uses the NEGATIVE of its direction as
 * the sun direction — so sky and shadow angle stay in sync as you rotate the
 * sun. With `followLight: "auto"`, the first DirectionalLight in the world is
 * used; with a tag name, the System finds the first entity carrying that tag.
 */

import { SkyboxEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { SkyboxHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { SkyboxComponent, type SkyboxInput } from './Skybox.core';
import { DirectionalLightComponent } from '../DirectionalLight/DirectionalLight';

export { SkyboxComponent, type SkyboxInput };



interface SkyboxRuntime {
  handle?: SkyboxHandle;
  initialized: boolean;
}

export class SkyboxSystem extends System {
  protected query = { required: [SkyboxComponent] };
  /** Per-component snapshot of the last sun direction we pushed to the GPU. */
  private lastSun = new WeakMap<SkyboxComponent, Vec3>();
  private runtime = new WeakMap<SkyboxComponent, SkyboxRuntime>();

  private getRuntime(comp: SkyboxComponent): SkyboxRuntime {
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
    for (const entity of this.entities) this.ensureSkybox(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureSkybox(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(SkyboxComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.handle) {
      this.world?.renderer?.disposeSkybox(rt.handle);
      rt.handle = undefined;
      rt.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {
    for (const entity of this.entities) {
      const comp = entity.get(SkyboxComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.handle || !comp.followLight) continue;

      const target = this.findFollowedLight(comp.followLight);
      if (!target) continue;
      // Sky takes the direction *to* the sun; lights point *from* the sun.
      const sun: Vec3 = [-target.direction[0], -target.direction[1], -target.direction[2]];

      const prev = this.lastSun.get(comp);
      if (prev && this.vec3Eq(prev, sun)) continue;

      this.world?.renderer?.updateSkyboxSun(rt.handle, sun);
      comp.sunDirection = sun;
      this.lastSun.set(comp, sun);
      this.eventBus.emit(SkyboxEvents.SUN_CHANGED, { entityId: entity.id, sun });
    }
  }

  private ensureSkybox(entity: Entity): void {
    const comp = entity.get(SkyboxComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    // If following a light, prime the sun direction off it on creation so the
    // first frame isn't visibly mis-aligned.
    if (comp.followLight) {
      const target = this.findFollowedLight(comp.followLight);
      if (target) {
        comp.sunDirection = [-target.direction[0], -target.direction[1], -target.direction[2]];
      }
    }

    rt.handle = r.createSkybox(entity.id, comp.toSpec());
    rt.initialized = true;
    this.lastSun.set(comp, [...comp.sunDirection] as Vec3);
    this.eventBus.emit(SkyboxEvents.CREATED, { entityId: entity.id });
  }

  /**
   * Locate the DirectionalLight to track. `"auto"` returns the first
   * DirectionalLight in the world; any other string is treated as an entity
   * tag.
   */
  private findFollowedLight(followLight: string): DirectionalLightComponent | undefined {
    if (!this.world) return undefined;
    for (const entity of this.world.getEntities()) {
      if (followLight !== 'auto' && !entity.hasTag(followLight)) continue;
      const dl = entity.get(DirectionalLightComponent);
      if (dl) return dl;
    }
    return undefined;
  }

  private vec3Eq(a: Vec3, b: Vec3): boolean {
    return (
      Math.abs(a[0] - b[0]) < 0.0005 &&
      Math.abs(a[1] - b[1]) < 0.0005 &&
      Math.abs(a[2] - b[2]) < 0.0005
    );
  }
}
