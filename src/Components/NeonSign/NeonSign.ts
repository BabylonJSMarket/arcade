/**
 * NeonSign.ts — renderer-agnostic System that turns a NeonSign into glowing
 * words plus the light they throw.
 *
 * The lettering is a world-FIXED label (`billboard: false`): a sign screwed to
 * a wall doesn't swivel to follow you, and being edge-on from the side is
 * correct. The glow is a PointLight sharing the sign's colour, sitting slightly
 * in front of the face so it washes the room rather than the wall's far side.
 */

import { NeonSignEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { Entity, EventBus } from '@babylonjsmarket/ecs';
import type { LabelHandle, LightHandle } from '@babylonjsmarket/ecs/renderer-types';
import { NeonSignComponent, type NeonSignInput } from './NeonSign.core';

export { NeonSignComponent, type NeonSignInput };

interface NeonSignRuntime {
  label?: LabelHandle;
  light?: LightHandle;
  text: string;
  initialized: boolean;
}

export class NeonSignSystem extends System {
  protected query = { required: [NeonSignComponent] };
  private runtime = new WeakMap<NeonSignComponent, NeonSignRuntime>();

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: NeonSignComponent): NeonSignRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { text: comp.text, initialized: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) this.ensureSign(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureSign(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(NeonSignComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    const r = this.world?.renderer;
    if (rt.label) r?.disposeLabel(rt.label);
    if (rt.light) r?.disposeLight(rt.light);
    rt.label = undefined;
    rt.light = undefined;
    rt.initialized = false;
  }

  /** Re-letter a sign whose text was changed from outside (a panel, an event). */
  protected onUpdate(): void {
    for (const entity of this.entities) {
      const comp = entity.get(NeonSignComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.label) continue;
      if (rt.text !== comp.text) {
        rt.text = comp.text;
        this.world?.renderer?.setLabelText(rt.label, comp.text);
        this.eventBus.emit(NeonSignEvents.TEXT_CHANGED, {
          entityId: entity.id,
          text: comp.text,
        });
      }
    }
  }

  private ensureSign(entity: Entity): void {
    const comp = entity.get(NeonSignComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    const r = this.world?.renderer;
    if (!r) return;

    rt.label = r.createLabel(entity.id, {
      text: comp.text,
      color: comp.color,
      fontSize: comp.fontSize,
      fontWeight: 'bold',
      scale: comp.size,
      billboard: false,
      rotation: comp.rotation,
    });
    r.setLabelPosition(rt.label, comp.position[0], comp.position[1], comp.position[2]);

    // glow 0 = tube only. Useful for a sign that shouldn't add to the light
    // budget (a small one, or a room that already has enough lamps).
    if (comp.glow > 0) {
      const glowAt = comp.glowPosition();
      rt.light = r.createPointLight(`${entity.id}_glow`, {
        position: glowAt,
        diffuse: comp.color,
        intensity: comp.glow,
        range: comp.range,
      });
    }

    rt.initialized = true;
    rt.text = comp.text;
    this.eventBus.emit(NeonSignEvents.CREATED, { entityId: entity.id, text: comp.text });
  }
}
