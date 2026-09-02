import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';
import { collectObstacleBoxes, ObstacleComponent } from './Obstacle';
import { MeshComponent } from '../Mesh/Mesh.defs';
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

  it('an explicit center wins over the sibling MeshPrimitive', () => {
    // The primitive sits at the origin; the collider is told to be elsewhere.
    const e = world.createEntity();
    e.add(new MeshPrimitiveComponent({ primitive: 'box', position: [0, 0, 0] }));
    e.add(new ObstacleComponent({ center: [5, -2], halfWidth: 1, halfDepth: 0.5 }));
    expect(collectObstacleBoxes(world)[0]).toMatchObject({
      minX: 4,
      maxX: 6,
      minZ: -2.5,
      maxZ: -1.5,
    });
  });

  it('falls back to a sibling Mesh (a GLB cabinet) when there is no primitive', () => {
    const e = world.createEntity();
    e.add(new MeshComponent({ src: '/cab.glb', position: [3, 0, -4], autoLoad: false }));
    e.add(new ObstacleComponent({ halfWidth: 0.4, halfDepth: 0.5 }));
    expect(collectObstacleBoxes(world)[0]).toMatchObject({
      minX: 2.6,
      maxX: 3.4,
      minZ: -4.5,
      maxZ: -3.5,
    });
  });

  it('prefers the MeshPrimitive over the Mesh when an entity carries both', () => {
    // A follow-proxy setup: the primitive is the gameplay position, the GLB
    // trails it — the collider belongs with the proxy.
    const e = world.createEntity();
    e.add(new MeshPrimitiveComponent({ primitive: 'capsule', position: [1, 0, 1] }));
    e.add(new MeshComponent({ src: '/hero.glb', position: [9, 0, 9], autoLoad: false }));
    e.add(new ObstacleComponent({ halfWidth: 1, halfDepth: 1 }));
    expect(collectObstacleBoxes(world)[0]).toMatchObject({ minX: 0, maxX: 2, minZ: 0, maxZ: 2 });
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

  it('skips an obstacle entity with no center, no MeshPrimitive and no Mesh', () => {
    // getEntitiesWithComponent returns it, but it has nowhere to be.
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

  it('a bare center is enough — an invisible barrier needs no mesh at all', () => {
    const e = world.createEntity();
    e.add(new ObstacleComponent({ center: [-1, 2], halfWidth: 2, halfDepth: 3 }));
    expect(collectObstacleBoxes(world)[0]).toMatchObject({ minX: -3, maxX: 1, minZ: -1, maxZ: 5 });
  });
});
