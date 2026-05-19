import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import type { MechanicContractContext } from '@babylonjsmarket/ecs/testing';
import {
  PhysicsComponent,
  PhysicsSystem,
  PhysicsEvents,
  PhysicsInputEvents,
} from './Physics';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

/**
 * Physics needs a sibling MeshPrimitive with an adapter handle before the
 * system will call `physicsCreateBody` (the body is keyed by the mesh id).
 * We latch onto every new entity and attach a mesh + handle to it so the
 * contract battery's generic "add the Component" entity triggers body
 * creation under Mock renderer.
 */
let latestEntityId = 'physics-contract';

runMechanicContract({
  name: 'Physics',
  componentClass: PhysicsComponent,
  systemClass: PhysicsSystem,
  sampleInput: { shapeType: 'box', mass: 3 },
  events: {
    input: [
      PhysicsInputEvents.SET_VELOCITY,
      PhysicsInputEvents.PAUSE,
      PhysicsInputEvents.RESUME,
    ],
    output: [PhysicsEvents.BODY_CREATED, PhysicsEvents.BODY_DISPOSED],
  },
  setup(ctx: MechanicContractContext) {
    // Auto-attach a MeshPrimitive with a live handle to every entity created
    // during the battery so the Physics system has a mesh to key off.
    ctx.eventBus.on('world.entity.created', (e: { entity: { id: string; add(c: unknown): void; get(c: unknown): unknown } }) => {
      latestEntityId = e.entity.id;
      const mesh = new MeshPrimitiveComponent({ primitive: 'sphere' });
      mesh.handle = ctx.renderer.createMesh(e.entity.id, mesh.toPrimitiveSpec()) as ReturnType<
        typeof ctx.renderer.createMesh
      >;
      e.entity.add(mesh);
    });
  },
  makeInputPayload(event) {
    if (event === PhysicsInputEvents.SET_VELOCITY) {
      return { entityId: latestEntityId, vx: 0, vy: 1, vz: 0 };
    }
    return {};
  },
});
