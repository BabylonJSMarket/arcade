import { EnemyEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { EnemyComponent, EnemySystem } from './Enemy';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

runMechanicContract({
  name: 'Enemy',
  componentClass: EnemyComponent,
  systemClass: EnemySystem,
  sampleInput: { speed: 5, pointsOnKill: 250, targetTag: 'hero' },
  // EnemySystem mutates the entity's sibling MeshPrimitive each frame.
  companions: [MeshPrimitiveComponent],
  events: {
    // EnemySystem.onInitialize subscribes to 'health.died' to drive the kill
    // cleanup flow (emit EnemyEvents.KILLED + 'score.add' + remove entity).
    input: ['health.died'],
    // Skipping events.output — KILLED / 'score.add' only fire after a
    // 'health.died' event for an entity that *also* has a HealthComponent
    // worth of state behind it; that's a multi-system flow covered by
    // scene-level tests, not this contract.
  },
});
