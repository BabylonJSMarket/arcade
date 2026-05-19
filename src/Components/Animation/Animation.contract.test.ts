import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import type { MechanicContractContext } from '@babylonjsmarket/ecs/testing';
import {
  AnimationComponent,
  AnimationSystem,
  AnimationEvents,
  AnimationInputEvents,
} from './Animation';

/**
 * Animation routes SET_SPEED requests by entityId and emits BLEND_UPDATED
 * every frame a matching entity exists. The contract battery creates a
 * fresh entity for its assertions — we hook `world.entity.created` so the
 * most-recently-minted id is always available when `makeInputPayload` runs.
 */
let latestEntityId = 'contract-test';

runMechanicContract({
  name: 'Animation',
  componentClass: AnimationComponent,
  systemClass: AnimationSystem,
  sampleInput: { walkSpeed: 4, runSpeed: 9 },
  events: {
    input: [AnimationInputEvents.SET_SPEED],
    output: [AnimationEvents.BLEND_UPDATED, AnimationEvents.STATE_CHANGED, AnimationEvents.READY],
  },
  setup(ctx: MechanicContractContext) {
    ctx.eventBus.on('world.entity.created', (e: { entity: { id: string } }) => {
      latestEntityId = e.entity.id;
    });
  },
  makeInputPayload(event) {
    if (event === AnimationInputEvents.SET_SPEED) {
      return { entityId: latestEntityId, speed: 5 };
    }
    return {};
  },
});
