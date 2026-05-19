import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  HemisphericLightComponent,
  HemisphericLightSystem,
  HemisphericLightEvents,
} from './HemisphericLight';

runMechanicContract({
  name: 'HemisphericLight',
  componentClass: HemisphericLightComponent,
  systemClass: HemisphericLightSystem,
  sampleInput: { intensity: 0.7 },
  events: {
    output: [HemisphericLightEvents.CREATED],
  },
});
