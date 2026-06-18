import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { FlashComponent, FlashSystem } from './Flash';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

describe('FlashSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new FlashSystem(eventBus));
    world.initialize();
  });

  function makeFlash(lifetime: number) {
    const e = world.createEntity();
    e.add(new MeshPrimitiveComponent({ primitive: 'sphere', position: [0, 0, 0] }));
    e.add(new FlashComponent({ lifetime }));
    return e;
  }

  it('removes the entity once its lifetime expires', () => {
    const e = makeFlash(0.05);
    // Not enough elapsed time yet.
    world.update(0.02);
    expect(world.getEntity(e.id)).toBeDefined();

    // Tick past the lifetime → removed.
    world.update(0.05);
    expect(world.getEntity(e.id)).toBeUndefined();
  });

  it('keeps a flash with remaining lifetime', () => {
    const e = makeFlash(1.0);
    world.update(0.1);
    const f = e.get(FlashComponent)!;
    expect(f.lifetime).toBeCloseTo(0.9, 5);
    expect(world.getEntity(e.id)).toBeDefined();
  });
});
