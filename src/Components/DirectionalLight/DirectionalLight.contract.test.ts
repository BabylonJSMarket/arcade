import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  DirectionalLightComponent,
  DirectionalLightSystem,
  DirectionalLightEvents,
} from './DirectionalLight';

runMechanicContract({
  name: 'DirectionalLight',
  componentClass: DirectionalLightComponent,
  systemClass: DirectionalLightSystem,
  sampleInput: { intensity: 1.1, direction: [-1, -2, -1] },
  events: {
    output: [DirectionalLightEvents.CREATED],
  },
});
