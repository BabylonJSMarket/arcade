/**
 * ToneMapping.ts — renderer-agnostic System.
 *
 * Applies the scene-wide tone-mapping grade once per component through the
 * `toneMapping` adapter plugin (ToneMapping.babylon.ts), and clears it on
 * removal. If no plugin is registered (headless tests, an un-bootstrapped
 * renderer) the apply is a safe no-op.
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import {
  ToneMappingComponent,
  TONE_MAPPING_EXTENSION,
  type ToneMappingExtension,
  type ToneMappingInput,
  type ToneMappingMode,
  type ToneMappingSettings,
} from './ToneMapping.defs';

export {
  ToneMappingComponent,
  TONE_MAPPING_EXTENSION,
  type ToneMappingInput,
  type ToneMappingMode,
  type ToneMappingSettings,
  type ToneMappingExtension,
};
export { registerBabylonToneMappingExtension } from './ToneMapping.babylon';

interface ToneMappingRuntime {
  applied: boolean;
}

export class ToneMappingSystem extends System {
  protected query = { required: [ToneMappingComponent] };
  private runtime = new WeakMap<ToneMappingComponent, ToneMappingRuntime>();

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: ToneMappingComponent): ToneMappingRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { applied: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  private extension(): ToneMappingExtension | undefined {
    return this.world?.renderer?.extension<ToneMappingExtension>(
      TONE_MAPPING_EXTENSION,
    );
  }

  protected onInitialize(): void {
    for (const entity of this.entities) this.apply(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.apply(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    this.extension()?.clear();
    const comp = entity.get(ToneMappingComponent);
    if (comp) this.getRuntime(comp).applied = false;
  }

  // One-shot on apply; nothing to do each frame.
  protected onUpdate(_dt: number): void {
    /* event-driven (init only) */
  }

  private apply(entity: Entity): void {
    const comp = entity.get(ToneMappingComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.applied) return;
    const ext = this.extension();
    if (!ext) return; // no plugin bootstrapped → no-op
    ext.apply(comp.settings());
    rt.applied = true;
  }
}
