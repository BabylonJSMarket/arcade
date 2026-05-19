import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import type { MechanicContractContext } from '@babylonjsmarket/ecs/testing';
import {
  MovementComponent,
  MovementSystem,
  MovementEvents,
  MovementInputEvents,
} from './Movement';

/**
 * Movement routes its inputs by `entityId`. The contract battery mints a
 * fresh entity inside `buildWorld`; we latch onto `world.entity.created` so
 * `makeInputPayload` always references the most recent one.
 */
let latestEntityId = 'contract-test';

runMechanicContract({
  name: 'Movement',
  componentClass: MovementComponent,
  systemClass: MovementSystem,
  sampleInput: { speed: 12, jumpForce: 10 },
  events: {
    input: [
      MovementInputEvents.SET_MOVEMENT_VECTOR,
      MovementInputEvents.JUMP_REQUESTED,
    ],
    output: [
      MovementEvents.JUMP_STARTED,
      MovementEvents.GROUNDED_CHANGED,
      MovementEvents.STARTED_MOVING,
      MovementEvents.STOPPED_MOVING,
    ],
  },
  setup(ctx: MechanicContractContext) {
    ctx.eventBus.on('world.entity.created', (e: { entity: { id: string } }) => {
      latestEntityId = e.entity.id;
    });
  },
  makeInputPayload(event) {
    if (event === MovementInputEvents.SET_MOVEMENT_VECTOR) {
      return { entityId: latestEntityId, x: 1, z: 0 };
    }
    if (event === MovementInputEvents.JUMP_REQUESTED) {
      return { entityId: latestEntityId };
    }
    return {};
  },
});
