// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { CabinetLinkEvents, FirstPersonCameraEvents } from '../../events';
import { CabinetLinkComponent, CabinetLinkSystem } from './CabinetLink';
import { MeshComponent } from '../Mesh/Mesh';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';

describe('CabinetLinkComponent', () => {
  it('derives its route from the game key', () => {
    expect(new CabinetLinkComponent({ game: 'frogger' }).route).toBe('/games/frogger/');
  });

  it('lets an explicit route win over the derived one', () => {
    const c = new CabinetLinkComponent({ game: 'frogger', route: '/arcade/frog' });
    expect(c.route).toBe('/arcade/frog');
  });

  it('has no route when it fronts no game', () => {
    expect(new CabinetLinkComponent().route).toBe('');
  });

  describe('approachFrom', () => {
    it('stands the player in front of a cabinet facing +Z, looking back at it', () => {
      const c = new CabinetLinkComponent({ game: 'g', facing: 0, standoff: 1.2 });
      const spot = c.approachFrom([3, 0, -5]);
      // Facing +Z means "in front" is +Z of the cabinet.
      expect(spot.x).toBeCloseTo(3, 5);
      expect(spot.z).toBeCloseTo(-3.8, 5);
      // And the player turns 180° to look back at the machine.
      expect(spot.yaw).toBeCloseTo(Math.PI, 5);
    });

    it('follows the cabinet’s facing when it is turned', () => {
      const c = new CabinetLinkComponent({ game: 'g', facing: Math.PI / 2, standoff: 2 });
      const spot = c.approachFrom([0, 0, 0]);
      // Facing +X now, so the stand point is +X of the cabinet.
      expect(spot.x).toBeCloseTo(2, 5);
      expect(spot.z).toBeCloseTo(0, 5);
    });

    it('an explicit standPoint overrides the computed one but still faces the cabinet', () => {
      const c = new CabinetLinkComponent({ game: 'g', facing: 0, standPoint: [9, 9] });
      const spot = c.approachFrom([0, 0, 0]);
      expect([spot.x, spot.z]).toEqual([9, 9]);
      expect(spot.yaw).toBeCloseTo(Math.PI, 5);
    });
  });

  it('serialize round-trips', () => {
    const c = new CabinetLinkComponent({ game: 'pacman', facing: 1, standoff: 2, title: 'Pac-Man' });
    expect(new CabinetLinkComponent(c.serialize()).serialize()).toEqual(c.serialize());
  });
});

