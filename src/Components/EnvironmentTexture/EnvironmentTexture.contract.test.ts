import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  EnvironmentTextureComponent,
  EnvironmentTextureSystem,
} from './EnvironmentTexture';

runMechanicContract({
  name: 'EnvironmentTexture',
  componentClass: EnvironmentTextureComponent,
  systemClass: EnvironmentTextureSystem,
  sampleInput: { url: 'environment.env', level: 0.8 },
  events: {
    // EnvironmentTexture is one-shot init: it drives the adapter's
    // set/clearEnvironmentTexture directly and emits no events.
  },
});
