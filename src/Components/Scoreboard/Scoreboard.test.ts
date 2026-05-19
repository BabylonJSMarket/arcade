import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ScoreboardComponent,
  ScoreboardSystem,
  ScoreboardEvents,
  ScoreboardInputEvents,
} from './Scoreboard';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('ScoreboardComponent', () => {
  it('applies defaults', () => {
    const comp = new ScoreboardComponent();
    expect(comp.params.title).toBe('SCORE');
    expect(comp.params.fontSize).toBe(18);
    expect(comp.params.position).toBe('top-left');
    expect(comp.players).toEqual([]);
    expect(comp.instance).toBeNull();
  });

  it('merges params on top of defaults and copies the roster', () => {
    const comp = new ScoreboardComponent({
      fontSize: 24,
      position: 'bottom-right',
      players: [{ entityId: 'p1', name: 'Alice', color: [1, 0, 0] }],
    });
    expect(comp.params.fontSize).toBe(24);
    expect(comp.params.position).toBe('bottom-right');
    expect(comp.players).toHaveLength(1);
    expect(comp.players[0].name).toBe('Alice');
  });

  it('serialize round-trips through the constructor', () => {
    const original = new ScoreboardComponent({
      fontSize: 22,
      position: 'top-right',
      players: [{ entityId: 'p1', name: 'Ada', color: [0.1, 0.2, 0.3] }],
    });
    const copy = new ScoreboardComponent(original.serialize());
    expect(copy.params).toEqual(original.params);
    expect(copy.players).toEqual(original.players);
  });
});

describe('ScoreboardSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: ScoreboardSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new ScoreboardSystem(eventBus);
    world.addSystem(system);
    world.initialize();

    const entity = world.createEntity();
    entity.add(
      new ScoreboardComponent({
        players: [
          { entityId: 'p1', name: 'Alice', color: [1, 0, 0] },
          { entityId: 'p2', name: 'Bob', color: [0, 1, 0] },
        ],
      }),
    );
  });

  it('creates a core instance on entity add', () => {
    const entity = Array.from(world.getEntities())[0];
    const comp = entity.get(ScoreboardComponent);
    expect(comp?.instance).not.toBeNull();
  });

  it('is non-pauseable (HUD keeps ticking while the sim is paused)', () => {
    expect((system as unknown as { _pauseable: boolean })._pauseable).toBe(false);
  });

  it('emits a snapshot when Score system broadcasts an updated map', () => {
    const spy = vi.fn();
    eventBus.on(ScoreboardEvents.UPDATED, spy);
    eventBus.emit(ScoreboardInputEvents.SCORE_CHANGED, {
      ownerEntity: 'p1',
      score: 5,
      allScores: { p1: 5, p2: 2 },
    });
    expect(spy).toHaveBeenCalled();
    const payload = spy.mock.calls[0][0] as { snapshot: { rows: { scoreText: string }[] } };
    expect(payload.snapshot.rows[0].scoreText).toBe('5');
    expect(payload.snapshot.rows[1].scoreText).toBe('2');
  });

  it('rolls every row back to zero when score.reset fires', () => {
    eventBus.emit(ScoreboardInputEvents.SCORE_CHANGED, {
      allScores: { p1: 7, p2: 9 },
    });
    const spy = vi.fn();
    eventBus.on(ScoreboardEvents.UPDATED, spy);
    eventBus.emit(ScoreboardInputEvents.SCORE_RESET, {});
    expect(spy).toHaveBeenCalled();
    const snap = spy.mock.calls[spy.mock.calls.length - 1][0].snapshot;
    expect(snap.rows.map((r: { scoreText: string }) => r.scoreText)).toEqual(['0', '0']);
  });

  it('makes no adapter calls — it is a DOM overlay, not a 3D element', () => {
    renderer.calls.length = 0;
    eventBus.emit(ScoreboardInputEvents.SCORE_CHANGED, {
      allScores: { p1: 3 },
    });
    world.update(1 / 60);
    expect(renderer.calls).toHaveLength(0);
  });
});
