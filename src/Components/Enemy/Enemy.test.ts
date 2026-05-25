import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { EnemyComponent, EnemySystem } from './Enemy';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { BulletEvents } from '../Bullet/Bullet.core';
import { HealthEvents } from '../Health/Health';
import { ObstacleComponent } from '../Obstacle/Obstacle.core';
import { SkeletonAnimatorInputEvents } from '../SkeletonAnimator/SkeletonAnimator.core';
import { LineOfSightEvents } from '../LineOfSight/LineOfSight.core';

describe('EnemySystem knockback', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new EnemySystem(eventBus));
    world.initialize();
  });

  function makeEnemy(pos: [number, number, number], extra: Record<string, unknown> = {}) {
    const entity = world.createEntity();
    const mesh = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 1.2, position: pos });
    mesh.handle = renderer.createMesh(entity.id, mesh.toPrimitiveSpec());
    entity.add(mesh);
    entity.add(new EnemyComponent({ separationRadius: 1.0, ...extra }));
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

describe('EnemySystem chase / wander (driven by LineOfSight events)', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    // Deterministic wander headings.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new EnemySystem(eventBus));
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
    entity.add(new EnemyComponent({ speed: 2.5, wanderSpeed: 1.8 }));
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

describe('EnemySystem directional death clip', () => {
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
    world.addSystem(new EnemySystem(eventBus));
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
    entity.add(new EnemyComponent({ fallBackClips: FALL_BACK, fallForwardClips: FALL_FORWARD }));
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
