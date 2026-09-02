/**
 * Fog.ts — renderer-agnostic System for scene-wide distance fog.
 *
 * Scene-global, like EnvironmentTexture: there is one fog per scene, and this
 * System pushes the component's settings to `renderer.setFog` when the
 * component attaches and clears them (`setFog(null)`) when it goes away.
 * Unlike EnvironmentTexture it is NOT one-shot: every field is diffed each
 * frame, so a settings slider that drives `density` live, or a menu toggle
 * that flips `enabled`, reaches the adapter without anyone calling us.
 */

import { FogEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import { FogComponent, type FogInput, type FogMode } from './Fog.defs';

export { FogComponent, type FogInput, type FogMode };

/** What we last sent the adapter, so a frame with no change sends nothing. */
interface FogSnapshot {
  mode: FogMode;
  r: number;
  g: number;
  b: number;
  density: number;
  start: number;
  end: number;
  enabled: boolean;
}

interface FogRuntime {
  /** True while the adapter has this component's fog on. */
  applied: boolean;
  last?: FogSnapshot;
}

function snapshot(comp: FogComponent): FogSnapshot {
  return {
    mode: comp.mode,
    r: comp.color[0],
    g: comp.color[1],
    b: comp.color[2],
    density: comp.density,
    start: comp.start,
    end: comp.end,
    enabled: comp.enabled,
  };
}

function same(a: FogSnapshot | undefined, b: FogSnapshot): boolean {
  return (
    !!a &&
    a.mode === b.mode &&
    a.r === b.r &&
    a.g === b.g &&
    a.b === b.b &&
    a.density === b.density &&
    a.start === b.start &&
    a.end === b.end &&
    a.enabled === b.enabled
  );
}

export class FogSystem extends System {
  protected query = { required: [FogComponent] };
  private runtime = new WeakMap<FogComponent, FogRuntime>();

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: FogComponent): FogRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { applied: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) this.sync(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.sync(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(FogComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.applied) {
      this.world?.renderer?.setFog(null);
      this.eventBus.emit(FogEvents.CLEARED, { entityId: entity.id });
    }
    rt.applied = false;
    rt.last = undefined;
  }

  protected onUpdate(_dt: number): void {
    for (const entity of this.entities) this.sync(entity);
  }

  /** Push the component to the adapter if anything about it changed. */
  private sync(entity: Entity): void {
    const comp = entity.get(FogComponent);
    if (!comp) return;
    const r = this.world?.renderer;
    if (!r) return;
    const rt = this.getRuntime(comp);
    const now = snapshot(comp);
    if (same(rt.last, now)) return;
    rt.last = now;

    if (comp.enabled) {
      r.setFog(comp.toSpec());
      rt.applied = true;
      this.eventBus.emit(FogEvents.APPLIED, {
        entityId: entity.id,
        mode: comp.mode,
        density: comp.density,
      });
    } else if (rt.applied) {
      // Disabled after being on: switch it off, and say so once.
      r.setFog(null);
      rt.applied = false;
      this.eventBus.emit(FogEvents.CLEARED, { entityId: entity.id });
    }
  }
}
