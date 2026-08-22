import { AnimationEvents, AnimationInputEvents } from '../../events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationComponent, AnimationSystem } from './Animation';
import { DEFAULT_ANIMATION_PARAMS } from './Animation.core';
import { MeshComponent } from '../Mesh/Mesh.defs';
import { createMesh } from '../Mesh/Mesh.core';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('AnimationComponent', () => {
  it('applies defaults', () => {
    const comp = new AnimationComponent();
    expect(comp.params).toEqual(DEFAULT_ANIMATION_PARAMS);
    expect(comp.idleClip).toBe('IDLE_RIFLE');
    expect(comp.walkClip).toBe('WALK_RIFLE');
    expect(comp.runClip).toBe('RUN_RIFLE');
    expect(comp.autoPlay).toBe(true);
    expect(comp.instance).toBeNull();
  });

  it('accepts custom clip names and params', () => {
    const comp = new AnimationComponent({
      idleClip: 'stand',
      walkClip: 'stroll',
      runClip: 'sprint',
      walkSpeed: 2,
      runSpeed: 5,
      autoPlay: false,
    });
    expect(comp.idleClip).toBe('stand');
    expect(comp.runClip).toBe('sprint');
    expect(comp.params.walkSpeed).toBe(2);
    expect(comp.params.runSpeed).toBe(5);
    expect(comp.autoPlay).toBe(false);
  });

  it('serialize round-trips through the constructor', () => {
    const original = new AnimationComponent({
      idleClip: 'A',
      walkClip: 'B',
      runClip: 'C',
      walkSpeed: 4,
      runSpeed: 9,
      blendSpeed: 12,
      autoPlay: false,
    });
    const copy = new AnimationComponent(original.serialize());
    expect(copy.params).toEqual(original.params);
    expect(copy.idleClip).toBe(original.idleClip);
    expect(copy.walkClip).toBe(original.walkClip);
    expect(copy.runClip).toBe(original.runClip);
    expect(copy.autoPlay).toBe(original.autoPlay);
  });
});

