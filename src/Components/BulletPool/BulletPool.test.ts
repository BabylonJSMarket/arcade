import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import {
  BulletPoolComponent,
  BulletPoolSystem,
  BulletPoolEvents,
  BulletPoolInputEvents,
} from './BulletPool';
import { BulletComponent } from '../Bullet/Bullet';
import { MeshPrimitiveComponent, MeshPrimitiveSystem } from '../MeshPrimitive/MeshPrimitive';

describe('BulletPoolComponent', () => {
  it('applies defaults', () => {
    const comp = new BulletPoolComponent();
    expect(comp.params.poolSize).toBe(50);
    expect(comp.params.bulletDiameter).toBe(0.3);
    expect(comp.color).toEqual([1, 1, 0]);
  });

  it('merges params + color', () => {
    const comp = new BulletPoolComponent({ poolSize: 10, bulletDiameter: 0.5, color: [0, 1, 1] });
    expect(comp.params.poolSize).toBe(10);
    expect(comp.params.bulletDiameter).toBe(0.5);
    expect(comp.color).toEqual([0, 1, 1]);
  });

  it('serialize round-trips', () => {
    const a = new BulletPoolComponent({ poolSize: 12, bulletDiameter: 0.4, color: [1, 0, 0] });
    const b = new BulletPoolComponent(a.serialize());
    expect(b.params).toEqual(a.params);
    expect(b.color).toEqual(a.color);
  });
});

describe('BulletPoolSystem (World pool)', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new MeshPrimitiveSystem(eventBus));
    world.addSystem(new BulletPoolSystem(eventBus));
    world.initialize();
  });

  const makePool = (poolSize = 4) => {
    const entity = world.createEntity('Pool');
    entity.add(new BulletPoolComponent({ poolSize }));
    world.update(1 / 60); // lazy registerPool on first tick
    return entity;
  };

  const allBullets = () => world.getEntitiesByTag('bullet');
  const live = () => allBullets().filter((e) => e.active);

  it('pre-allocates `poolSize` bullet entities, all parked', () => {
    makePool(4);
    expect(allBullets().length).toBe(4);
    expect(live().length).toBe(0);
    expect(renderer.calls.filter((c) => c.method === 'createMesh').length).toBe(4);
  });

  it('names pooled entities `bullet-N`', () => {
    makePool(3);
    const ids = allBullets()
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(['bullet-0', 'bullet-1', 'bullet-2']);
  });

  it('emits bulletPool.ready once registered', () => {
    const ready = vi.fn();
    eventBus.on(BulletPoolEvents.READY, ready);
    makePool(2);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({ size: 2 }));
  });

  it('FIRE acquires a reused bullet (no new mesh), placed + aimed', () => {
    makePool(4);
    const createdBefore = renderer.calls.filter((c) => c.method === 'createMesh').length;

    eventBus.emit(BulletPoolInputEvents.FIRE, {
      x: 2,
      y: 0.8,
      z: 3,
      dx: 0,
      dz: 1,
      speed: 30,
      lifetime: 1.2,
    });

    expect(live().length).toBe(1);
    // Reuse, not allocate.
    expect(renderer.calls.filter((c) => c.method === 'createMesh').length).toBe(createdBefore);
    const bullet = live()[0]!;
    const b = bullet.get(BulletComponent)!;
    expect(b.direction).toEqual([0, 0, 1]);
    expect(b.speed).toBe(30);
    const placed = renderer.calls.some(
      (c) => c.method === 'setMeshPosition' && c.args[1] === 2 && c.args[2] === 0.8 && c.args[3] === 3,
    );
    expect(placed).toBe(true);
  });

  it('applies a per-shot color override to the reused bullet mesh', () => {
    makePool(4);
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 0, y: 1, z: 0, dz: 1, color: [0.2, 0.4, 0.6] });

    const bullet = live()[0]!;
    const handle = bullet.get(MeshPrimitiveComponent)!.handle;
    const colored = renderer.calls.some(
      (c) =>
        c.method === 'setMeshColor' &&
        c.args[0] === handle &&
        c.args[1] === 0.2 &&
        c.args[2] === 0.4 &&
        c.args[3] === 0.6,
    );
    expect(colored).toBe(true);
  });

  it('ignores FIRE before the pool has registered (guarded)', () => {
    // No pool entity created yet → registered stays false.
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 0, y: 1, z: 0, dz: 1 });
    expect(allBullets().length).toBe(0);
  });

  it('FIRE is a no-op when the pool is exhausted (all slots live)', () => {
    makePool(1);
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 0, y: 1, z: 0, dz: 1 });
    expect(live().length).toBe(1);
    // A second shot recycles the oldest slot rather than allocating — still 1 live.
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 5, y: 1, z: 0, dz: 1 });
    expect(live().length).toBe(1);
    expect(allBullets().length).toBe(1);
  });

  it('FIRE is a no-op for a zero-size pool (acquire returns nothing)', () => {
    const entity = world.createEntity('Pool');
    entity.add(new BulletPoolComponent({ poolSize: 0 }));
    world.update(1 / 60); // registers an empty pool
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 0, y: 1, z: 0, dz: 1 });
    expect(live().length).toBe(0); // nothing to hand out → guarded
  });

  it('does not re-register the pool on a second tick', () => {
    const ready = vi.fn();
    eventBus.on(BulletPoolEvents.READY, ready);
    makePool(2); // first tick registers + emits READY
    world.update(1 / 60); // second tick: early-return on `registered`
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('removeEntity releases a fired bullet back to the pool (parked, reused)', () => {
    makePool(2);
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 0, y: 1, z: 0, dz: 1 });
    const bullet = live()[0]!;
    const id = bullet.id;

    world.removeEntity(bullet); // pool-owned → released, not destroyed
    expect(world.getEntity(id)).toBeDefined();
    expect(world.getEntity(id)!.active).toBe(false);

    // Next shot reuses it.
    eventBus.emit(BulletPoolInputEvents.FIRE, { x: 5, y: 1, z: 0, dz: 1 });
    expect(live().length).toBe(1);
    expect(allBullets().length).toBe(2);
  });
});
