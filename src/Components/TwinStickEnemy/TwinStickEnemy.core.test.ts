import { describe, it, expect } from 'vitest';
import { TwinStickEnemyComponent } from './TwinStickEnemy.defs';
import { wanderHeading, allDeathClips, chooseDeathClip, decideLocomotion } from './TwinStickEnemy.core';

describe('TwinStickEnemyComponent', () => {
  it('applies defaults', () => {
    const c = new TwinStickEnemyComponent();
    expect(c.speed).toBe(2.5);
    expect(c.spawnerId).toBe('');
    expect(c.pointsOnKill).toBe(100);
    expect(c.separationRadius).toBe(1.0);
    expect(c.contactRange).toBe(1.1);
    expect(c.contactDamage).toBe(1);
    expect(c.targetTag).toBe('player');
  });

  it('merges overrides on top of defaults', () => {
    const c = new TwinStickEnemyComponent({
      speed: 5,
      pointsOnKill: 250,
      targetTag: 'hero',
    });
    expect(c.speed).toBe(5);
    expect(c.pointsOnKill).toBe(250);
    expect(c.targetTag).toBe('hero');
    expect(c.separationRadius).toBe(1.0); // untouched
    expect(c.contactRange).toBe(1.1); // untouched
    expect(c.contactDamage).toBe(1); // untouched
  });

  it('serialize round-trips', () => {
    const a = new TwinStickEnemyComponent({
      speed: 3.5,
      spawnerId: 'Spawner1',
      pointsOnKill: 200,
      separationRadius: 1.2,
      contactRange: 1.5,
      contactDamage: 2,
      targetTag: 'hero',
    });
    const b = new TwinStickEnemyComponent(a.serialize());
    expect(b.speed).toBe(a.speed);
    expect(b.spawnerId).toBe(a.spawnerId);
    expect(b.pointsOnKill).toBe(a.pointsOnKill);
    expect(b.separationRadius).toBe(a.separationRadius);
    expect(b.contactRange).toBe(a.contactRange);
    expect(b.contactDamage).toBe(a.contactDamage);
    expect(b.targetTag).toBe(a.targetTag);
  });
});

describe('wanderHeading', () => {
  it('heads directly away from the crowd with no jitter', () => {
    // Self is +X of the centroid → away vector points +X.
    const [x, z] = wanderHeading(2, 0, 0, 0);
    expect(x).toBeCloseTo(1, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('returns a unit vector', () => {
    const [x, z] = wanderHeading(3, -4, 0.5, 1.2);
    expect(Math.hypot(x, z)).toBeCloseTo(1, 5);
  });

  it('falls back to the random angle when sitting on the centroid', () => {
    const [x, z] = wanderHeading(0, 0, 0.5, Math.PI / 2); // π/2 → +Z
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(1, 5);
  });
});

describe('allDeathClips', () => {
  it('returns deathClips when no directional clips are configured', () => {
    expect(allDeathClips(['a', 'b'], [], [])).toEqual(['a', 'b']);
  });

  it('returns the de-duped union when directional clips are configured', () => {
    expect(allDeathClips(['a'], ['a', 'back'], ['fwd']).sort()).toEqual(['a', 'back', 'fwd']);
  });
});

describe('decideLocomotion', () => {
  it('attacks within contact range', () => {
    expect(decideLocomotion(0.5, 1, 'walk', 1.15)).toBe('attack');
    // boundary: distance === contactRange is still attack (<=)
    expect(decideLocomotion(1, 1, 'walk', 1.15)).toBe('attack');
  });

  it('walks once past the hysteresis-scaled exit threshold', () => {
    // contactRange*hysteresis = 1.15; just beyond → walk
    expect(decideLocomotion(1.2, 1, 'attack', 1.15)).toBe('walk');
  });

  it('holds the current state inside the dead-band (anti-flicker)', () => {
    // Between contactRange (1) and contactRange*hysteresis (1.15): keep current.
    expect(decideLocomotion(1.1, 1, 'attack', 1.15)).toBe('attack');
    expect(decideLocomotion(1.1, 1, 'walk', 1.15)).toBe('walk');
  });
});

describe('chooseDeathClip', () => {
  const back = ['Shot_and_Blown_Back', 'Walking_Blow_Back'];
  const fwd = ['Fall_Forward'];

  it('picks a fall-back clip when shot in the front (dot < 0)', () => {
    expect(back).toContain(chooseDeathClip([], back, fwd, -0.8, 0));
    expect(back).toContain(chooseDeathClip([], back, fwd, -0.8, 0.99));
  });

  it('picks a fall-forward clip when shot in the back (dot >= 0)', () => {
    expect(chooseDeathClip([], back, fwd, 0.5, 0)).toBe('Fall_Forward');
    expect(chooseDeathClip([], back, fwd, 0, 0)).toBe('Fall_Forward');
  });

  it('uses rand to index within the directional list', () => {
    // rand 0 → index 0, rand ~1 → last index.
    expect(chooseDeathClip([], back, fwd, -1, 0)).toBe('Shot_and_Blown_Back');
    expect(chooseDeathClip([], back, fwd, -1, 0.99)).toBe('Walking_Blow_Back');
  });

  it('falls back to random deathClips when direction is unknown', () => {
    expect(chooseDeathClip(['r1', 'r2'], back, fwd, null, 0)).toBe('r1');
  });

  it('falls back to deathClips when the matching directional list is empty', () => {
    // Shot in the back but no fall-forward clips configured → random deathClips.
    expect(chooseDeathClip(['r1'], back, [], 0.5, 0)).toBe('r1');
  });

  it('returns undefined when there are no clips at all', () => {
    expect(chooseDeathClip([], [], [], -1, 0)).toBeUndefined();
  });
});