describe('CabinetLinkSystem', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: CabinetLinkSystem;
  let clock: number;

  beforeEach(() => {
    clock = 1000;
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new CabinetLinkSystem(eventBus, { now: () => clock });
    world.addSystem(system);
    world.initialize();
  });

  /** A cabinet at `x` on the back wall, facing the player (+Z). */
  const cabinet = (game: string, x: number) => {
    const e = world.createEntity();
    e.add(new MeshComponent({ src: '/cab.glb', position: [x, 0, -4], autoLoad: false }));
    e.add(new CabinetLinkComponent({ game, facing: 0, standoff: 1.2 }));
    world.update(1 / 60);
    return e;
  };

  /** Make the next pick resolve to `meshId`. */
  const pickReturns = (meshId: string) => {
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 0, y: 1, z: -4, meshId });
  };

  it('a single click walks the player to the front of that cabinet', () => {
    const e = cabinet('frogger', 2);
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    pickReturns(e.id);
    system.handleClick(100, 100);

    expect(goto).toHaveBeenCalledTimes(1);
    const spot = goto.mock.calls[0][0];
    expect(spot.x).toBeCloseTo(2, 5);
    expect(spot.z).toBeCloseTo(-2.8, 5); // 1.2 m out from z = -4
    expect(spot.yaw).toBeCloseTo(Math.PI, 5);
  });

  it('resolves a click on a CHILD mesh back to its cabinet', () => {
    // Instanced clones name their parts `<entityId>_<part>`; a click on the
    // side art must still count as clicking that machine.
    const e = cabinet('galaga', -3);
    const focused = vi.fn();
    eventBus.on(CabinetLinkEvents.FOCUSED, focused);
    pickReturns(`${e.id}_Side_Art_primitive0`);
    system.handleClick(10, 10);
    expect(focused).toHaveBeenCalledTimes(1);
    expect(focused.mock.calls[0][0].game).toBe('galaga');
  });

  it('a single click does NOT launch', () => {
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(e.id);
    system.handleClick(1, 1);
    expect(launch).not.toHaveBeenCalled();
  });

  it('a second click on the same cabinet, in time, launches its game', () => {
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(e.id);
    system.handleClick(1, 1);
    clock += 200;
    system.handleClick(1, 1);

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0]).toMatchObject({
      game: 'frogger',
      route: '/games/frogger/',
    });
  });

  it('a slow second click is two separate walks, not a launch', () => {
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    const goto = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    pickReturns(e.id);
    system.handleClick(1, 1);
    clock += 5000;
    system.handleClick(1, 1);

    expect(launch).not.toHaveBeenCalled();
    expect(goto).toHaveBeenCalledTimes(2);
  });

  it('clicking a DIFFERENT cabinet quickly is not a double-click', () => {
    // Two machines side by side; a fast click on each is two approaches, and
    // must not launch whichever you happened to touch second.
    const a = cabinet('galaga', -2);
    const b = cabinet('pacman', 2);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(a.id);
    system.handleClick(1, 1);
    clock += 100;
    pickReturns(b.id);
    system.handleClick(1, 1);
    expect(launch).not.toHaveBeenCalled();
  });

  it('a third click starts a fresh pair rather than launching again', () => {
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(e.id);
    system.handleClick(1, 1);
    clock += 100;
    system.handleClick(1, 1); // launch
    clock += 100;
    system.handleClick(1, 1); // must NOT launch again
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('a second click still launches even after the walk moved the view off the cabinet', () => {
    // The regression this whole gesture design exists for: click one starts the
    // player walking, so click two lands on a wall instead of the machine.
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(e.id);
    system.handleClick(1, 1);
    clock += 150;
    pickReturns('Wall_W_box'); // camera moved; same pixel now hits the wall
    system.handleClick(1, 1);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0].game).toBe('frogger');
  });

  it('a second click on a DIFFERENT cabinet retargets instead of launching', () => {
    const a = cabinet('galaga', -2);
    const b = cabinet('pacman', 2);
    const launch = vi.fn();
    const goto = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    pickReturns(a.id);
    system.handleClick(1, 1);
    clock += 120;
    pickReturns(b.id);
    system.handleClick(1, 1);
    expect(launch).not.toHaveBeenCalled();
    expect(goto).toHaveBeenCalledTimes(2);
  });

  it('a click on nothing arms nothing — the next click is not a launch', () => {
    const e = cabinet('frogger', 0);
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue(null);
    system.handleClick(1, 1);
    clock += 100;
    pickReturns(e.id);
    system.handleClick(1, 1);
    expect(launch).not.toHaveBeenCalled();
  });

  it('ignores clicks that hit nothing', () => {
    cabinet('frogger', 0);
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue(null);
    system.handleClick(1, 1);
    expect(goto).not.toHaveBeenCalled();
  });

  it('ignores clicks on meshes that belong to no cabinet', () => {
    cabinet('frogger', 0);
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    pickReturns('Floor');
    system.handleClick(1, 1);
    expect(goto).not.toHaveBeenCalled();
  });

  it('a non-interactive cabinet is scenery', () => {
    const e = world.createEntity();
    e.add(new MeshComponent({ src: '/cab.glb', position: [0, 0, -4], autoLoad: false }));
    e.add(new CabinetLinkComponent({ game: 'frogger', interactive: false }));
    world.update(1 / 60);
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    pickReturns(e.id);
    system.handleClick(1, 1);
    expect(goto).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
describe('CabinetLinkSystem — pointer wiring', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: CabinetLinkSystem;
  let canvas: HTMLCanvasElement;

  const clickCanvas = (button = 0) =>
    canvas.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 50, clientY: 60, button, bubbles: true }),
    );

  beforeEach(async () => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    await renderer.init(canvas);
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new CabinetLinkSystem(eventBus);
    world.addSystem(system);
    world.initialize();

    const e = world.createEntity();
    e.add(new MeshComponent({ src: '/cab.glb', position: [0, 0, -4], autoLoad: false }));
    e.add(new CabinetLinkComponent({ game: 'frogger', facing: 0 }));
    world.update(1 / 60);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 0, y: 1, z: -4, meshId: e.id });
  });

  afterEach(() => {
    canvas.remove();
  });

  it('a real pointerdown on the canvas walks the player over', () => {
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    clickCanvas();
    expect(goto).toHaveBeenCalledTimes(1);
  });

  it('ignores non-primary buttons — right-click is not a walk', () => {
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    clickCanvas(2);
    expect(goto).not.toHaveBeenCalled();
  });

  it('stops listening once the system is removed', () => {
    world.removeSystem(system);
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    clickCanvas();
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('CabinetLinkSystem — locating the cabinet', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: CabinetLinkSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer, detectRaces: false });
    system = new CabinetLinkSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('falls back to a MeshPrimitive cabinet’s position', () => {
    const e = world.createEntity();
    e.add(new MeshPrimitiveComponent({ primitive: 'box', position: [5, 0, -2] }));
    e.add(new CabinetLinkComponent({ game: 'g', facing: 0, standoff: 1 }));
    world.update(1 / 60);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 9, y: 9, z: 9, meshId: e.id });
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    system.handleClick(1, 1);
    expect(goto.mock.calls[0][0].x).toBeCloseTo(5, 5);
    expect(goto.mock.calls[0][0].z).toBeCloseTo(-1, 5);
  });

  it('falls back to the pick point when the cabinet has no mesh component', () => {
    const e = world.createEntity();
    e.add(new CabinetLinkComponent({ game: 'g', facing: 0, standoff: 1 }));
    world.update(1 / 60);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 2, y: 1, z: 3, meshId: e.id });
    const goto = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    system.handleClick(1, 1);
    expect(goto.mock.calls[0][0].x).toBeCloseTo(2, 5);
    expect(goto.mock.calls[0][0].z).toBeCloseTo(4, 5);
  });

  it('a launch for a cabinet that vanished mid-gesture is a no-op', () => {
    const e = world.createEntity();
    e.add(new CabinetLinkComponent({ game: 'g' }));
    world.update(1 / 60);
    vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 0, y: 0, z: 0, meshId: e.id });
    const launch = vi.fn();
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    system.handleClick(1, 1);
    world.removeEntity(e.id); // scene swapped out from under the gesture
    world.update(1 / 60);
    expect(() => system.handleClick(1, 1)).not.toThrow();
    expect(launch).not.toHaveBeenCalled();
  });
});
