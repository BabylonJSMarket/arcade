import { HealthEvents, HealthInputEvents } from '../../events';
import { describe, it, expect } from 'vitest';
import { HealthComponent, type HealthDamageRequest, type HealthHealRequest } from './Health.defs';

describe('HealthComponent', () => {
  it('applies defaults', () => {
    const c = new HealthComponent();
    expect(c.hp).toBe(10);
    expect(c.maxHp).toBe(10);
    expect(c.invulnSeconds).toBe(0);
    expect(c.respawnPosition).toBeNull();
    expect(c.invulnUntil).toBe(0);
  });

  it('defaults maxHp to hp when hp alone is supplied', () => {
    const c = new HealthComponent({ hp: 3 });
    expect(c.hp).toBe(3);
    expect(c.maxHp).toBe(3);
  });

  it('merges input on top of defaults', () => {
    const c = new HealthComponent({
      hp: 5,
      maxHp: 8,
      invulnSeconds: 0.5,
    });
    expect(c.hp).toBe(5);
    expect(c.maxHp).toBe(8);
    expect(c.invulnSeconds).toBe(0.5);
    expect(c.respawnPosition).toBeNull();
  });

  it('respawnPosition round-trips through serialize()', () => {
    const a = new HealthComponent({ respawnPosition: [1, 2, 3] });
    expect(a.respawnPosition).toEqual([1, 2, 3]);
    const b = new HealthComponent(a.serialize());
    expect(b.respawnPosition).toEqual([1, 2, 3]);
    expect(b.serialize()).toEqual(a.serialize());
  });

  it('serialize round-trips with all fields set', () => {
    const a = new HealthComponent({
      hp: 4,
      maxHp: 9,
      invulnSeconds: 0.75,
      respawnPosition: [0, 1, -2],
    });
    const b = new HealthComponent(a.serialize());
    expect(b.serialize()).toEqual(a.serialize());
    expect(b.hp).toBe(a.hp);
    expect(b.maxHp).toBe(a.maxHp);
    expect(b.invulnSeconds).toBe(a.invulnSeconds);
    expect(b.respawnPosition).toEqual(a.respawnPosition);
  });

  it('serialize omits respawnPosition when none was set', () => {
    const a = new HealthComponent({ hp: 6 });
    const payload = a.serialize();
    expect(payload.respawnPosition).toBeUndefined();
  });

  it('exposes the documented HealthEvents / HealthInputEvents constants', () => {
    expect(HealthEvents.DAMAGED).toBe('health.damaged');
    expect(HealthEvents.HEALED).toBe('health.healed');
    expect(HealthEvents.DIED).toBe('health.died');
    expect(HealthEvents.RESPAWNED).toBe('health.respawned');
    expect(HealthInputEvents.DAMAGE).toBe('health.damage');
    expect(HealthInputEvents.HEAL).toBe('health.heal');
  });

  it('HealthDamageRequest / HealthHealRequest interfaces match the documented shape', () => {
    // Pure type-shape check — if these interfaces drift, the assignment
    // below stops compiling and `npm run build` catches it.
    const dmg: HealthDamageRequest = { entityId: 'e1', damage: 2 };
    const heal: HealthHealRequest = { entityId: 'e1', amount: 3 };
    expect(dmg.entityId).toBe('e1');
    expect(dmg.damage).toBe(2);
    expect(heal.entityId).toBe('e1');
    expect(heal.amount).toBe(3);
  });
});
