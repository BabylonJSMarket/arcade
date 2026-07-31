import { BulletEvents, EnemyEvents, EntityPoolInputEvents, HealthEvents, HealthInputEvents, LineOfSightEvents, ScoreInputEvents, SkeletonAnimatorEvents, SkeletonAnimatorInputEvents } from '../../events';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { TwinStickEnemyComponent, TwinStickEnemySystem } from './TwinStickEnemy';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { ObstacleComponent } from '../Obstacle/Obstacle.core';

describe('TwinStickEnemySystem knockback', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new TwinStickEnemySystem(eventBus));
    world.initialize();
  });

  function makeEnemy(pos: [number, number, number], extra: Record<string, unknown> = {}) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new TwinStickEnemyComponent({ separationRadius: 1.0, ...extra }));
    return entity;
  }

  // Burn the spawn frame: a freshly-added enemy is a "newborn" and is skipped
  // once so two systems don't write its mesh on the same frame.
  function warmup() {
    world.update(0.016);
  }

  it('blows a killed enemy back along the killing shot', () => {
    const enemy = makeEnemy([0, 0.5, 0], {
      deathClips: ['Shot_and_Blown_Back'],
      knockbackSpeed: 12,
    });
    warmup();

    // Shot travelling +X kills it → corpse should slide +X.
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    for (let i = 0; i < 10; i++) world.update(0.016);

    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(enemy.hasTag('dying')).toBe(true);
    expect(m.position[0]).toBeGreaterThan(0.5);
    expect(m.position[2]).toBeCloseTo(0, 5);
  });

  it('shoves a living enemy aside as the corpse slides into it', () => {
    // Corpse-to-be at the origin; a living enemy 1.5 ahead, inside the corpse's
    // slide path (combined separationRadius = 2.0). No player → the living one
    // doesn't chase, so any motion it shows is from being knocked into.
    const corpse = makeEnemy([0, 0.5, 0], {
      deathClips: ['Shot_and_Blown_Back'],
      knockbackSpeed: 12,
      knockbackMass: 5,
    });
    const living = makeEnemy([1.5, 0.5, 0]);
    warmup();

    eventBus.emit(BulletEvents.HIT, { entityId: corpse.id, dirX: 1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: corpse.id });
    for (let i = 0; i < 10; i++) world.update(0.016);

    const livingPos = living.get(MeshPrimitiveComponent)!.position;
    const corpsePos = corpse.get(MeshPrimitiveComponent)!.position;
    // The living enemy got knocked forward (+X) by the heavier sliding corpse...
    expect(livingPos[0]).toBeGreaterThan(1.5);
    // ...and, being lighter, moved further than the corpse retreated from it.
    expect(livingPos[0] - 1.5).toBeGreaterThan(Math.abs(corpsePos[0]));
  });

  it('does not knock back when the death had no recorded shot direction', () => {
    // Died to contact (no bullet.hit) → corpse falls in place, no slide.
    const enemy = makeEnemy([2, 0.5, -1], {
      deathClips: ['Fall_Forward'],
      knockbackSpeed: 12,
    });
    warmup();

    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    for (let i = 0; i < 10; i++) world.update(0.016);

    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(m.position[0]).toBeCloseTo(2, 5);
    expect(m.position[2]).toBeCloseTo(-1, 5);
  });
});

