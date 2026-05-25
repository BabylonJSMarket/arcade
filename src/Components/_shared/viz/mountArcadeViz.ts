/**
 * mountArcadeViz — bootstrap viz UI for a World in one call.
 *
 * Pulls in `mountVizRoot` and registers a "Entities" panel that lists every
 * live entity, its tags, and its components. Reactive via
 * world.entity.created/removed events.
 *
 * Hotkey: backtick (`) toggles the panel by default. Override via opts.
 *
 * Usage:
 *   import { mountArcadeViz } from '@babylonjsmarket/arcade/viz';
 *   const game = new ArcadeGame(new BabylonAdapter());
 *   await game.init(canvas);
 *   mountArcadeViz(game.world, { sceneName: 'Empty 3D' });
 *   await game.loadSceneFromUrl('/scenes/level1.json');
 *   game.start();
 */

import { createSignal } from 'solid-js';
import { WorldEvents } from '@babylonjsmarket/ecs';
import type { World } from '@babylonjsmarket/ecs';
import {
  vizStore,
  mountVizRoot,
  unmountVizRoot,
  EventBusDebuggerComponent,
  EventBusDebuggerSystem,
} from '@babylonjsmarket/ecs/viz';
import { EntityListPanel, type EntityListRow } from './EntityListPanel';
import { mountFpsOverlay, type FpsOverlayHandle } from './FpsOverlay';

export interface MountArcadeVizOptions {
  /** Name shown above the entity list. Default: 'arcade'. */
  sceneName?: string;
  /** Start the entity-list panel visible. Default: true. */
  visible?: boolean;
  /**
   * Pin a specific KeyboardEvent.code to toggle the entity-list panel. When
   * omitted, the viz layer assigns the next free F-key automatically.
   */
  toggleKey?: string;
  /** Panel id — only relevant if you mount multiple instances. */
  panelId?: string;
  /** Where to dock the entity-list panel. Default: 'top-right'. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Mount the EventBus debugger panel too (F4 to toggle, top-right).
   * Default: true. The EventBus debugger groups every fired event by entity
   * and flashes on activity — invaluable for seeing what your scene is doing.
   */
  eventBusDebugger?: boolean;
  /** Start the EventBus debugger visible. Default: false (F4 to show). */
  eventBusDebuggerVisible?: boolean;
  /**
   * Pin a small FPS counter at the top of the screen. Always visible, no
   * chrome — lives outside the vizStore panel system. Default: true.
   */
  fpsOverlay?: boolean;
}

export interface ArcadeVizHandle {
  /** Stop syncing, unregister the panel, tear down the DOM root. */
  dispose(): void;
}

export function mountArcadeViz(
  world: World,
  opts: MountArcadeVizOptions = {},
): ArcadeVizHandle {
  const panelId = opts.panelId ?? 'arcade-entities';
  const sceneName = opts.sceneName ?? 'arcade';

  vizStore.setSceneName(sceneName);
  mountVizRoot();

  // The panel renders from a reactive signal. We resync on every entity
  // lifecycle event — cheap because games rarely create thousands of entities
  // per frame, and the snapshot is just names + tags.
  const [rows, setRows] = createSignal<EntityListRow[]>(snapshot(world));
  const [name, setName] = createSignal(sceneName);

  const refresh = () => setRows(snapshot(world));

  const unsubCreated = world.getEventBus().on(WorldEvents.ENTITY_CREATED, refresh);
  const unsubRemoved = world.getEventBus().on(WorldEvents.ENTITY_REMOVED, refresh);
  // Component changes don't emit a world-level event with a stable name, but
  // they DO publish via wildcard `entity.{id}.component.{added,removed}` —
  // we listen wildcard via `*` if supported, otherwise we just resync on a
  // slow timer as a safety net. The set of component classes is mostly fixed
  // at scene-load time so the snapshot is usually correct.
  const tick = window.setInterval(refresh, 750);

  vizStore.registerPanel({
    id: panelId,
    title: 'Entities',
    position: opts.position ?? 'top-right',
    titleColor: '#9bf',
    // Empty unless the caller pinned one — the viz layer assigns an F-key and
    // owns the global toggle listener.
    activationKey: opts.toggleKey,
    // Default visibility; a persisted show/hide choice wins on reload.
    visible: opts.visible !== false,
    content: () => EntityListPanel({ rows, sceneName: name }),
  });

  // EventBus debugger — adds itself as a System + Component pair. Toggle: F4.
  const includeEventBusDebugger = opts.eventBusDebugger !== false;
  let debuggerEntity: { id: string } | null = null;
  if (includeEventBusDebugger) {
    world.addSystem(new EventBusDebuggerSystem(world.getEventBus()));
    const entity = world.createEntity('__debugger');
    entity.add(
      new EventBusDebuggerComponent({
        visible: opts.eventBusDebuggerVisible ?? false,
      }),
    );
    debuggerEntity = entity;
  }

  // Always-on FPS counter pinned to the top of the screen.
  const includeFps = opts.fpsOverlay !== false;
  let fps: FpsOverlayHandle | null = null;
  if (includeFps) fps = mountFpsOverlay();

  return {
    dispose() {
      window.clearInterval(tick);
      unsubCreated();
      unsubRemoved();
      vizStore.unregisterPanel(panelId);
      if (debuggerEntity) {
        const e = world.getEntity(debuggerEntity.id);
        if (e) world.removeEntity(e);
      }
      fps?.dispose();
      unmountVizRoot();
      void setName;
    },
  };
}

function snapshot(world: World): EntityListRow[] {
  return world.getEntities().map((entity) => ({
    id: entity.id,
    tags: entity.getTags(),
    components: entity.getComponentTypes().map((c) => c.name),
  }));
}
