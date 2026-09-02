/**
 * AmbientOcclusion.ts — renderer-agnostic System.
 *
 * Contact shadows: the darkening where a cabinet meets the carpet and where
 * two walls meet, which flat lighting never gives you. Applied scene-wide
 * through the `ambientOcclusion` adapter plugin (adapter/AmbientOcclusion.babylon.ts),
 * retuned per frame when a field changes, and cleared on removal.
 *
 * This is a Route-B component: the engine work is a plugin the host registers
 * at bootstrap (`registerBabylonAmbientOcclusionExtension(adapter)`). If no
 * plugin is registered — a Three project, headless tests, a host that forgot —
 * the System warns ONCE, emits UNSUPPORTED once, and does nothing more. Never
 * a warning per frame.
 */

import { AmbientOcclusionEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import {
  AMBIENT_OCCLUSION_EXTENSION,
  sameSettings,
  type AmbientOcclusionExtension,
  type AmbientOcclusionSettings,
} from './AmbientOcclusion.core';
import { AmbientOcclusionComponent, type AmbientOcclusionInput } from './AmbientOcclusion.defs';

export {
  AmbientOcclusionComponent,
  AMBIENT_OCCLUSION_EXTENSION,
  type AmbientOcclusionInput,
  type AmbientOcclusionSettings,
  type AmbientOcclusionExtension,
};

interface AmbientOcclusionRuntime {
  /** True while the plugin has this component's pass live. */
  applied: boolean;
  /** What we last handed the plugin, so an unchanged frame costs nothing. */
  last?: AmbientOcclusionSettings;
  lastEnabled?: boolean;
}

export class AmbientOcclusionSystem extends System {
  protected query = { required: [AmbientOcclusionComponent] };
  private runtime = new WeakMap<AmbientOcclusionComponent, AmbientOcclusionRuntime>();
  /** The one warning this System ever prints about a missing plugin. */
  private warned = false;
  /** UNSUPPORTED is a fact about the host, told once. */
  private reportedUnsupported = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: AmbientOcclusionComponent): AmbientOcclusionRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { applied: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  private extension(): AmbientOcclusionExtension | undefined {
    return this.world?.renderer?.extension<AmbientOcclusionExtension>(
      AMBIENT_OCCLUSION_EXTENSION,
    );
  }

  protected onInitialize(): void {
    for (const entity of this.entities) this.sync(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.sync(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(AmbientOcclusionComponent);
    if (!comp) return;
    this.clear(entity, this.getRuntime(comp));
  }

  protected onUpdate(_dt: number): void {
    for (const entity of this.entities) this.sync(entity);
  }

  /** Push the component to the plugin if anything about it changed. */
  private sync(entity: Entity): void {
    const comp = entity.get(AmbientOcclusionComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    const now = comp.settings();
    if (rt.lastEnabled === comp.enabled && sameSettings(rt.last, now)) return;
    rt.last = now;
    rt.lastEnabled = comp.enabled;

    if (!comp.enabled) {
      this.clear(entity, rt);
      return;
    }
    const ext = this.extension();
    if (!ext) {
      this.unsupported(entity, 'no adapter plugin registered');
      return;
    }
    if (!ext.apply(now)) {
      rt.applied = false;
      this.unsupported(entity, 'the engine cannot run SSAO2');
      return;
    }
    rt.applied = true;
    this.eventBus.emit(AmbientOcclusionEvents.APPLIED, { entityId: entity.id });
  }

  private clear(entity: Entity, rt: AmbientOcclusionRuntime): void {
    if (!rt.applied) return;
    this.extension()?.clear();
    rt.applied = false;
    this.eventBus.emit(AmbientOcclusionEvents.CLEARED, { entityId: entity.id });
  }

  /** Say it once — a missing plugin is a bootstrap fact, not a per-frame event. */
  private unsupported(entity: Entity, reason: string): void {
    if (!this.warned) {
      this.warned = true;
      console.warn(
        `[AmbientOcclusion] Skipping the SSAO pass: ${reason}. ` +
          'Call registerBabylonAmbientOcclusionExtension(adapter) at bootstrap on a Babylon host.',
      );
    }
    if (this.reportedUnsupported) return;
    this.reportedUnsupported = true;
    this.eventBus.emit(AmbientOcclusionEvents.UNSUPPORTED, { entityId: entity.id, reason });
  }
}