describe('TwinStickEnemySystem chase / wander (driven by LineOfSight events)', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    // Deterministic wander headings.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new TwinStickEnemySystem(eventBus));
    world.initialize();
  });

  afterEach(() => vi.restoreAllMocks());

  function makePlayer(pos: [number, number, number]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.addTag('player');
    return entity;
  }

  function makeEnemy(pos: [number, number, number]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new TwinStickEnemyComponent({ speed: 2.5, wanderSpeed: 1.8 }));
    return entity;
  }

  function makeObstacle(pos: [number, number, number], halfWidth: number, halfDepth: number, full: boolean) {
    const entity = world.createEntity();
    entity.add(
      new MeshPrimitiveComponent({
        primitive: 'box',
        width: halfWidth * 2,
        height: full ? 3 : 1,
        depth: halfDepth * 2,
        position: pos,
      }),
    );
    entity.add(new ObstacleComponent({ halfWidth, halfDepth, blocksSight: full, blocksBullets: full }));
    entity.addTag('obstacle');
    return entity;
  }

  it('chases the player by default (no acquired/lost reported yet)', () => {
    makePlayer([10, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0]);
    world.update(0.016); // consume the spawn-frame newborn skip
    for (let i = 0; i < 8; i++) world.update(0.1);

    const p = enemy.get(MeshPrimitiveComponent)!.position;
    expect(p[0]).toBeGreaterThan(0.5); // closed toward the player (+X)
    expect(p[2]).toBeCloseTo(0, 5); // straight line, no sideways drift
  });

  it('wanders off the player when LineOfSight reports the target lost', () => {
    makePlayer([10, 0.8, 0]);
    // A second enemy gives the crowd a centroid to wander away from.
    makeEnemy([5, 0.5, 0]);
    const blocked = makeEnemy([0, 0.5, 0]);
    world.update(0.016); // consume newborns
    // LineOfSightSystem would emit this; here we drive it directly.
    eventBus.emit(LineOfSightEvents.LOST, { entityId: blocked.id });
    for (let i = 0; i < 8; i++) world.update(0.1);

    const p = blocked.get(MeshPrimitiveComponent)!.position;
    // It did NOT beeline the player — it veered away (−X) and off-axis.
    expect(p[0]).toBeLessThan(0);
    expect(Math.abs(p[2])).toBeGreaterThan(0.1);
  });

  it('cannot walk through a barrier', () => {
    makePlayer([10, 0.8, 0]);
    // Low cover (doesn't block sight) → the enemy keeps chasing straight into
    // it; the box must stop it. Near face is at x = 4.
    makeObstacle([5, 0.5, 0], 1, 2, false);
    const enemy = makeEnemy([0, 0.5, 0]);
    world.update(0.016); // consume newborns
    for (let i = 0; i < 40; i++) world.update(0.1);

    const p = enemy.get(MeshPrimitiveComponent)!.position;
    // Pressed against the near face (4) but pushed out by its radius (0.6) — it
    // never crossed to the player's side.
    expect(p[0]).toBeGreaterThan(3); // advanced up to the wall
    expect(p[0]).toBeLessThan(4); // but did not pass through it
  });
});

describe('TwinStickEnemySystem directional death clip', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let playOnce: Array<{ entityId: string; clip: string }>;

  const FALL_BACK = ['Shot_and_Blown_Back', 'Walking_Blow_Back'];
  const FALL_FORWARD = ['Fall_Forward'];

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new TwinStickEnemySystem(eventBus));
    world.initialize();
    playOnce = [];
    eventBus.on(SkeletonAnimatorInputEvents.PLAY_ONCE, (d: { entityId: string; clip: string }) =>
      playOnce.push(d),
    );
  });

  function makePlayer(pos: [number, number, number]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.addTag('player');
    return entity;
  }

  function makeEnemy(pos: [number, number, number]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new TwinStickEnemyComponent({ fallBackClips: FALL_BACK, fallForwardClips: FALL_FORWARD }));
    return entity;
  }

  // Player at +X; the enemy chases toward it so its facing settles to +X.
  function spawnChasingEnemy() {
    makePlayer([10, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0]);
    world.update(0.016); // consume newborns
    for (let i = 0; i < 3; i++) world.update(0.1); // chase → facing +X (toward player)
    return enemy;
  }

  it('falls backward when shot in the front (facing the player)', () => {
    const enemy = spawnChasingEnemy();
    // A shot from the player (+X side) travels −X into the robot's front.
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: -1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    world.update(0.016);

    const last = playOnce.at(-1);
    expect(last?.entityId).toBe(enemy.id);
    expect(FALL_BACK).toContain(last?.clip);
  });

  it('pitches forward when shot in the back (facing away from the shot)', () => {
    const enemy = spawnChasingEnemy();
    // A shot travelling +X (from behind the +X-facing robot) hits its back.
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    world.update(0.016);

    expect(playOnce.at(-1)?.clip).toBe('Fall_Forward');
  });
});

