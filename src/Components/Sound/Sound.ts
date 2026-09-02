/**
 * Sound.ts — renderer-agnostic System for audio clips, flat or positional.
 *
 * One component = one clip. A flat one (`spatial: false`) is the hall's bed —
 * crowd murmur, everywhere at once. A positional one rides its own entity's
 * mesh, so a cabinet's attract loop is loud at the machine and gone three
 * metres away.
 *
 * Three things make this more than "call play":
 *
 *  - Browsers refuse to start audio until the user has clicked or pressed a
 *    key. `initAudio` is awaited once per world before any clip is created;
 *    if it comes back false the System warns ONCE, becomes inert, and arms a
 *    one-shot retry on the first pointerdown / keydown, creating every clip
 *    that was waiting when the engine finally comes up.
 *  - Spatial falloff is judged from the audio LISTENER, which must ride the
 *    player's camera. The camera components announce their handle on their
 *    CREATED events; this System attaches the listener to whichever arrives.
 *    No camera event, no listener — sounds still play, judged from the origin.
 *  - A clip lands asynchronously, so a positional sound is pinned to its mesh
 *    once BOTH exist — the mesh handle comes from MeshPrimitive's CREATED /
 *    Mesh's LOADED, whichever the entity carries.
 */

import {
  ArcCameraEvents,
  FirstPersonCameraEvents,
  MeshEvents,
  MeshPrimitiveEvents,
  SoundEvents,
  SoundInputEvents,
} from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus, Entity } from '@babylonjsmarket/ecs';
import type { CameraHandle, MeshHandle, SoundHandle } from '@babylonjsmarket/ecs/renderer-types';
import { SoundComponent, type SoundDistanceModel, type SoundInput } from './Sound.defs';

export { SoundComponent, type SoundDistanceModel, type SoundInput };

interface SoundRuntime {
  handle?: SoundHandle;
  /** A createSound is in flight. */
  loading: boolean;
  /** The clip failed to load; never retried. */
  failed: boolean;
  /** The entity was destroyed while the clip was still loading. */
  orphaned: boolean;
  /** The entity is parked in a pool (silenced, clip kept). */
  parked: boolean;
  /** Pinned to its mesh already. */
  attached: boolean;
  lastVolume?: number;
  lastPlaying?: boolean;
}

/** Payload shape shared by the two camera CREATED events. */
interface CameraCreatedEvent {
  entityId: string;
  handle?: CameraHandle;
}
/** Payload shape shared by MeshPrimitive CREATED and Mesh LOADED. */
interface MeshHandleEvent {
  entityId: string;
  handle?: MeshHandle;
}

type AudioState = 'unknown' | 'pending' | 'ready' | 'blocked';

export class SoundSystem extends System {
  protected query = { required: [SoundComponent] };
  private runtime = new WeakMap<SoundComponent, SoundRuntime>();
  private audio: AudioState = 'unknown';
  /** The one warning this System ever prints about a silent world. */
  private warned = false;
  private cameraHandle: CameraHandle | null = null;
  /** Mesh handles by entity id, for pinning positional clips. */
  private meshHandles = new Map<string, MeshHandle>();
  private gestureTarget: EventTarget | null = null;
  private gestureHandler: (() => void) | null = null;

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  private getRuntime(comp: SoundComponent): SoundRuntime {
    let rt = this.runtime.get(comp);
    if (!rt) {
      rt = { loading: false, failed: false, orphaned: false, parked: false, attached: false };
      this.runtime.set(comp, rt);
    }
    return rt;
  }

