import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import type { MechanicContractContext } from '@babylonjsmarket/ecs/testing';
import {
  HealthComponent,
  HealthSystem,
  HealthEvents,
  HealthInputEvents,
} from './Health';

/**
 * HealthSystem routes its inputs by `entityId`. The contract battery mints
 * a fresh entity inside `buildWorld`; we latch onto `world.entity.created`
 * so `makeInputPayload` always references the most recent one.
 */
let latestEntityId = 'contract-test';

runMechanicContract({
  name: 'Health',
  componentClass: HealthComponent,
  systemClass: HealthSystem,
  sampleInput: { hp: 5, maxHp: 5 },
  events: {
    input: [HealthInputEvents.DAMAGE, HealthInputEvents.HEAL],
    output: [
      HealthEvents.DAMAGED,
      HealthEvents.HEALED,
      HealthEvents.DIED,
      HealthEvents.RESPAWNED,
    ],
  },
  setup(ctx: MechanicContractContext) {
    ctx.eventBus.on('world.entity.created', (e: { entity: { id: string } }) => {
      latestEntityId = e.entity.id;
    });
  },
  makeInputPayload(event) {
    if (event === HealthInputEvents.DAMAGE) {
      return { entityId: latestEntityId, damage: 1 };
    }
    if (event === HealthInputEvents.HEAL) {
      return { entityId: latestEntityId, amount: 1 };
    }
    return {};
  },
});
