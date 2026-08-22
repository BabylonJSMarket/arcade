import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { collectObstacleBoxes, ObstacleComponent } from './Obstacle';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';

describe('collectObstacleBoxes', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.initialize();
  });

  function makeObstacle(
    pos: [number, number, number],
    data: { halfWidth: number; halfDepth: number; blocksSight: boolean; blocksBullets: boolean },
  ) {
    const e = world.createEntity();
    e.add(new MeshPrimitiveComponent({ primitive: 'box', position: pos }));
    e.add(new ObstacleComponent(data));
    return e;
  }

  it('derives box bounds from mesh position +/- half-extents, with the obstacle flags', () => {
    makeObstacle([2, 0, -3], {
      halfWidth: 1.5,
      halfDepth: 0.5,
      blocksSight: true,
      blocksBullets: false,
    });
    const boxes = collectObstacleBoxes(world);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({
      minX: 0.5, // 2 - 1.5
      maxX: 3.5, // 2 + 1.5
      minZ: -3.5, // -3 - 0.5
      maxZ: -2.5, // -3 + 0.5
      blocksSight: true,
      blocksBullets: false,
    });
  });

  it('skips inactive obstacle entities', () => {
    const e = makeObstacle([0, 0, 0], {
      halfWidth: 1,
      halfDepth: 1,
      blocksSight: true,
      blocksBullets: true,
    });
    e.active = false;
    expect(collectObstacleBoxes(world)).toHaveLength(0);
  });

  it('skips an obstacle entity that has no MeshPrimitive', () => {
    // ObstacleComponent but no MeshPrimitiveComponent — getEntitiesWithComponent
    // returns it, but `m` is undefined so it's skipped.
    const e = world.createEntity();
    e.add(
      new ObstacleComponent({
        halfWidth: 1,
        halfDepth: 1,
        blocksSight: true,
        blocksBullets: true,
      }),
    );
    expect(collectObstacleBoxes(world)).toHaveLength(0);
  });
});