describe('TwinStickEnemySystem death, score, and pooling', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let released: Array<{ entityId: string }>;
  let killed: Array<{ entityId: string; spawnerId: string }>;
  let score: Array<{ ownerEntity: string; points: number }>;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new TwinStickEnemySystem(eventBus));
    world.initialize();
    released = [];
    killed = [];
    score = [];
    eventBus.on(EntityPoolInputEvents.RELEASE, (d: { entityId: string }) => released.push(d));
    eventBus.on(EnemyEvents.KILLED, (d: { entityId: string; spawnerId: string }) => killed.push(d));
    eventBus.on(ScoreInputEvents.ADD, (d: { ownerEntity: string; points: number }) => score.push(d));
  });

  function makeEnemy(pos: [number, number, number], extra: Record<string, unknown> = {}) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new TwinStickEnemyComponent(extra));
    return entity;
  }

  it('releases a plain (non-animated) enemy immediately on death + awards score', () => {
    const enemy = makeEnemy([0, 0.5, 0], { spawnerId: 'S1', pointsOnKill: 250 });
    world.update(0.016); // burn newborn frame

    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });

    expect(killed).toEqual([{ entityId: enemy.id, spawnerId: 'S1' }]);
    expect(score).toEqual([{ ownerEntity: 'Player', points: 250 }]);
    expect(released).toEqual([{ entityId: enemy.id }]); // no death clips → recycle now
  });

  it('ignores HealthEvents.DIED for an entity that is not an enemy', () => {
    // A bare entity (e.g. the Player) dying must not award score or emit killed.
    const player = world.createEntity();
    player.addTag('player');
    world.update(0.016);

    eventBus.emit(HealthEvents.DIED, { entityId: player.id });
    expect(killed).toEqual([]);
    expect(score).toEqual([]);
    expect(released).toEqual([]);
  });

  it('fades an animated corpse out then releases it after the death clip completes', () => {
    const enemy = makeEnemy([0, 0.5, 0], {
      deathClips: ['Die'],
      deathFadeSeconds: 0.1,
      knockbackSpeed: 0,
    });
    world.update(0.016);

    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id }); // tags dying, plays death clip
    expect(enemy.hasTag('dying')).toBe(true);
    // The death clip finishes → start the fade.
    eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: enemy.id, clip: 'Die' });

    // Drive the fade to completion; alpha ramps to 0 then releases.
    world.update(0.06);
    const fadedDuringRamp = renderer.calls.some(
      (c) => c.method === 'setModelAlpha' && c.args[0] === enemy.id && (c.args[1] as number) > 0,
    );
    expect(fadedDuringRamp).toBe(true);
    expect(released).toEqual([]); // not done yet
    world.update(0.06); // crosses 0
    expect(
      renderer.calls.some((c) => c.method === 'setModelAlpha' && c.args[1] === 0),
    ).toBe(true);
    expect(released).toEqual([{ entityId: enemy.id }]);
  });

  it('releases immediately when an animated enemy has no death fade', () => {
    const enemy = makeEnemy([0, 0.5, 0], { deathClips: ['Die'], deathFadeSeconds: 0 });
    world.update(0.016);
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: enemy.id, clip: 'Die' });
    expect(released).toEqual([{ entityId: enemy.id }]); // no fade → recycle on clip end
  });

  it('drops a knockback slide when its entity is removed mid-slide', () => {
    const enemy = makeEnemy([0, 0.5, 0], { deathClips: ['Die'], knockbackSpeed: 12 });
    world.update(0.016);
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id }); // seeds knockback
    world.update(0.016); // slide begins
    // Park the entity: next tick the knockback loop sees it inactive and drops it.
    enemy.active = false;
    expect(() => world.update(0.016)).not.toThrow();
    const m = enemy.get(MeshPrimitiveComponent)!;
    const x = m.position[0];
    world.update(0.016); // no further integration — slide was dropped
    expect(m.position[0]).toBe(x);
  });

  it('ignores a bullet.hit that omits a direction component (no knockback)', () => {
    const enemy = makeEnemy([0, 0.5, 0], { deathClips: ['Die'], knockbackSpeed: 12 });
    world.update(0.016);
    // dirX present but dirZ missing → the HIT listener returns early.
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 1 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    for (let i = 0; i < 10; i++) world.update(0.016);
    expect(enemy.get(MeshPrimitiveComponent)!.position[0]).toBeCloseTo(0, 5);
  });

  it('stops tracking a knockback slide once it has all but died out', () => {
    // Heavy damping makes the slide drop below the 0.1 threshold quickly, so the
    // corpse stops integrating and holds its resting spot.
    const enemy = makeEnemy([0, 0.5, 0], {
      deathClips: ['Die'],
      knockbackSpeed: 12,
      knockbackDamping: 60,
    });
    world.update(0.016);
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 1, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    for (let i = 0; i < 8; i++) world.update(0.05); // slide decays under 0.1, dropped
    const x = enemy.get(MeshPrimitiveComponent)!.position[0];
    // A few more frames produce no further motion — the slide was dropped.
    for (let i = 0; i < 5; i++) world.update(0.05);
    expect(enemy.get(MeshPrimitiveComponent)!.position[0]).toBeCloseTo(x, 5);
  });

  it('ignores a bullet.hit with a near-zero direction (no knockback seeded)', () => {
    const enemy = makeEnemy([0, 0.5, 0], { deathClips: ['Die'], knockbackSpeed: 12 });
    world.update(0.016);
    // len < 1e-4 → the HIT listener returns without recording a direction.
    eventBus.emit(BulletEvents.HIT, { entityId: enemy.id, dirX: 0, dirZ: 0 });
    eventBus.emit(HealthEvents.DIED, { entityId: enemy.id });
    for (let i = 0; i < 10; i++) world.update(0.016);
    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(m.position[0]).toBeCloseTo(0, 5); // fell in place, no slide
  });

  it('a plain (non-animated) enemy in contact damages the player every frame', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0.5, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const damage: Array<{ entityId: string; damage: number; source: string }> = [];
    eventBus.on(HealthInputEvents.DAMAGE, (d: { entityId: string; damage: number; source: string }) =>
      damage.push(d),
    );

    // No walkClip → plain enemy. Sits inside contactRange (default 1.1) of the player.
    const enemy = makeEnemy([0, 0.5, 0], { contactDamage: 4, speed: 0 });
    world.update(0.016); // newborn
    world.update(0.016); // in contact → damage
    world.update(0.016); // and again next frame

    const fromEnemy = damage.filter((d) => d.source === enemy.id);
    expect(fromEnemy.length).toBeGreaterThanOrEqual(2);
    expect(fromEnemy[0]).toMatchObject({ entityId: player.id, damage: 4 });
  });

  it('pushes an enemy out of an obstacle it overlaps', () => {
    // Player past a low-cover box; the chaser walks into the box and gets pushed
    // back out by the obstacle pass (exercises the obstacleBoxes loop over bodies).
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [20, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const obstacle = world.createEntity();
    obstacle.add(new MeshPrimitiveComponent({ primitive: 'box', position: [4, 0.5, 0] }));
    obstacle.add(new ObstacleComponent({ halfWidth: 1, halfDepth: 2, blocksSight: false, blocksBullets: false }));
    obstacle.addTag('obstacle');

    const enemy = makeEnemy([0, 0.5, 0], { speed: 6 });
    world.update(0.016);
    for (let i = 0; i < 40; i++) world.update(0.1);
    // Stopped against the near face (box near face at x=3, minus the enemy's
    // radius 0.6 → ~2.4) — pushed out, never crossed it.
    const x = enemy.get(MeshPrimitiveComponent)!.position[0];
    expect(x).toBeGreaterThan(2);
    expect(x).toBeLessThan(3);
  });

  it('uses the fallback collision radius for an obstacle-less-diameter enemy', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [20, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const obstacle = world.createEntity();
    obstacle.add(new MeshPrimitiveComponent({ primitive: 'box', position: [4, 0.5, 0] }));
    obstacle.add(new ObstacleComponent({ halfWidth: 1, halfDepth: 2, blocksSight: false, blocksBullets: false }));
    obstacle.addTag('obstacle');

    // diameter 0 → the obstacle pass falls back to a 0.5 radius.
    const enemy = world.createEntity();
    const em = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 0, position: [0, 0.5, 0] });
    em.handle = renderer.createMesh(enemy.id, em.toPrimitiveSpec());
    enemy.add(em);
    enemy.add(new TwinStickEnemyComponent({ speed: 6 }));

    world.update(0.016);
    for (let i = 0; i < 40; i++) world.update(0.1);
    const x = enemy.get(MeshPrimitiveComponent)!.position[0];
    // Pushed out by the 0.5 fallback radius → stops near x ≈ 2.5, never crosses.
    expect(x).toBeGreaterThan(2);
    expect(x).toBeLessThan(3);
  });

  it('drops to idle when an animated enemy is blocked and stops moving', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [20, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    // A low-cover wall pins the enemy; once it can't advance it reads as not
    // moving → idle (stops the walk loop with '').
    const obstacle = world.createEntity();
    obstacle.add(new MeshPrimitiveComponent({ primitive: 'box', position: [4, 0.5, 0] }));
    obstacle.add(new ObstacleComponent({ halfWidth: 1, halfDepth: 2, blocksSight: false, blocksBullets: false }));
    obstacle.addTag('obstacle');

    const setLoop: Array<{ entityId: string; clip: string }> = [];
    eventBus.on(SkeletonAnimatorInputEvents.SET_LOOP, (d: { entityId: string; clip: string }) => setLoop.push(d));

    const enemy = makeEnemy([0, 0.5, 0], { walkClip: 'Walk', speed: 6 });
    world.update(0.016);
    for (let i = 0; i < 60; i++) world.update(0.1); // chase, jam against the wall, settle

    // It looped Walk while advancing, then went idle ('') once jammed.
    expect(setLoop.some((s) => s.entityId === enemy.id && s.clip === 'Walk')).toBe(true);
    expect(setLoop.some((s) => s.entityId === enemy.id && s.clip === '')).toBe(true);
  });

  it('ignores a SkeletonAnimator COMPLETED for an unknown entity', () => {
    // No such entity → the COMPLETED listener returns before touching state.
    expect(() =>
      eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: 'nope', clip: 'Die' }),
    ).not.toThrow();
  });

  it('re-paths immediately on LOST once the enemy already has AI state', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [20, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const enemy = makeEnemy([0, 0.5, 0], { speed: 5 });
    world.update(0.016);
    world.update(0.1); // chase → AI state now exists (ai map populated)
    // LOST with an existing ai entry resets its wanderTimer (the `if (ai)` branch).
    eventBus.emit(LineOfSightEvents.LOST, { entityId: enemy.id });
    for (let i = 0; i < 5; i++) world.update(0.1);
    // It wandered (slower, off-axis) rather than beelining the player: a straight
    // chase at speed 5 for 0.5s would advance ~2.5 in +X; wandering falls short.
    expect(enemy.get(MeshPrimitiveComponent)!.position[0]).toBeLessThan(2);
  });

  it('records line-of-sight ACQUIRED so a previously-lost enemy chases again', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [20, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const enemy = makeEnemy([0, 0.5, 0], { speed: 5 });
    world.update(0.016);
    // Lose sight → wander; then re-acquire → chase straight at the player again.
    eventBus.emit(LineOfSightEvents.LOST, { entityId: enemy.id });
    world.update(0.1);
    eventBus.emit(LineOfSightEvents.ACQUIRED, { entityId: enemy.id });
    const before = enemy.get(MeshPrimitiveComponent)!.position[0];
    for (let i = 0; i < 5; i++) world.update(0.1);
    // Chasing the +X player again → net advance toward it.
    expect(enemy.get(MeshPrimitiveComponent)!.position[0]).toBeGreaterThan(before);
  });

  it('clamps enemies to the arena bounds', () => {
    // Player far outside +X; the enemy chases but is clamped to arenaHalfWidth.
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [100, 0.8, 100] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const enemy = makeEnemy([0, 0.5, 0], {
      speed: 50,
      arenaHalfWidth: 3,
      arenaHalfDepth: 2,
    });
    world.update(0.016);
    for (let i = 0; i < 20; i++) world.update(0.1);

    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(m.position[0]).toBeLessThanOrEqual(3 + 1e-6);
    expect(m.position[2]).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('leaves an in-bounds enemy unclamped inside a large arena', () => {
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [1, 0.8, 0] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    // Generous arena (clamp runs but the body never reaches a bound → the
    // pass-through arm of clamp).
    const enemy = makeEnemy([0, 0.5, 0], { speed: 1, arenaHalfWidth: 50, arenaHalfDepth: 50 });
    world.update(0.016);
    world.update(0.1);
    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(Math.abs(m.position[0])).toBeLessThan(50);
    expect(Math.abs(m.position[2])).toBeLessThan(50);
  });

  it('clamps an enemy to the negative arena bound', () => {
    // Player far in −X/−Z; the chaser is clamped at the lower bound (the v<lo
    // arm of clamp).
    const player = world.createEntity();
    const pm = new MeshPrimitiveComponent({ primitive: 'capsule', position: [-100, 0.8, -100] });
    pm.handle = renderer.createMesh(player.id, pm.toPrimitiveSpec());
    player.add(pm);
    player.addTag('player');

    const enemy = makeEnemy([0, 0.5, 0], { speed: 50, arenaHalfWidth: 3, arenaHalfDepth: 2 });
    world.update(0.016);
    for (let i = 0; i < 20; i++) world.update(0.1);

    const m = enemy.get(MeshPrimitiveComponent)!;
    expect(m.position[0]).toBeGreaterThanOrEqual(-3 - 1e-6);
    expect(m.position[0]).toBeCloseTo(-3, 5);
    expect(m.position[2]).toBeGreaterThanOrEqual(-2 - 1e-6);
    expect(m.position[2]).toBeCloseTo(-2, 5);
  });
});