  protected onInitialize(): void {
    const onCamera = (e: CameraCreatedEvent) => {
      if (!e?.handle) return;
      this.cameraHandle = e.handle;
      // The adapter applies this once its engine is up, so it is safe to call
      // before initAudio has resolved.
      this.world?.renderer?.attachAudioListener(e.handle);
    };
    this.listen(FirstPersonCameraEvents.CREATED, onCamera);
    this.listen(ArcCameraEvents.CREATED, onCamera);

    const onMesh = (e: MeshHandleEvent) => {
      if (!e?.handle) return;
      this.meshHandles.set(e.entityId, e.handle);
      const entity = this.world?.getEntity(e.entityId);
      if (entity && this.entities.has(entity)) this.pin(entity);
    };
    this.listen(MeshPrimitiveEvents.CREATED, onMesh);
    this.listen(MeshEvents.LOADED, onMesh);

    this.listen(SoundInputEvents.PLAY, (e: { entityId: string }) => {
      const comp = this.componentFor(e?.entityId);
      if (!comp) return;
      comp.playing = true;
      const rt = this.getRuntime(comp);
      // A PLAY while already playing restarts from the top — the diff below
      // would see no change, so drive the adapter directly.
      if (rt.handle) {
        this.world?.renderer?.playSound(rt.handle);
        rt.lastPlaying = true;
      }
    });
    this.listen(SoundInputEvents.STOP, (e: { entityId: string }) => {
      const comp = this.componentFor(e?.entityId);
      if (!comp) return;
      comp.playing = false;
      const rt = this.getRuntime(comp);
      if (rt.handle) {
        this.world?.renderer?.stopSound(rt.handle);
        rt.lastPlaying = false;
      }
    });
    this.listen(SoundInputEvents.SET_VOLUME, (e: { entityId: string; volume: number }) => {
      const comp = this.componentFor(e?.entityId);
      if (comp && typeof e.volume === 'number') comp.volume = e.volume;
    });

    this.armGestureRetry();
    void this.ensureAudio();
  }

