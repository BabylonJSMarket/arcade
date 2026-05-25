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
import type {
  LightHandle,
  MeshHandle,
  ShadowCasterHandle,
} from '@babylonjsmarket/ecs/renderer-types';
import { ShadowComponent, type ShadowInput } from './Shadow.core';
import { DirectionalLightEvents } from '../DirectionalLight/DirectionalLight';
import {
  MeshPrimitiveComponent,
  MeshPrimitiveEvents,
} from '../MeshPrimitive/MeshPrimitive';

export { ShadowComponent, type ShadowInput };

export const ShadowEvents = {
  SHADOW_ENABLED: 'shadow.enabled',
  SHADOW_DISABLED: 'shadow.disabled',
  SHADOW_CASTER_ADDED: 'shadow.caster.added',
} as const;

interface ShadowRuntime {
  casterHandle?: ShadowCasterHandle;
  meshHandle?: MeshHandle;
  initialized: boolean;
}

export class ShadowSystem extends System {
  private unsubscribes: Array<() => void> = [];
  /** Cached mesh handles keyed by entity id, populated from meshprimitive.created. */
  private meshHandles = new Map<string, MeshHandle>();
  /**
   * Cached directional-light handles keyed by entity id, populated from
   * directionallight.created. The DirectionalLight handle now lives in
   * DirectionalLightSystem's runtime WeakMap (not on the Component), so the
   * only renderer-agnostic way to learn it is via the CREATED event payload —
   * mirroring how mesh handles arrive on meshprimitive.created.
   */
  private lightHandles = new Map<string, LightHandle>();
  private runtime = new WeakMap<ShadowComponent, ShadowRuntime>();
  protected query = { required: [ShadowComponent] };

  private getRuntime(comp: ShadowComponent): ShadowRuntime {
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
    this.unsubscribes.push(
      this.eventBus.on(MeshPrimitiveEvents.CREATED, (data: { entityId: string; handle: MeshHandle }) => {
        if (!data?.handle) return;
        this.meshHandles.set(data.entityId, data.handle);
        const entity = this.world?.getEntity(data.entityId);
        if (entity) this.apply(entity);
      }),
    );

    this.unsubscribes.push(
      this.eventBus.on(
        DirectionalLightEvents.CREATED,
        (data: { entityId: string; handle?: LightHandle }) => {
          if (!data?.handle) return;
          this.lightHandles.set(data.entityId, data.handle);
          // A light may come up after a shadow-casting mesh already exists —
          // re-apply so those entities attach now that a target exists.
          for (const entity of this.entities) this.apply(entity);
        },
      ),
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
    this.lightHandles.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.apply(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    // Parked (pooled, out of play): keep the shadow caster attached. The mesh
    // is hidden while parked so it casts nothing anyway, and re-attaching on
    // every reuse would churn the shadow generator's render list.
    if (!entity.active) return;
    const comp = entity.get(ShadowComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    if (rt.casterHandle) {
      this.world?.renderer?.detachShadowCaster(rt.casterHandle);
      this.eventBus.emit(ShadowEvents.SHADOW_DISABLED, { entityId: entity.id });
      rt.casterHandle = undefined;
      rt.initialized = false;
    }
  }

  protected onUpdate(_deltaTime: number): void {}

  private apply(entity: Entity): void {
    const shadow = entity.get(ShadowComponent);
    if (!shadow) return;
    const rt = this.getRuntime(shadow);
    if (rt.initialized) return;
    const meshHandle = this.meshHandles.get(entity.id);
    if (!meshHandle) return;
    const r = this.world?.renderer;
    if (!r) return;

    const lightHandle = this.findDirectionalLightHandle();
    rt.meshHandle = meshHandle;

    if (shadow.castShadow && lightHandle) {
      rt.casterHandle = r.attachShadowCaster(lightHandle, meshHandle);
      this.eventBus.emit(ShadowEvents.SHADOW_CASTER_ADDED, { entityId: entity.id });
    }

    if (shadow.receiveShadow) {
      r.setMeshReceiveShadows(meshHandle, true);
    }

    rt.initialized = true;
    this.eventBus.emit(ShadowEvents.SHADOW_ENABLED, {
      entityId: entity.id,
      castShadow: shadow.castShadow,
      receiveShadow: shadow.receiveShadow,
    });
  }

  private findDirectionalLightHandle(): LightHandle | undefined {
    // The first directional-light handle we heard about via CREATED.
    for (const handle of this.lightHandles.values()) {
      if (handle) return handle;
    }
    return undefined;
  }
}