describe('TwinStickEnemySystem animated locomotion (walk / idle / attack)', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let setLoop: Array<{ entityId: string; clip: string }>;
  let playOnce: Array<{ entityId: string; clip: string }>;
  let damage: Array<{ entityId: string; damage: number; source: string }>;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    world.addSystem(new TwinStickEnemySystem(eventBus));
    world.initialize();
    setLoop = [];
    playOnce = [];
    damage = [];
    eventBus.on(SkeletonAnimatorInputEvents.SET_LOOP, (d: { entityId: string; clip: string }) => setLoop.push(d));
    eventBus.on(SkeletonAnimatorInputEvents.PLAY_ONCE, (d: { entityId: string; clip: string }) => playOnce.push(d));
    eventBus.on(HealthInputEvents.DAMAGE, (d: { entityId: string; damage: number; source: string }) => damage.push(d));
  });

  function makePlayer(pos: [number, number, number]) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.addTag('player');
    return entity;
  }

  function makeEnemy(pos: [number, number, number], extra: Record<string, unknown> = {}) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new TwinStickEnemyComponent({ walkClip: 'Walk', attackClip: 'Attack', ...extra }));
    return entity;
  }

  it('loops the walk clip while chasing a distant player', () => {
    makePlayer([20, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0], { speed: 4 });
    world.update(0.016); // newborn
    world.update(0.1); // moves toward player → prev set
    world.update(0.1); // now "moving" detectable → walk

    expect(setLoop.some((s) => s.entityId === enemy.id && s.clip === 'Walk')).toBe(true);
  });

  it('attacks within contact range: stops the loop and throws one punch at a time', () => {
    makePlayer([1, 0.8, 0]); // within default contactRange (1.1)
    const enemy = makeEnemy([0, 0.5, 0], { contactRange: 1.5 });
    world.update(0.016);
    world.update(0.1); // settle facing/contact
    world.update(0.1); // attack state

    // Stops the base loop with '' and throws a punch.
    expect(setLoop.some((s) => s.entityId === enemy.id && s.clip === '')).toBe(true);
    const punches = playOnce.filter((p) => p.entityId === enemy.id && p.clip === 'Attack');
    expect(punches.length).toBe(1); // one swing in flight, not every frame
  });

  it('lands the punch damage on COMPLETED when still in contact', () => {
    const player = makePlayer([1, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0], { contactRange: 1.5, contactDamage: 7 });
    world.update(0.016);
    world.update(0.1);
    world.update(0.1); // enters attack, punch in flight

    damage.length = 0;
    eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: enemy.id, clip: 'Attack' });
    // The swing connects: target is still in contact range.
    expect(damage).toEqual([{ entityId: player.id, damage: 7, source: enemy.id }]);
  });

  it('does not connect a punch if the enemy started dying mid-swing', () => {
    const player = makePlayer([1, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0], { contactRange: 1.5, deathClips: ['Die'] });
    world.update(0.016);
    world.update(0.1);
    world.update(0.1); // attack, punch in flight

    damage.length = 0;
    enemy.addTag('dying'); // death overrode the punch
    eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: enemy.id, clip: 'Attack' });
    expect(damage).toEqual([]);
    void player;
  });

  it('does not damage on a punch landing when the target left contact range', () => {
    const player = makePlayer([1, 0.8, 0]);
    const enemy = makeEnemy([0, 0.5, 0], { contactRange: 1.5, contactDamage: 7 });
    world.update(0.016);
    world.update(0.1);
    world.update(0.1); // attack, punch in flight

    // Move the player far away before the swing lands.
    player.get(MeshPrimitiveComponent)!.position[0] = 50;
    damage.length = 0;
    eventBus.emit(SkeletonAnimatorEvents.COMPLETED, { entityId: enemy.id, clip: 'Attack' });
    expect(damage).toEqual([]); // out of range → whiff
  });
});
