import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { BulletPoolComponent, BulletPoolSystem } from './BulletPool';

runMechanicContract({
  name: 'BulletPool',
  componentClass: BulletPoolComponent,
  systemClass: BulletPoolSystem,
  sampleInput: { poolSize: 10 },
  events: {
    // Reacts to fire requests; announces readiness once it has registered the
    // World pool and pre-built its bullet entities.
    input: ['bulletPool.fire'],
    output: ['bulletPool.ready'],
  },
});
