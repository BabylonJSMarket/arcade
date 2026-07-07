import { HealthEvents, HealthInputEvents } from '../../events';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthComponent, HealthSystem } from './Health';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('HealthSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: HealthSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new HealthSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  function makeEntity(hpInput = {}) {
    const entity = world.createEntity();
    entity.add(new HealthComponent(hpInput));
    return entity;
  }

  it('applies damage and emits DAMAGED with the new hp', () => {
    const entity = makeEntity({ hp: 10, maxHp: 10 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.DAMAGED, spy);
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 3 });
    expect(entity.get(HealthComponent)!.hp).toBe(7);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, hp: 7, maxHp: 10, damage: 3 }),
    );
  });

  it('ignores damage aimed at an unknown entity id', () => {
    makeEntity({ hp: 10 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.DAMAGED, spy);
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: 'ghost', damage: 3 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores damage <= 0 and damage to an already-dead entity', () => {
    const entity = makeEntity({ hp: 2 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.DAMAGED, spy);
    // Zero/negative damage is a no-op.
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 0 });
    expect(spy).not.toHaveBeenCalled();
    // Kill it, then a further hit on a 0-hp entity is dropped.
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 5 });
    spy.mockClear();
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('absorbs damage during the invulnerability window', () => {
    const now = 1000;
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(now);
    try {
      const entity = makeEntity({ hp: 10, invulnSeconds: 1 });
      const spy = vi.fn();
      eventBus.on(HealthEvents.DAMAGED, spy);
      // First hit lands and opens a 1s i-frame window (invulnUntil = now + 1000).
      eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 2 });
      expect(entity.get(HealthComponent)!.hp).toBe(8);
      expect(entity.get(HealthComponent)!.invulnUntil).toBe(now + 1000);
      // Second hit during the window is fully absorbed.
      spy.mockClear();
      nowSpy.mockReturnValue(now + 500);
      eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 5 });
      expect(entity.get(HealthComponent)!.hp).toBe(8);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('emits DIED when hp reaches zero (no respawn)', () => {
    const entity = makeEntity({ hp: 3 });
    const died = vi.fn();
    const respawned = vi.fn();
    eventBus.on(HealthEvents.DIED, died);
    eventBus.on(HealthEvents.RESPAWNED, respawned);
    eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 5 });
    expect(entity.get(HealthComponent)!.hp).toBe(0);
    expect(died).toHaveBeenCalledWith({ entityId: entity.id });
    expect(respawned).not.toHaveBeenCalled();
  });

  it('respawns a respawn-configured entity: snaps mesh, restores hp, emits RESPAWNED', () => {
    const now = 5000;
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(now);
    try {
      const entity = world.createEntity();
      const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [9, 9, 9] });
      entity.add(mesh);
      entity.add(
        new HealthComponent({ hp: 3, maxHp: 3, invulnSeconds: 0.2, respawnPosition: [1, 2, 3] }),
      );
      const respawned = vi.fn();
      eventBus.on(HealthEvents.RESPAWNED, respawned);

      eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 5 });

      const h = entity.get(HealthComponent)!;
      // Mesh position DATA is rewritten to the spawn point (System does not call
      // the adapter — the transform owner pushes it).
      expect(mesh.position).toEqual([1, 2, 3]);
      expect(h.hp).toBe(3);
      // Grace window is at least 1s even though invulnSeconds is 0.2.
      expect(h.invulnUntil).toBe(now + 1000);
      expect(respawned).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: entity.id, hp: 3, maxHp: 3 }),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('respawns cleanly when the entity has no MeshPrimitive', () => {
    const entity = makeEntity({ hp: 2, maxHp: 2, respawnPosition: [0, 0, 0] });
    const respawned = vi.fn();
    eventBus.on(HealthEvents.RESPAWNED, respawned);
    expect(() =>
      eventBus.emit(HealthInputEvents.DAMAGE, { entityId: entity.id, damage: 5 }),
    ).not.toThrow();
    expect(entity.get(HealthComponent)!.hp).toBe(2);
    expect(respawned).toHaveBeenCalled();
  });

  it('heals up to maxHp and emits HEALED', () => {
    const entity = makeEntity({ hp: 4, maxHp: 10 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.HEALED, spy);
    eventBus.emit(HealthInputEvents.HEAL, { entityId: entity.id, amount: 3 });
    expect(entity.get(HealthComponent)!.hp).toBe(7);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entity.id, hp: 7, maxHp: 10, amount: 3 }),
    );
  });

  it('clamps a heal to maxHp', () => {
    const entity = makeEntity({ hp: 8, maxHp: 10 });
    eventBus.emit(HealthInputEvents.HEAL, { entityId: entity.id, amount: 100 });
    expect(entity.get(HealthComponent)!.hp).toBe(10);
  });

  it('ignores a heal aimed at an unknown entity id', () => {
    makeEntity({ hp: 4, maxHp: 10 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.HEALED, spy);
    eventBus.emit(HealthInputEvents.HEAL, { entityId: 'ghost', amount: 3 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores a heal of <= 0 and a heal at full hp', () => {
    const entity = makeEntity({ hp: 10, maxHp: 10 });
    const spy = vi.fn();
    eventBus.on(HealthEvents.HEALED, spy);
    // Non-positive amount.
    eventBus.emit(HealthInputEvents.HEAL, { entityId: entity.id, amount: 0 });
    // Already at full hp.
    eventBus.emit(HealthInputEvents.HEAL, { entityId: entity.id, amount: 5 });
    expect(spy).not.toHaveBeenCalled();
    expect(entity.get(HealthComponent)!.hp).toBe(10);
  });

  it('is event-driven — onUpdate does no per-frame work', () => {
    makeEntity({ hp: 10 });
    renderer.calls.length = 0;
    world.update(1 / 60);
    expect(renderer.calls).toHaveLength(0);
  });
});