describe('AnimationSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: AnimationSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new AnimationSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('creates a core instance when an entity with AnimationComponent is added', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent({ walkSpeed: 2, runSpeed: 5 }));
    const comp = entity.get(AnimationComponent);
    expect(comp?.instance).not.toBeNull();
    expect(comp?.instance?.getParams().walkSpeed).toBe(2);
  });

  it('on first update, plays all three clips once via the adapter', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    world.update(1 / 60);
    const playCalls = renderer.calls.filter((c) => c.method === 'playAnimation');
    expect(playCalls).toHaveLength(3);
    const clipNames = playCalls.map((c) => c.args[1]);
    expect(clipNames).toEqual(
      expect.arrayContaining(['IDLE_RIFLE', 'WALK_RIFLE', 'RUN_RIFLE']),
    );
  });

  it('waits for a sibling Mesh to finish loading before starting the clips', () => {
    // The live-swap race: an entity added to a RUNNING world updates while its
    // GLB is still in flight — a premature one-shot start would no-op in the
    // adapter and mark the entity started with nothing playing.
    const entity = world.createEntity('Hero');
    const mesh = new MeshComponent({ src: '/hero.glb' });
    mesh.instance = createMesh(mesh.params);
    mesh.instance.beginLoad();
    entity.add(mesh);
    entity.add(new AnimationComponent());

    world.update(1 / 60);
    expect(renderer.calls.filter((c) => c.method === 'playAnimation')).toHaveLength(0);

    mesh.instance.completeLoad('Hero', ['IDLE_RIFLE', 'WALK_RIFLE', 'RUN_RIFLE']);
    world.update(1 / 60);
    expect(renderer.calls.filter((c) => c.method === 'playAnimation')).toHaveLength(3);
  });

  it('keeps re-issuing play so clips grafted on later still start', () => {
    // Restart is the ADAPTER's job to guard (it no-ops an already-playing clip);
    // latching here would permanently miss a clip that appears after the first
    // frame — which is exactly what retargeting does.
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    world.update(1 / 60);
    world.update(1 / 60);
    const plays = renderer.calls.filter((c) => c.method === 'playAnimation');
    expect(plays).toHaveLength(6); // 3 clips × 2 frames
  });

  it('announces READY exactly once, not once per frame', () => {
    const ready = vi.fn();
    eventBus.on(AnimationEvents.READY, ready);
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    world.update(1 / 60);
    world.update(1 / 60);
    world.update(1 / 60);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('pushes updated weights through setAnimationWeight every frame', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    world.update(1 / 60);
    const weightCalls = renderer.calls.filter(
      (c) => c.method === 'setAnimationWeight',
    );
    // One per clip (3) per frame, 1 frame → 3 calls.
    expect(weightCalls).toHaveLength(3);
  });

  it('ramps walk weight up when SET_SPEED pushes speed above the threshold', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent({ walkSpeed: 3, blendSpeed: 50 }));
    // Tell the system we're walking.
    eventBus.emit(AnimationInputEvents.SET_SPEED, { entityId: entity.id, speed: 3 });
    // Run enough frames for smoothing + blending to converge.
    for (let i = 0; i < 300; i++) world.update(1 / 60);
    const comp = entity.get(AnimationComponent)!;
    const s = comp.instance!.getState();
    expect(s.walkWeight).toBeGreaterThan(0.5);
    expect(s.idleWeight).toBeLessThan(0.5);
  });

  it('emits STATE_CHANGED when the dominant state flips', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent({ walkSpeed: 3, blendSpeed: 50 }));
    const spy = vi.fn();
    eventBus.on(AnimationEvents.STATE_CHANGED, spy);
    eventBus.emit(AnimationInputEvents.SET_SPEED, { entityId: entity.id, speed: 10 });
    for (let i = 0; i < 120; i++) world.update(1 / 60);
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]![0];
    expect(lastCall).toMatchObject({ entityId: entity.id });
    expect(['walk', 'run']).toContain(lastCall.state);
  });

  it('emits BLEND_UPDATED with live weights every frame', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    const spy = vi.fn();
    eventBus.on(AnimationEvents.BLEND_UPDATED, spy);
    world.update(1 / 60);
    world.update(1 / 60);
    expect(spy).toHaveBeenCalledTimes(2);
    const payload = spy.mock.calls[0][0];
    expect(payload).toMatchObject({ entityId: entity.id });
    expect(typeof payload.idleWeight).toBe('number');
  });

  it('stops clips via the adapter when the entity is removed', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    world.update(1 / 60); // play
    renderer.calls.length = 0;
    world.removeEntity(entity.id);
    const stopCalls = renderer.calls.filter((c) => c.method === 'stopAnimation');
    expect(stopCalls).toHaveLength(3);
  });

  it('does not call play when autoPlay is false', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent({ autoPlay: false }));
    world.update(1 / 60);
    const playCalls = renderer.calls.filter((c) => c.method === 'playAnimation');
    expect(playCalls).toHaveLength(0);
  });

  it('builds instances for entities that exist before the system initializes', () => {
    const bus = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: bus, renderer: r, detectRaces: false });
    const entity = w.createEntity();
    entity.add(new AnimationComponent({ walkSpeed: 2 }));
    // System added AFTER the entity → onInitialize scans and wires the instance.
    w.addSystem(new AnimationSystem(bus));
    w.initialize();
    const comp = entity.get(AnimationComponent);
    expect(comp?.instance).not.toBeNull();
    expect(comp?.instance?.getParams().walkSpeed).toBe(2);
  });

  it('does not rebuild the core instance for an entity already wired up', () => {
    const entity = world.createEntity();
    entity.add(new AnimationComponent());
    const comp = entity.get(AnimationComponent)!;
    const firstInstance = comp.instance;
    expect(firstInstance).not.toBeNull();
    // A second update (and the internal ensureInstance guard) must not replace
    // the existing instance.
    world.update(1 / 60);
    expect(comp.instance).toBe(firstInstance);
  });
});
