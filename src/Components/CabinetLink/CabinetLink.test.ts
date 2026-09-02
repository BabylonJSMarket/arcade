// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, MockRendererAdapter, World } from '@babylonjsmarket/ecs';
import { CabinetLinkEvents, FirstPersonCameraEvents } from '../../events';
import { CabinetLinkComponent, CabinetLinkSystem } from './CabinetLink';
import { MeshComponent } from '../Mesh/Mesh.defs';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';

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

  it('launchDistance defaults to no gate (Infinity) and stays out of the serialized form', () => {
    const c = new CabinetLinkComponent({ game: 'g' });
    expect(c.launchDistance).toBe(Infinity);
    expect('launchDistance' in c.serialize()).toBe(false);
    // …so the JSON round-trip cannot turn it into null.
    const json = JSON.parse(JSON.stringify(c.serialize()));
    expect(new CabinetLinkComponent(json).launchDistance).toBe(Infinity);
  });

  it('a finite launchDistance round-trips', () => {
    const c = new CabinetLinkComponent({ game: 'g', launchDistance: 1.5 });
    expect(c.serialize().launchDistance).toBe(1.5);
    expect(new CabinetLinkComponent(c.serialize()).launchDistance).toBe(1.5);
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
    system = new CabinetLinkSystem(eventBus);
    system.now = () => clock;
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

  describe('launchDistance — the proximity gate', () => {
    /** Announce a walking camera standing at (x, z), the way FirstPersonCamera does. */
    const cameraAt = (x: number, z: number) => {
      const handle = renderer.createPerspectiveCamera('firstPerson', {
        fov: 1.1,
        near: 0.1,
        far: 100,
        position: [x, 1.6, z],
      });
      eventBus.emit(FirstPersonCameraEvents.CREATED, { entityId: 'Player', handle });
      return handle;
    };
    const doubleClick = (id: string) => {
      pickReturns(id);
      system.handleClick(1, 1);
      clock += 150;
      system.handleClick(1, 1);
    };

    it('launches when the player is within reach', () => {
      const e = cabinet('frogger', 0); // at z = -4
      cameraAt(0, -3); // 1 m away
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      e.get(CabinetLinkComponent)!.launchDistance = 1.5;
      doubleClick(e.id);
      expect(launch).toHaveBeenCalledTimes(1);
    });

    it('too far: reports OUT_OF_RANGE with the distances, does not launch, leaves the walk running', () => {
      const e = cabinet('frogger', 0); // at z = -4
      cameraAt(0, 4); // 8 m away
      const launch = vi.fn();
      const outOfRange = vi.fn();
      const goto = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      eventBus.on(CabinetLinkEvents.OUT_OF_RANGE, outOfRange);
      eventBus.on(FirstPersonCameraEvents.GOTO, goto);
      e.get(CabinetLinkComponent)!.launchDistance = 1.5;
      doubleClick(e.id);
      expect(launch).not.toHaveBeenCalled();
      expect(outOfRange).toHaveBeenCalledTimes(1);
      expect(outOfRange.mock.calls[0][0]).toMatchObject({
        entityId: e.id,
        game: 'frogger',
        title: 'frogger',
        launchDistance: 1.5,
      });
      expect(outOfRange.mock.calls[0][0].distance).toBeCloseTo(8, 5);
      // Exactly one GOTO — the first click's — and nothing cancelled it.
      expect(goto).toHaveBeenCalledTimes(1);
    });

    it('measures from the PLAYER, not from the click point', () => {
      const e = cabinet('frogger', 0); // at z = -4
      cameraAt(0, 4); // player is 8 m away…
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      e.get(CabinetLinkComponent)!.launchDistance = 1.5;
      // …even though the pick itself lands right on the machine.
      vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 0, y: 1, z: -3.9, meshId: e.id });
      system.handleClick(1, 1);
      clock += 100;
      system.handleClick(1, 1);
      expect(launch).not.toHaveBeenCalled();
    });

    it('after the walk brings the player close, the next double-click launches', () => {
      const e = cabinet('frogger', 0);
      const handle = cameraAt(0, 4);
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      e.get(CabinetLinkComponent)!.launchDistance = 1.5;
      doubleClick(e.id);
      expect(launch).not.toHaveBeenCalled();
      // The camera walked over (FirstPersonCamera poses it each frame).
      renderer.setCameraPose(handle, [0, 1.6, -2.8], { x: 0, y: 1, z: 0, w: 0 });
      clock += 5000; // a fresh pair
      doubleClick(e.id);
      expect(launch).toHaveBeenCalledTimes(1);
    });

    it('with no launchDistance the gate is open from anywhere (today’s behaviour)', () => {
      const e = cabinet('frogger', 0);
      cameraAt(50, 50);
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      doubleClick(e.id);
      expect(launch).toHaveBeenCalledTimes(1);
    });

    it('with no walking camera announced there is nothing to measure from, so it launches', () => {
      const e = cabinet('frogger', 0);
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      e.get(CabinetLinkComponent)!.launchDistance = 0.1;
      doubleClick(e.id);
      expect(launch).toHaveBeenCalledTimes(1);
    });

    it('a CREATED without a handle is ignored', () => {
      const e = cabinet('frogger', 0);
      eventBus.emit(FirstPersonCameraEvents.CREATED, { entityId: 'Player' });
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      e.get(CabinetLinkComponent)!.launchDistance = 0.1;
      doubleClick(e.id);
      expect(launch).toHaveBeenCalledTimes(1);
    });

    it('a cabinet with no mesh at all is measured from the first click’s pick point', () => {
      const e = world.createEntity();
      e.add(new CabinetLinkComponent({ game: 'g', launchDistance: 1 }));
      world.update(1 / 60);
      cameraAt(0, 0);
      const outOfRange = vi.fn();
      eventBus.on(CabinetLinkEvents.OUT_OF_RANGE, outOfRange);
      vi.spyOn(renderer, 'pickAtScreenPoint').mockReturnValue({ x: 3, y: 1, z: 4, meshId: e.id });
      system.handleClick(1, 1);
      clock += 100;
      system.handleClick(1, 1);
      expect(outOfRange.mock.calls[0][0].distance).toBeCloseTo(5, 5);
    });

    it('forgets the camera on shutdown', () => {
      const e = cabinet('frogger', 0);
      cameraAt(0, 40);
      e.get(CabinetLinkComponent)!.launchDistance = 1;
      world.removeSystem(system);
      const fresh = new CabinetLinkSystem(eventBus);
      fresh.now = () => clock;
      world.addSystem(fresh);
      const launch = vi.fn();
      eventBus.on(CabinetLinkEvents.LAUNCH, launch);
      pickReturns(e.id);
      fresh.handleClick(1, 1);
      clock += 100;
      fresh.handleClick(1, 1);
      expect(launch).toHaveBeenCalledTimes(1); // no camera known → gate open
    });
  });

  it('a non-interactive cabinet is scenery you can still walk up to', () => {
    // `interactive: false` means "no game behind it", not "ignores you". Most
    // machines in a room are scenery, and a click that does nothing at all
    // reads as a broken page rather than as an empty cabinet.
    const e = world.createEntity();
    e.add(new MeshComponent({ src: '/cab.glb', position: [0, 0, -4], autoLoad: false }));
    e.add(new CabinetLinkComponent({ game: 'frogger', interactive: false }));
    world.update(1 / 60);
    const goto = vi.fn();
    const launch = vi.fn();
    eventBus.on(FirstPersonCameraEvents.GOTO, goto);
    eventBus.on(CabinetLinkEvents.LAUNCH, launch);
    pickReturns(e.id);

    system.handleClick(1, 1);
    expect(goto).toHaveBeenCalledTimes(1); // walks you over

    system.handleClick(1, 1); // and the confirming click does nothing
    expect(launch).not.toHaveBeenCalled();
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
