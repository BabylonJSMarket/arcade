import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import type { MechanicContractContext } from '@babylonjsmarket/ecs/testing';
import {
  MeshComponent,
  MeshSystem,
  MeshEvents,
  MeshInputEvents,
} from './Mesh';

/**
 * Mesh routes LOAD requests by entityId. The contract battery spins a fresh
 * entity for its assertions — we hook `world.entity.created` so the most
 * recently-minted id is always available when `makeInputPayload` runs.
 */
let latestEntityId = 'contract-test';

runMechanicContract({
  name: 'Mesh',
  componentClass: MeshComponent,
  systemClass: MeshSystem,
  sampleInput: { src: '/contract.glb', scale: 2 },
  events: {
    input: [MeshInputEvents.LOAD],
    output: [MeshEvents.LOADING, MeshEvents.LOADED, MeshEvents.ERROR],
  },
  setup(ctx: MechanicContractContext) {
    ctx.eventBus.on('world.entity.created', (e: { entity: { id: string } }) => {
      latestEntityId = e.entity.id;
    });
  },
  makeInputPayload(event) {
    if (event === MeshInputEvents.LOAD) {
      return { entityId: latestEntityId, src: '/input.glb' };
    }
    return {};
  },
});
