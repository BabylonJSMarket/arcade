/**
 * NeonSign.ts — renderer-agnostic System that turns a NeonSign into glowing
 * words plus the light they throw.
 *
 * The lettering is either a world-FIXED label (`billboard: false` — a sign
 * screwed to a wall doesn't swivel to follow you, and being edge-on from the
 * side is correct) or, with `extruded: true`, real slab geometry built by the
 * `neonText` adapter plugin (adapter/NeonSign.babylon.ts). The plugin is a
 * Route-B seam: a host registers it at bootstrap
 * (`registerBabylonNeonTextExtension(adapter)`), and where it is absent — a
 * Three project, headless tests, a bootstrap that forgot — an extruded sign
 * quietly draws the label quad instead. No warning: the quad IS the sign,
 * just flatter.
 *
 * The glow is a light sharing the sign's colour, sitting slightly in front of
 * the face so it washes the room rather than the wall's far side: a point
 * light by default, or a spot aimed along the facing and tilted down.
 *
 * Every field is diffed per frame, so a settings slider or an editor can
 * recolour, move, resize or re-letter a live sign and the lettering and the
 * light follow together.
 */

import { NeonSignEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { Entity, EventBus } from '@babylonjsmarket/ecs';
import type { Color, LabelHandle, LightHandle, Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import {
  NEON_TEXT_EXTENSION,
  sameTriple,
  type NeonTextExtension,
  type NeonTextSpec,
} from './NeonSign.core';
import { cloneVec3, NeonSignComponent, type NeonSignInput, type NeonSignLightKind } from './NeonSign.defs';

export { NeonSignComponent, type NeonSignInput, type NeonSignLightKind };
export {
  NEON_TEXT_EXTENSION,
  extrudedTextTransform,
  signNormal,
  spotDirection,
  type NeonTextExtension,
  type NeonTextSpec,
} from './NeonSign.core';

/** Everything the per-frame diff compares — a plain copy of the component. */
interface NeonSignSnapshot {
  text: string;
  color: Vec3;
  position: Vec3;
  rotation: Vec3;
  size: number;
  glow: number;
  range: number;
  glowOffset: number;
  fontSize: number;
  lightKind: NeonSignLightKind;
  spotAngle: number;
  spotExponent: number;
  extruded: boolean;
  depth: number;
  fontUrl: string;
}

interface NeonSignRuntime {
  label?: LabelHandle;
  light?: LightHandle;
  /** The plugin has this sign's extruded lettering live under the entity id. */
  extruded: boolean;
  /**
   * Bumped on every build and every teardown, so a plugin `create` that
   * resolves after the sign was rebuilt or removed is recognised as stale.
   */
  generation: number;
  initialized: boolean;
  last?: NeonSignSnapshot;
}

function snapshot(c: NeonSignComponent): NeonSignSnapshot {
  return {
    text: c.text,
    color: cloneVec3(c.color),
    position: cloneVec3(c.position),
    rotation: cloneVec3(c.rotation),
    size: c.size,
    glow: c.glow,
    range: c.range,
    glowOffset: c.glowOffset,
    fontSize: c.fontSize,
    lightKind: c.lightKind,
    spotAngle: c.spotAngle,
    spotExponent: c.spotExponent,
    extruded: c.extruded,
    depth: c.depth,
    fontUrl: c.fontUrl,
  };
}

/** The lettering's emissive intensity: follows `glow`, but a tube is never dimmer than lit. */
function tubeIntensity(glow: number): number {
  return Math.max(1, glow);
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
      rt = { extruded: false, generation: 0, initialized: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  private extension(): NeonTextExtension | undefined {
    return this.world?.renderer?.extension<NeonTextExtension>(NEON_TEXT_EXTENSION);
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
    this.disposeLettering(entity, rt);
    this.disposeLight(rt);
    rt.initialized = false;
    rt.last = undefined;
  }

  /**
   * Push any change made from outside (a panel, an editor, an event handler)
   * to the renderer: lettering and light are rebuilt or retuned as the change
   * demands, and nothing is touched while nothing moved.
   */
  protected onUpdate(): void {
    for (const entity of this.entities) {
      const comp = entity.get(NeonSignComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.initialized || !rt.last) continue;
      const r = this.world?.renderer;
      if (!r) continue;

      const now = snapshot(comp);
      const prev = rt.last;
      const recoloured = !sameTriple(prev.color, now.color);
      const moved = !sameTriple(prev.position, now.position);
      const turned = !sameTriple(prev.rotation, now.rotation);
      // Anything that changes the lettering's shape means new geometry: the
      // label re-rasterises, the slab is re-extruded. A moved extruded slab
      // rebuilds too — the plugin's contract has no "move" on purpose.
      const reshaped =
        now.text !== prev.text ||
        now.size !== prev.size ||
        now.depth !== prev.depth ||
        now.fontSize !== prev.fontSize ||
        now.fontUrl !== prev.fontUrl ||
        now.extruded !== prev.extruded ||
        turned ||
        (moved && rt.extruded);

      if (reshaped) {
        this.buildLettering(entity, comp, rt);
      } else {
        if (moved && rt.label) r.setLabelPosition(rt.label, now.position[0], now.position[1], now.position[2]);
        if (recoloured && rt.label) r.setLabelColor(rt.label, now.color[0], now.color[1], now.color[2]);
        if ((recoloured || now.glow !== prev.glow) && rt.extruded) {
          this.extension()?.setColor(entity.id, cloneVec3(now.color), tubeIntensity(now.glow));
        }
      }

      // The light: a change of kind, reach or cone shape is a new light; a
      // glow crossing zero adds or removes one; everything else retunes.
      const lit = now.glow > 0;
      const relit =
        now.lightKind !== prev.lightKind ||
        now.range !== prev.range ||
        now.spotAngle !== prev.spotAngle ||
        now.spotExponent !== prev.spotExponent ||
        lit !== prev.glow > 0;
      if (relit) {
        this.disposeLight(rt);
        this.buildLight(entity, comp, rt);
      } else if (rt.light) {
        if (now.glow !== prev.glow) r.updateLightIntensity(rt.light, now.glow);
        if (moved || turned || now.glowOffset !== prev.glowOffset) {
          const at = comp.glowPosition();
          r.setLightPosition(rt.light, at[0], at[1], at[2]);
        }
        if (turned && now.lightKind === 'spot') {
          const d = comp.spotDirection();
          r.setLightDirection(rt.light, d[0], d[1], d[2]);
        }
        if (recoloured) r.setLightColor(rt.light, now.color[0], now.color[1], now.color[2]);
      }

      if (now.text !== prev.text) {
        this.eventBus.emit(NeonSignEvents.TEXT_CHANGED, { entityId: entity.id, text: now.text });
      }
      if (recoloured) {
        this.eventBus.emit(NeonSignEvents.COLOR_CHANGED, {
          entityId: entity.id,
          color: cloneVec3(now.color) as Color,
        });
      }
      rt.last = now;
    }
  }

  private ensureSign(entity: Entity): void {
    const comp = entity.get(NeonSignComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.initialized) return;
    if (!this.world?.renderer) return;

    this.buildLettering(entity, comp, rt);
    this.buildLight(entity, comp, rt);

    rt.initialized = true;
    rt.last = snapshot(comp);
    this.eventBus.emit(NeonSignEvents.CREATED, { entityId: entity.id, text: comp.text });
  }

  /**
   * Build the lettering afresh: extruded through the plugin when asked for
   * and available, the label quad otherwise. A plugin build is asynchronous
   * (the font has to arrive); if it comes back empty the quad steps in, and
   * if the sign was rebuilt or removed in the meantime the result is dropped.
   */
  private buildLettering(entity: Entity, comp: NeonSignComponent, rt: NeonSignRuntime): void {
    this.disposeLettering(entity, rt);
    const ext = comp.extruded ? this.extension() : undefined;
    if (!ext) {
      this.buildLabel(entity, comp, rt);
      return;
    }
    const gen = rt.generation;
    const spec: NeonTextSpec = {
      text: comp.text,
      fontUrl: comp.fontUrl,
      size: comp.size,
      depth: comp.depth,
      position: cloneVec3(comp.position),
      rotation: cloneVec3(comp.rotation),
      color: cloneVec3(comp.color),
      intensity: tubeIntensity(comp.glow),
    };
    ext.create(entity.id, spec).then(
      (meshId) => {
        if (rt.generation !== gen) return; // superseded or torn down meanwhile
        if (meshId === null) {
          this.buildLabel(entity, comp, rt);
          return;
        }
        rt.extruded = true;
        this.eventBus.emit(NeonSignEvents.EXTRUDED, { entityId: entity.id, text: comp.text });
      },
      () => {
        if (rt.generation !== gen) return;
        this.buildLabel(entity, comp, rt);
      },
    );
  }

  private buildLabel(entity: Entity, comp: NeonSignComponent, rt: NeonSignRuntime): void {
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
  }

  /** Tear down whichever lettering is up, and invalidate any build in flight. */
  private disposeLettering(entity: Entity, rt: NeonSignRuntime): void {
    rt.generation += 1;
    const r = this.world?.renderer;
    if (rt.label) {
      r?.disposeLabel(rt.label);
      rt.label = undefined;
    }
    // Dispose through the plugin whether or not the slab has landed yet: a
    // build still in flight is cancelled by the same call.
    this.extension()?.dispose(entity.id);
    rt.extruded = false;
  }

  private buildLight(entity: Entity, comp: NeonSignComponent, rt: NeonSignRuntime): void {
    const r = this.world?.renderer;
    // glow 0 = tube only. Useful for a sign that shouldn't add to the light
    // budget (a small one, or a room that already has enough lamps).
    if (!r || comp.glow <= 0) return;
    const glowAt = comp.glowPosition();
    if (comp.lightKind === 'spot') {
      rt.light = r.createSpotLight(`${entity.id}_glow`, {
        position: glowAt,
        direction: comp.spotDirection(),
        angle: comp.spotAngle,
        exponent: comp.spotExponent,
        intensity: comp.glow,
        diffuse: cloneVec3(comp.color),
        // A coloured pool on the carpet, not a pinpoint glint on the walls.
        specular: [0, 0, 0],
        range: comp.range,
      });
      return;
    }
    rt.light = r.createPointLight(`${entity.id}_glow`, {
      position: glowAt,
      diffuse: comp.color,
      intensity: comp.glow,
      range: comp.range,
    });
  }

  private disposeLight(rt: NeonSignRuntime): void {
    if (!rt.light) return;
    this.world?.renderer?.disposeLight(rt.light);
    rt.light = undefined;
  }
}
