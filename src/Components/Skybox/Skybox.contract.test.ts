import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { SkyboxComponent, SkyboxSystem } from './Skybox';

runMechanicContract({
  name: 'Skybox',
  componentClass: SkyboxComponent,
  systemClass: SkyboxSystem,
  sampleInput: { sunGlowSize: 90 },
  events: {
    // Skybox emits CREATED/SUN_CHANGED only when wired to a real adapter;
    // covered by Skybox.test.ts. Contract here just checks the boilerplate.
  },
});
