import { describe, it, expect, beforeEach } from 'vitest';
import { HealthBarComponent, HealthBarSystem } from './HealthBar';
import { HealthComponent } from '../Health/Health.defs';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('HealthBarSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: HealthBarSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new HealthBarSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  function makeBarEntity(opts: {
    hp?: number;
    maxHp?: number;
    bar?: ConstructorParameters<typeof HealthBarComponent>[0];
    pos?: [number, number, number];
  } = {}) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({
      primitive: 'capsule',
      position: opts.pos ?? [0, 1, 0],
    });
    entity.add(mesh);
    entity.add(new HealthComponent({ hp: opts.hp ?? 10, maxHp: opts.maxHp ?? 10 }));
    entity.add(new HealthBarComponent(opts.bar));
    return entity;
  }

  it('creates a background + fill mesh and billboards both on first tick', () => {
    makeBarEntity();
    const created = renderer.calls.filter((c) => c.method === 'createMesh');
    const bg = created.find((c) => String(c.args[0]).startsWith('healthbar_bg_'));
    const fill = created.find((c) => String(c.args[0]).startsWith('healthbar_fill_'));
    expect(bg).toBeDefined();
    expect(fill).toBeDefined();
    const billboards = renderer.calls.filter((c) => c.method === 'setMeshBillboardMode');
    expect(billboards).toHaveLength(2);
    expect(billboards.every((c) => c.args[1] === 'all')).toBe(true);
  });

  it('only builds the bar meshes once (idempotent ensureBars)', () => {
    makeBarEntity();
    const before = renderer.calls.filter((c) => c.method === 'createMesh').length;
    world.update(1 / 60);
    world.update(1 / 60);
    const after = renderer.calls.filter((c) => c.method === 'createMesh').length;
    expect(after).toBe(before);
  });

  it('hides the bar at full HP when hideAtFullHp is on (zero-scale both meshes)', () => {
    makeBarEntity({ hp: 10, maxHp: 10, bar: { hideAtFullHp: true } });
    renderer.calls.length = 0;
    world.update(1 / 60);
    const scales = renderer.calls.filter((c) => c.method === 'setMeshScale');
    expect(scales.length).toBe(2);
    // Hidden via [0,0,1] scale.
    expect(scales.every((c) => c.args[1] === 0 && c.args[2] === 0)).toBe(true);
    // No position write happens on the hidden path.
    expect(renderer.calls.some((c) => c.method === 'setMeshPosition')).toBe(false);
  });

  it('shows and scales the fill to the hp ratio at partial HP', () => {
    const entity = makeBarEntity({ hp: 10, maxHp: 10, bar: { hideAtFullHp: true } });
    entity.get(HealthComponent)!.hp = 5; // 50%
    renderer.calls.length = 0;
    world.update(1 / 60);
    const scales = renderer.calls.filter((c) => c.method === 'setMeshScale');
    const fillScale = scales.find((c) => c.args[1] === 0.5);
    expect(fillScale).toBeDefined();
    // Background is full scale.
    expect(scales.some((c) => c.args[1] === 1 && c.args[2] === 1)).toBe(true);
    // Both meshes get positioned when visible.
    expect(renderer.calls.filter((c) => c.method === 'setMeshPosition')).toHaveLength(2);
  });

  it('anchors the shrinking fill to the LEFT when fillFromLeft is true', () => {
    const entity = makeBarEntity({
      hp: 10, maxHp: 10, pos: [0, 1, 0], bar: { hideAtFullHp: false, fillFromLeft: true, width: 2 },
    });
    entity.get(HealthComponent)!.hp = 5; // ratio 0.5, shrink = 0.5 * 2 * 0.5 = 0.5
    renderer.calls.length = 0;
    world.update(1 / 60);
    const positions = renderer.calls.filter((c) => c.method === 'setMeshPosition');
    // bg at x=0, fill anchored to the left at x - shrink = -0.5
    const fillPos = positions.find((c) => c.args[1] === -0.5);
    expect(fillPos).toBeDefined();
  });

  it('anchors the shrinking fill to the RIGHT when fillFromLeft is false', () => {
    const entity = makeBarEntity({
      hp: 10, maxHp: 10, pos: [0, 1, 0], bar: { hideAtFullHp: false, fillFromLeft: false, width: 2 },
    });
    entity.get(HealthComponent)!.hp = 5; // shrink = 0.5
    renderer.calls.length = 0;
    world.update(1 / 60);
    const positions = renderer.calls.filter((c) => c.method === 'setMeshPosition');
    // fill anchored to the right at x + shrink = +0.5
    const fillPos = positions.find((c) => c.args[1] === 0.5);
    expect(fillPos).toBeDefined();
  });

  it('treats maxHp of 0 as an empty (ratio 0) bar without dividing by zero', () => {
    const entity = makeBarEntity({ hp: 0, maxHp: 0, bar: { hideAtFullHp: false } });
    expect(entity.get(HealthComponent)!.maxHp).toBe(0);
    renderer.calls.length = 0;
    expect(() => world.update(1 / 60)).not.toThrow();
    const scales = renderer.calls.filter((c) => c.method === 'setMeshScale');
    // Fill collapses to ratio 0.
    expect(scales.some((c) => c.args[1] === 0)).toBe(true);
  });

  it('parks (hides via visibility) the bar meshes when the entity is deactivated', () => {
    const entity = makeBarEntity();
    world.update(1 / 60);
    renderer.calls.length = 0;
    entity.active = false; // leaves the query while still parked, not destroyed
    const vis = renderer.calls.filter((c) => c.method === 'setMeshVisible');
    expect(vis.length).toBe(2);
    expect(vis.every((c) => c.args[1] === false)).toBe(true);
    // Parked, not disposed.
    expect(renderer.calls.some((c) => c.method === 'disposeMesh')).toBe(false);
  });

  it('re-shows the parked meshes when the entity is reactivated', () => {
    const entity = makeBarEntity();
    world.update(1 / 60);
    entity.active = false;
    renderer.calls.length = 0;
    entity.active = true; // re-acquire → onEntityAdded re-shows
    const vis = renderer.calls.filter((c) => c.method === 'setMeshVisible');
    expect(vis.length).toBeGreaterThanOrEqual(2);
    expect(vis.some((c) => c.args[1] === true)).toBe(true);
  });

  it('disposes the bar meshes when the entity is destroyed', () => {
    const entity = makeBarEntity();
    world.update(1 / 60);
    renderer.calls.length = 0;
    world.removeEntity(entity); // active === true on this path → dispose
    const disposed = renderer.calls.filter((c) => c.method === 'disposeMesh');
    expect(disposed.length).toBe(2);
  });

  it('skips cleanly when no entities are present', () => {
    expect(() => world.update(1 / 60)).not.toThrow();
  });
});
