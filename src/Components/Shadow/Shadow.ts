/**
 * Shadow.ts — renderer-agnostic System.
 * Listens for meshprimitive.created; for any entity that also has a
 * ShadowComponent, attaches the mesh as a shadow caster through the active
 * renderer adapter. Babylon = ShadowGenerator.addShadowCaster. Three =
 * mesh.castShadow = true (adapter already enabled renderer.shadowMap).
 */

import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import type { LightHandle, MeshHandle } from '@babylonjsmarket/ecs/renderer-types';
import { ShadowComponent, type ShadowInput } from './Shadow.core';
import { DirectionalLightComponent } from '../DirectionalLight/DirectionalLight';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';

export { ShadowComponent, type ShadowInput };

export const ShadowEvents = {
  SHADOW_ENABLED: 'shadow.enabled',
  SHADOW_DISABLED: 'shadow.disabled',
  SHADOW_CASTER_ADDED: 'shadow.caster.added',
} as const;

export class ShadowSystem extends System {
  private unsubscribes: Array<() => void> = [];
  /** Cached mesh handles keyed by entity id, populated from meshprimitive.created. */
  private meshHandles = new Map<string, MeshHandle>();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ShadowComponent] };
  }

  protected onInitialize(): void {
    this.unsubscribes.push(
      this.eventBus.on('meshprimitive.created', (data: { entityId: string; handle: MeshHandle }) => {
        if (!data?.handle) return;
        this.meshHandles.set(data.entityId, data.handle);
        const entity = this.world?.getEntity(data.entityId);
        if (entity) this.apply(entity);
      }),
    );

    // MeshPrimitive creates its meshes during addSystem → onEntityAdded (before
    // world.initialize), which fires meshprimitive.created before any System
    // subscribing in onInitialize can hear it. Pull handles straight off the
    // component to catch already-created meshes.
    for (const entity of this.entities) {
      if (!this.meshHandles.has(entity.id)) {
        const mp = entity.get(MeshPrimitiveComponent);
        if (mp?.handle) this.meshHandles.set(entity.id, mp.handle);
      }
      this.apply(entity);
    }
  }

  protected onShutdown(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.meshHandles.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.apply(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(ShadowComponent);
    if (comp?.casterHandle) {
      this.world?.renderer?.detachShadowCaster(comp.casterHandle);
      this.eventBus.emit(ShadowEvents.SHADOW_DISABLED, { entityId: entity.id });
      comp.casterHandle = undefined;
      comp.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {}

  private apply(entity: Entity): void {
    const shadow = entity.get(ShadowComponent);
    if (!shadow || shadow.initialized) return;
    const meshHandle = this.meshHandles.get(entity.id);
    if (!meshHandle) return;
    const r = this.world?.renderer;
    if (!r) return;

    const lightHandle = this.findDirectionalLightHandle();
    shadow.meshHandle = meshHandle;

    if (shadow.castShadow && lightHandle) {
      shadow.casterHandle = r.attachShadowCaster(lightHandle, meshHandle);
      this.eventBus.emit(ShadowEvents.SHADOW_CASTER_ADDED, { entityId: entity.id });
    }

    if (shadow.receiveShadow) {
      r.setMeshReceiveShadows(meshHandle, true);
    }

    shadow.initialized = true;
    this.eventBus.emit(ShadowEvents.SHADOW_ENABLED, {
      entityId: entity.id,
      castShadow: shadow.castShadow,
      receiveShadow: shadow.receiveShadow,
    });
  }

  private findDirectionalLightHandle(): LightHandle | undefined {
    if (!this.world) return undefined;
    for (const entity of this.world.getEntities()) {
      const dl = entity.get(DirectionalLightComponent);
      if (dl?.handle) return dl.handle;
    }
    return undefined;
  }
}
