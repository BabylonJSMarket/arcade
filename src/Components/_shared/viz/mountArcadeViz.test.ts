/**
 * Smoke tests for mountArcadeViz — verifies it registers a panel, reacts to
 * world.entity.created / .removed, and tears down cleanly.
 *
 * Renderer-free: we don't need a real BabylonAdapter to assert that the
 * vizStore receives the right calls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World, EventBus, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { mountArcadeViz } from './mountArcadeViz';
import { vizStore } from '@babylonjsmarket/ecs/viz';

describe('mountArcadeViz', () => {
  let world: World;
  let handle: { dispose(): void } | null;

  beforeEach(() => {
    document.body.innerHTML = '';
    vizStore.clear();
    const eventBus = new EventBus();
    world = new World({ eventBus, renderer: new MockRendererAdapter() });
    world.initialize();
    handle = null;
  });

  afterEach(() => {
    handle?.dispose();
    document.body.innerHTML = '';
    vizStore.clear();
  });

  it('registers an entities panel and mounts the viz root container', () => {
    handle = mountArcadeViz(world, { sceneName: 'TestScene' });
    expect(vizStore.panels['arcade-entities']).toBeDefined();
    expect(document.getElementById('viz-root')).not.toBeNull();
  });

  it('respects visible: false', () => {
    handle = mountArcadeViz(world, { visible: false });
    expect(vizStore.isVisible('arcade-entities')).toBe(false);
  });

  it('dispose() unregisters the panel and removes the root', () => {
    handle = mountArcadeViz(world);
    expect(vizStore.panels['arcade-entities']).toBeDefined();
    handle.dispose();
    handle = null;
    expect(vizStore.panels['arcade-entities']).toBeUndefined();
    expect(document.getElementById('viz-root')).toBeNull();
  });

  it('survives entity create + remove without throwing', () => {
    handle = mountArcadeViz(world, { sceneName: 'Sandbox' });
    const e = world.createEntity('Foo');
    e.addTag('player');
    expect(() => world.removeEntity(e)).not.toThrow();
  });

  it('toggle hotkey flips visibility', () => {
    handle = mountArcadeViz(world, { visible: true, toggleKey: 'KeyZ' });
    expect(vizStore.isVisible('arcade-entities')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    expect(vizStore.isVisible('arcade-entities')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    expect(vizStore.isVisible('arcade-entities')).toBe(true);
  });
});
