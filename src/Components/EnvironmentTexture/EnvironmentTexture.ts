/**
 * EnvironmentTexture.ts — renderer-agnostic System.
 *
 * Loads a prefiltered cubemap onto scene.environmentTexture (Babylon) or the
 * equivalent on other renderers, so PBR materials in the scene reflect a
 * real environment. Applies once per component on first tick; clears on
 * entity removal.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import {
  EnvironmentTextureComponent,
  type EnvironmentTextureInput,
  type EnvironmentPreset,
} from './EnvironmentTexture.defs';

export {
  EnvironmentTextureComponent,
  type EnvironmentTextureInput,
  type EnvironmentPreset,
};

interface EnvironmentTextureRuntime {
  initialized: boolean;
}

export class EnvironmentTextureSystem extends System {
  protected query = { required: [EnvironmentTextureComponent] };
  private runtime = new WeakMap<EnvironmentTextureComponent, EnvironmentTextureRuntime>();

  private getRuntime(comp: EnvironmentTextureComponent): EnvironmentTextureRuntime {
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
    for (const entity of this.entities) this.apply(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.apply(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    this.world?.renderer?.clearEnvironmentTexture();
    const comp = entity.get(EnvironmentTextureComponent);
    if (comp) this.getRuntime(comp).initialized = false;
  }

  // Stateless beyond the one-shot apply, so onUpdate stays a no-op.
  protected onUpdate(_dt: number): void {
    /* event-driven (init only) */
  }

  private apply(entity: Entity): void {
    const comp = entity.get(EnvironmentTextureComponent);
    if (!comp || !comp.url) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;
    r.setEnvironmentTexture(comp.url, { level: comp.level });
    rt.initialized = true;
  }
}
