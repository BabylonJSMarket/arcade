import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ScoreComponent,
  ScoreSystem,
  ScoreEvents,
  ScoreInputEvents,
} from './Score';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('ScoreComponent', () => {
  it('applies defaults', () => {
    const comp = new ScoreComponent();
    expect(comp.params.defaultPoints).toBe(1);
    expect(comp.params.minScore).toBeNull();
    expect(comp.params.maxScore).toBeNull();
    expect(comp.initialScores).toEqual({});
    expect(comp.instance).toBeNull();
  });

  it('accepts seeded scores and param overrides', () => {
    const comp = new ScoreComponent({
      defaultPoints: 3,
      maxScore: 50,
      scores: { player1: 7 },
    });
    expect(comp.params.defaultPoints).toBe(3);
    expect(comp.params.maxScore).toBe(50);
    expect(comp.initialScores).toEqual({ player1: 7 });
  });

  it('serialize round-trips through the constructor', () => {
    const original = new ScoreComponent({
      defaultPoints: 2,
      scores: { player1: 10, player2: 5 },
    });
    const copy = new ScoreComponent(original.serialize());
    expect(copy.params).toEqual(original.params);
    expect(copy.initialScores).toEqual(original.initialScores);
  });
});

describe('ScoreSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: ScoreSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new ScoreSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a core instance when an entity with ScoreComponent is added', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent({ scores: { player1: 3 } }));
    const comp = entity.get(ScoreComponent);
    expect(comp?.instance).not.toBeNull();
    expect(comp?.instance?.getScore('player1')).toBe(3);
  });

  it('emits CHANGED with the new score, delta, and full snapshot on score.add', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 10 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({
      ownerEntity: 'player1',
      score: 10,
      delta: 10,
      allScores: { player1: 10 },
    });
  });

  it('routes goal.scored payloads through the score core', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.GOAL_SCORED, {
      ownerEntity: 'player1',
      points: 2,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ownerEntity: 'player1', score: 2, delta: 2 }),
    );
  });

  it('accumulates points across multiple add events', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 10 });
    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 5 });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0]).toMatchObject({
      ownerEntity: 'player1',
      score: 15,
    });
  });

  it('handles multiple players independently in allScores payloads', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 10 });
    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player2', points: 20 });

    expect(spy.mock.calls[1][0].allScores).toEqual({ player1: 10, player2: 20 });
  });

  it('defaults missing points to the component defaultPoints', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent({ defaultPoints: 4 }));

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1' });

    expect(spy.mock.calls[0][0]).toMatchObject({ score: 4 });
  });

  it('drops add requests without an ownerEntity', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());

    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);

    eventBus.emit(ScoreInputEvents.ADD, { points: 10 });

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits RESET with an empty snapshot when resetRequest fires', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent({ scores: { player1: 10, player2: 20 } }));

    const spy = vi.fn();
    eventBus.on(ScoreEvents.RESET, spy);

    eventBus.emit(ScoreInputEvents.RESET, {});

    expect(spy).toHaveBeenCalledWith({ allScores: {} });
    expect(entity.get(ScoreComponent)?.instance?.getAllScores()).toEqual({});
  });

  it('serialize falls back to initialScores before the instance is attached', () => {
    // No System has run, so .instance is still null — serialize must use the seed.
    const comp = new ScoreComponent({ scores: { player1: 7 } });
    expect(comp.serialize().scores).toEqual({ player1: 7 });
  });

  it('serialize prefers the live instance state once attached', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent({ scores: { player1: 1 } }));
    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 9 });
    const comp = entity.get(ScoreComponent)!;
    expect(comp.serialize().scores).toEqual({ player1: 10 });
  });

  it('seeds instances already present at world.initialize() time', () => {
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    const sys = new ScoreSystem(eb);
    w.addSystem(sys);
    const entity = w.createEntity();
    entity.add(new ScoreComponent({ scores: { p: 2 } }));
    w.initialize();
    expect(entity.get(ScoreComponent)?.instance?.getScore('p')).toBe(2);
  });

  it('drops add requests when no scoreboard entity exists', () => {
    // Fresh world with no ScoreComponent entity at all.
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    w.addSystem(new ScoreSystem(eb));
    w.initialize();
    const spy = vi.fn();
    eb.on(ScoreEvents.CHANGED, spy);
    eb.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 10 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('drops goal.scored payloads that carry no ownerEntity', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());
    const spy = vi.fn();
    eventBus.on(ScoreEvents.CHANGED, spy);
    eventBus.emit(ScoreInputEvents.GOAL_SCORED, { points: 5 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('drops reset requests when no scoreboard entity exists', () => {
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    w.addSystem(new ScoreSystem(eb));
    w.initialize();
    const spy = vi.fn();
    eb.on(ScoreEvents.RESET, spy);
    eb.emit(ScoreInputEvents.RESET, {});
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not touch the renderer — Score is data-only', () => {
    const entity = world.createEntity();
    entity.add(new ScoreComponent());
    renderer.calls.length = 0;
    eventBus.emit(ScoreInputEvents.ADD, { ownerEntity: 'player1', points: 10 });
    eventBus.emit(ScoreInputEvents.GOAL_SCORED, { ownerEntity: 'player2', points: 1 });
    eventBus.emit(ScoreInputEvents.RESET, {});
    world.update(0.1);
    expect(renderer.calls).toHaveLength(0);
  });
});
