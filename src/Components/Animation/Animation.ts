/**
 * Animation.ts — renderer-agnostic locomotion blend System.
 *
 * Pure math lives in Animation.core.ts. This System is a thin driver:
 *   1. Listens for SET_SPEED input events keyed by entityId.
 *   2. Each frame, calls the core's `update(speed, dt)` to get new clip
 *      weights + speedRatio.
 *   3. Pushes those through `world.renderer.playAnimation`,
 *      `setAnimationWeight`, `setAnimationSpeed`.
 *
 * It emits STATE_CHANGED when the dominant weight flips (idle→walk→run) and
 * BLEND_UPDATED every frame for HUDs. No @babylonjs / three imports here.
 */

import { AnimationEvents, AnimationInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { MeshComponent } from '../Mesh/Mesh.defs';
import { createAnimation } from './Animation.core';
import { AnimationComponent, type AnimationSetSpeedRequest } from './Animation.defs';

// ============================================
// System
// ============================================

export class AnimationSystem extends System {
  protected query = { required: [AnimationComponent] };
  private entitySpeeds = new Map<string, number>();
  /** Entities we've already started playback on this session. */
  private started = new Set<string>();

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(AnimationInputEvents.SET_SPEED, (e: AnimationSetSpeedRequest) => {
      this.entitySpeeds.set(e.entityId, e.speed);
    });

    for (const entity of this.entities) this.ensureInstance(entity);
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const id = (entity as unknown as { id: string }).id;
    const comp = entity.get(AnimationComponent);
    if (comp && this.started.has(id)) {
      const r = this.world?.renderer;
      // Free the adapter's clip-state so re-adding the entity later starts
      // from a clean slate.
      r?.stopAnimation(id, comp.idleClip);
      r?.stopAnimation(id, comp.walkClip);
      r?.stopAnimation(id, comp.runClip);
    }
    this.entitySpeeds.delete(id);
    this.started.delete(id);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(AnimationComponent);
    if (!comp || comp.instance) return;
    comp.instance = createAnimation(comp.params);
  }

  protected onUpdate(dt: number): void {
    const r = this.world?.renderer;

    for (const entity of this.entities) {
      const id = (entity as unknown as { id: string }).id;
      const comp = entity.get(AnimationComponent);
      if (!comp?.instance) continue;

      // Wait for a sibling Mesh's GLB before touching clips — an entity added
      // to a RUNNING world goes live while its model is still in flight.
      const mesh = entity.get(MeshComponent);
      const clipsReady = !mesh || mesh.instance?.getState().state === 'loaded';
      if (comp.autoPlay && r && clipsReady) {
        // Re-attempt each frame rather than latching after one pass: a clip can
        // appear LATER than the mesh — a retargeting component (AnimateMeshy)
        // grafts a shared library's clips on asynchronously, so a one-shot
        // start would permanently miss walk/run and leave the character stuck
        // in the single clip its GLB shipped with. `playAnimation` no-ops on an
        // already-playing clip (every adapter guards restart) and on a clip
        // that doesn't exist, so this stays a few map lookups per frame.
        r.playAnimation(id, comp.idleClip, true);
        r.playAnimation(id, comp.walkClip, true);
        r.playAnimation(id, comp.runClip, true);
        if (!this.started.has(id)) {
          this.started.add(id);
          this.eventBus.emit(AnimationEvents.READY, { entityId: id });
        }
      }

      const speed = this.entitySpeeds.get(id) ?? 0;
      const out = comp.instance.update(speed, dt);

      if (r) {
        r.setAnimationWeight(id, comp.idleClip, out.idleWeight);
        r.setAnimationWeight(id, comp.walkClip, out.walkWeight);
        r.setAnimationWeight(id, comp.runClip, out.runWeight);
        // Idle stays at 1 so its rhythm doesn't tie to locomotion pace.
        r.setAnimationSpeed(id, comp.idleClip, 1);
        r.setAnimationSpeed(id, comp.walkClip, out.speedRatio);
        r.setAnimationSpeed(id, comp.runClip, out.speedRatio);
      }

      comp.lastState = out.state;

      if (out.stateChanged) {
        this.eventBus.emit(AnimationEvents.STATE_CHANGED, {
          entityId: id,
          state: out.state,
        });
      }

      this.eventBus.emit(AnimationEvents.BLEND_UPDATED, {
        entityId: id,
        idleWeight: out.idleWeight,
        walkWeight: out.walkWeight,
        runWeight: out.runWeight,
        speedRatio: out.speedRatio,
      });
    }
  }

  protected onShutdown(): void {
    this.entitySpeeds.clear();
    this.started.clear();
  }
}

// The definitions live in Animation.defs.ts; re-exported so existing importers
// keep working. New code should import them from './Animation.defs' directly.
export { AnimationComponent, type AnimationInput, type AnimationSetSpeedRequest } from './Animation.defs';
