import { FogEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { FogComponent, FogSystem } from './Fog';

runMechanicContract({
  name: 'Fog',
  componentClass: FogComponent,
  systemClass: FogSystem,
  sampleInput: { mode: 'exp2', color: [0.01, 0.01, 0.02], density: 0.11 },
  events: {
    output: [FogEvents.APPLIED],
  },
});