  protected onShutdown(): void {
    if (this.gestureTarget && this.gestureHandler) {
      this.gestureTarget.removeEventListener('pointerdown', this.gestureHandler);
      this.gestureTarget.removeEventListener('keydown', this.gestureHandler);
    }
    this.gestureTarget = null;
    this.gestureHandler = null;
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(SoundComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    rt.parked = false;
    if (rt.handle) {
      // Back from a pooled park: the clip survived, so just resume it.
      const wants = comp.playing ?? comp.autoplay;
      if (wants) this.world?.renderer?.playSound(rt.handle);
      rt.lastPlaying = wants;
      return;
    }
    this.ensureSound(entity); // a no-op while a load is still in flight
  }

  protected onEntityRemoved(entity: Entity): void {
    const comp = entity.get(SoundComponent);
    if (!comp) return;
    const rt = this.getRuntime(comp);
    const r = this.world?.renderer;
    if (!entity.active) {
      // Park-aware: a pooled entity keeps its clip for the next spawn, just
      // silenced. A clip still loading is silenced when it lands (see
      // ensureSound). A true destroy, below, releases it.
      rt.parked = true;
      if (rt.handle) {
        r?.stopSound(rt.handle);
        rt.lastPlaying = false;
      }
      return;
    }
    if (rt.handle) {
      r?.disposeSound(rt.handle);
      rt.handle = undefined;
      rt.attached = false;
    } else if (rt.loading) {
      // Destroyed mid-load: release the clip the moment it lands.
      rt.orphaned = true;
    }
    this.meshHandles.delete(entity.id);
  }

  protected onUpdate(_dt: number): void {
    const r = this.world?.renderer;
    if (!r) return;
    for (const entity of this.entities) {
      const comp = entity.get(SoundComponent);
      if (!comp) continue;
      const rt = this.getRuntime(comp);
      if (!rt.handle) continue;

      if (rt.lastVolume !== comp.volume) {
        r.setSoundVolume(rt.handle, comp.volume);
        rt.lastVolume = comp.volume;
      }
      if (comp.playing !== undefined && comp.playing !== rt.lastPlaying) {
        if (comp.playing) r.playSound(rt.handle);
        else r.stopSound(rt.handle);
        rt.lastPlaying = comp.playing;
      }
    }
  }

  /** The Sound component on a live entity of ours, by id. */
  private componentFor(entityId: string | undefined): SoundComponent | undefined {
    if (!entityId) return undefined;
    const entity = this.world?.getEntity(entityId);
    if (!entity || !this.entities.has(entity)) return undefined;
    return entity.get(SoundComponent);
  }

  /**
   * Bring the audio engine up, once. Resolves when the answer is known; the
   * waiting clips are created on success, and a single warning is printed on
   * the first refusal — never per entity, never per frame.
   */
  private async ensureAudio(): Promise<void> {
    if (this.audio === 'ready' || this.audio === 'pending') return;
    const r = this.world?.renderer;
    if (!r) return;
    this.audio = 'pending';
    const ok = await r.initAudio();
    if (ok) {
      this.audio = 'ready';
      for (const entity of this.entities) this.ensureSound(entity);
      return;
    }
    this.audio = 'blocked';
    if (!this.warned) {
      this.warned = true;
      console.warn(
        '[Sound] The audio engine is unavailable or blocked until a user gesture; ' +
          'the room stays silent and will retry on the first click or key.',
      );
      this.eventBus.emit(SoundEvents.BLOCKED, {});
    }
  }

  /** Retry a refused engine on the first click / key, then get out of the way. */
  private armGestureRetry(): void {
    const canvas = this.world?.renderer?.getRenderingCanvas();
    const target: EventTarget | null = canvas ?? (typeof window !== 'undefined' ? window : null);
    if (!target) return;
    this.gestureHandler = () => {
      if (this.audio === 'ready') return;
      if (this.audio === 'blocked') this.audio = 'unknown';
      void this.ensureAudio();
    };
    // pointerdown lands on the canvas; keydown goes to whatever has focus, and
    // a canvas usually doesn't, so a key on the page counts too.
    target.addEventListener('pointerdown', this.gestureHandler);
    target.addEventListener('keydown', this.gestureHandler);
    this.gestureTarget = target;
  }

  /** Load one entity's clip if the engine is up and nothing is in flight. */
  private ensureSound(entity: Entity): void {
    const comp = entity.get(SoundComponent);
    if (!comp || !comp.src) return;
    const rt = this.getRuntime(comp);
    if (rt.handle || rt.loading || rt.failed) return;
    if (this.audio !== 'ready') return; // created when ensureAudio succeeds
    const r = this.world?.renderer;
    if (!r) return;

    rt.loading = true;
    const src = comp.src;
    void r.createSound(entity.id, comp.toSpec()).then((handle) => {
      rt.loading = false;
      if (!handle) {
        rt.failed = true;
        this.eventBus.emit(SoundEvents.ERROR, { entityId: entity.id, src });
        return;
      }
      if (rt.orphaned) {
        r.disposeSound(handle);
        return;
      }
      rt.handle = handle;
      rt.lastVolume = comp.volume;
      // The spec's autoplay already decided the initial state; honour an
      // explicit `playing` that disagrees with it — or the park that happened
      // while the clip was still on its way (a pool pre-building its slots).
      const wants = rt.parked ? false : (comp.playing ?? comp.autoplay);
      if (wants !== comp.autoplay) {
        if (wants) r.playSound(handle);
        else r.stopSound(handle);
      }
      rt.lastPlaying = wants;
      this.pin(entity);
      this.eventBus.emit(SoundEvents.READY, { entityId: entity.id, src });
    });
  }

  /** Pin a positional clip to its entity's mesh once both handles exist. */
  private pin(entity: Entity): void {
    const comp = entity.get(SoundComponent);
    if (!comp || !comp.spatial) return;
    const rt = this.getRuntime(comp);
    if (!rt.handle || rt.attached) return;
    const mesh = this.meshHandles.get(entity.id);
    if (!mesh) return;
    this.world?.renderer?.attachSoundToMesh(rt.handle, mesh);
    rt.attached = true;
  }
}
