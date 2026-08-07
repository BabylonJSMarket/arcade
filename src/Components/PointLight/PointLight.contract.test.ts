import { PointLightEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { PointLightComponent, PointLightSystem } from './PointLight';

runMechanicContract({
  name: 'PointLight',
  componentClass: PointLightComponent,
  systemClass: PointLightSystem,
  sampleInput: { position: [1, 2, 3], intensity: 2, diffuse: [1, 0.2, 0.6] },
  events: {
    output: [PointLightEvents.CREATED],
  },
});
