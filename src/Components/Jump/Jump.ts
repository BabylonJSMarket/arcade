/**
 * Jump — System.
 *
 * Starts a jump on the configured key (or a `jump.request` event), then each
 * frame drives the character's vertical offset along {@link JumpComponent.arc}
 * for `duration` seconds and restores the ground height on landing. One jump at
 * a time — a key-repeat or a second press mid-air is ignored (no double-jump).
 *
 * Vertical drive goes through the entity's own transform data, never a raw
 * renderer call, so it composes with a followed Mesh (the System writes the
 * mesh's `position[1]`, which the follow applies while it copies X/Z from the
 * proxy) and never fights the mover for the handle. Falls back to the
 * MeshPrimitive proxy's Y when there's no Mesh.
 */

import { JumpEvents, JumpInputEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import { MeshComponent } from '../Mesh/Mesh';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { KeyboardInputEvents } from '../../inputEvents';
import { JumpComponent, type JumpStartedEvent } from './Jump.core';

export class JumpSystem extends System {
  protected query = { required: [JumpComponent] };
  /** Ground Y captured when a jump began, restored on landing. Keyed by entity id. */
  private groundY = new Map<string, number>();

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  protected onInitialize(): void {
    this.listen(KeyboardInputEvents.KEYDOWN, (e: { code: string }) => {
      for (const entity of this.entities) {
        if (entity.get(JumpComponent)?.key === e.code) this.start(entity);
      }
    });
    this.listen(JumpInputEvents.JUMP, (e: { entityId?: string }) => {
      const entity = e.entityId ? this.world?.getEntity(e.entityId) : undefined;
      if (entity && this.entities.has(entity)) this.start(entity);
    });
  }

  protected onEntityRemoved(entity: Entity): void {
    this.groundY.delete(entity.id);
  }

  private start(entity: Entity): void {
    const j = entity.get(JumpComponent);
    if (!j || j.airborne) return; // already in the air — ignore key-repeat / second press
    j.airborne = true;
    j.elapsed = 0;
    this.groundY.set(entity.id, this.readY(entity));
    this.eventBus.emit(JumpEvents.STARTED, {
      entityId: entity.id,
      duration: j.duration,
      height: j.height,
    } satisfies JumpStartedEvent);
  }

  protected onUpdate(dt: number): void {
    if (dt <= 0) return;
    for (const entity of this.entities) {
      const j = entity.get(JumpComponent);
      if (!j?.airborne) continue;
      j.elapsed += dt;
      const p = Math.min(1, j.elapsed / j.duration);
      const base = this.groundY.get(entity.id) ?? 0;
      this.writeY(entity, base + j.height * j.arc(p));
      if (p >= 1) {
        j.airborne = false;
        j.elapsed = 0;
        this.writeY(entity, base);
        this.groundY.delete(entity.id);
        this.eventBus.emit(JumpEvents.LANDED, { entityId: entity.id });
      }
    }
  }

  /**
   * Current vertical offset — a followed Mesh's Y if present, else the proxy's.
   * The Mesh follow reads `params.position[1]` for the mesh's Y each frame (it
   * copies only X/Z from the proxy), so writing that field is what lifts the
   * figure; the capsule proxy and the camera stay grounded (no jump-bob).
   */
  private readY(entity: Entity): number {
    const mesh = entity.get(MeshComponent);
    if (mesh) return mesh.params.position[1];
    const mp = entity.get(MeshPrimitiveComponent);
    return mp ? mp.position[1] : 0;
  }

  private writeY(entity: Entity, y: number): void {
    const mesh = entity.get(MeshComponent);
    if (mesh) {
      mesh.params.position[1] = y;
      return;
    }
    const mp = entity.get(MeshPrimitiveComponent);
    if (mp) mp.position[1] = y;
  }
}

export * from './Jump.core';
