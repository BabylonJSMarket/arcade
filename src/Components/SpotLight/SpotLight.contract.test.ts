import { SpotLightEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { SpotLightComponent, SpotLightSystem } from './SpotLight';

runMechanicContract({
  name: 'SpotLight',
  componentClass: SpotLightComponent,
  systemClass: SpotLightSystem,
  sampleInput: { position: [1, 3, 2], direction: [0, -1, 0.2], angle: 1.2, intensity: 2 },
  events: {
    output: [SpotLightEvents.CREATED],
  },
});
