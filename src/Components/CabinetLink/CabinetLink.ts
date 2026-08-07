/**
 * CabinetLink.ts — renderer-agnostic System turning pointer clicks on a cabinet
 * into "walk me over" and "start the game".
 *
 * Pure data lives in CabinetLink.core.ts. This System owns the pointer
 * listeners and the ray pick, and talks to everything else over the EventBus:
 * it emits FirstPersonCameraEvents.GOTO to move the player and
 * CabinetLinkEvents.LAUNCH for the host app to route on. It never imports a
 * camera or a router.
 */

import { CabinetLinkEvents, FirstPersonCameraEvents } from '../../events';
import { System } from '@babylonjsmarket/ecs';
import type { Entity, EventBus } from '@babylonjsmarket/ecs';
import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';
import { MeshComponent } from '../Mesh/Mesh';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';
import { CabinetLinkComponent, type CabinetLinkInput } from './CabinetLink.core';

export { CabinetLinkComponent, type CabinetLinkInput };

/**
 * Milliseconds within which a second click on the SAME cabinet counts as a
 * double-click. Deliberately ours rather than the DOM's `dblclick`: we need the
 * first click to act immediately (start walking) while still recognising the
 * second, and `dblclick` fires only after the browser's own delay.
 */
const DOUBLE_CLICK_MS = 400;

export class CabinetLinkSystem extends System {
  protected query = { required: [CabinetLinkComponent] };

  private pointerHandler: ((e: PointerEvent) => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastClick: { entityId: string; at: number } | null = null;
  /** Injected clock so tests can drive the double-click window deterministically. */
  private now: () => number;

  constructor(eventBus: EventBus, opts: { now?: () => number } = {}) {
    super(eventBus);
    this.now = opts.now ?? (() => Date.now());
  }

  protected onInitialize(): void {
    if (typeof window === 'undefined') return; // headless tests drive handleClick directly
    const canvas = this.world?.renderer?.getRenderingCanvas?.() ?? null;
    if (!canvas) return;
    this.canvas = canvas;
    this.pointerHandler = (e: PointerEvent) => {
      // Only the primary button, and only real clicks on the canvas.
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('pointerdown', this.pointerHandler);
  }

  /** Nothing to do per frame — this System is purely event/pointer driven. */
  protected onUpdate(): void {}

  protected onShutdown(): void {
    if (this.canvas && this.pointerHandler) {
      this.canvas.removeEventListener('pointerdown', this.pointerHandler);
    }
    this.canvas = null;
    this.pointerHandler = null;
    this.lastClick = null;
  }

  /**
   * Resolve a canvas-space click to a cabinet and act on it. Public so a host
   * app (or a test) can feed synthetic coordinates without a DOM.
   */
  handleClick(x: number, y: number): void {
    const r = this.world?.renderer;
    if (!r) return;
    const hit = r.pickAtScreenPoint(x, y);
    const entity = hit ? this.entityForMesh(hit.meshId) : undefined;

    const now = this.now();
    const pending =
      this.lastClick && now - this.lastClick.at <= DOUBLE_CLICK_MS ? this.lastClick : null;

    if (pending) {
      // A second click inside the window. It CONFIRMS the pending cabinet
      // unless it clearly landed on a different one.
      //
      // The leniency is not sloppiness — it's required. The first click starts
      // the player walking, so by the time the second lands the camera has
      // already moved and the same screen pixel is usually pointing at a wall.
      // Demanding a second hit on the same mesh would make double-click almost
      // impossible to perform.
      if (entity && entity.id !== pending.entityId) {
        this.approach(entity, hit!, now);
        return;
      }
      const target = this.entityById(pending.entityId);
      const comp = target?.get(CabinetLinkComponent);
      this.lastClick = null; // a third click starts a fresh pair
      if (target && comp?.interactive) {
        this.eventBus.emit(CabinetLinkEvents.LAUNCH, {
          entityId: target.id,
          game: comp.game,
          route: comp.route,
          title: comp.title,
        });
      }
      return;
    }

    // A first click only counts when it actually hits an interactive cabinet —
    // clicking the floor does nothing and arms nothing.
    if (!entity) return;
    this.approach(entity, hit!, now);
  }

  /** Walk the player to `entity` and arm it as the double-click candidate. */
  private approach(entity: Entity, hit: { x: number; y: number; z: number }, now: number): void {
    const comp = entity.get(CabinetLinkComponent);
    if (!comp?.interactive) return;
    this.lastClick = { entityId: entity.id, at: now };
    const spot = comp.approachFrom(this.cabinetPosition(entity, hit));
    this.eventBus.emit(FirstPersonCameraEvents.GOTO, spot);
    this.eventBus.emit(CabinetLinkEvents.FOCUSED, {
      entityId: entity.id,
      game: comp.game,
      title: comp.title,
      ...spot,
    });
  }

  private entityById(id: string): Entity | undefined {
    for (const entity of this.entities) if (entity.id === id) return entity;
    return undefined;
  }

  /**
   * Map a picked mesh back to its cabinet entity.
   *
   * An instanced model's parts are named `<entityId>_<partName>` by the
   * adapter's clone naming, so a hit on the side art or the marquee still
   * resolves to the machine it belongs to — matching only the root would make
   * most of the cabinet unclickable.
   */
  private entityForMesh(meshId: string): Entity | undefined {
    if (!meshId) return undefined;
    for (const entity of this.entities) {
      if (meshId === entity.id || meshId.startsWith(`${entity.id}_`)) return entity;
    }
    return undefined;
  }

  /**
   * The cabinet's own floor position.
   *
   * Read from the sibling Mesh (or MeshPrimitive) rather than from the pick:
   * the pick lands wherever on the machine the pointer happened to hit — the
   * top of the marquee, the side art — and standing "in front of" THAT would
   * put the player at a different spot depending on where they clicked.
   */
  private cabinetPosition(entity: Entity, hit: { x: number; y: number; z: number }): Vec3 {
    const mesh = entity.get(MeshComponent);
    if (mesh) return [...mesh.params.position] as Vec3;
    const prim = entity.get(MeshPrimitiveComponent);
    if (prim) return [...prim.position] as Vec3;
    return [hit.x, hit.y, hit.z];
  }
}
