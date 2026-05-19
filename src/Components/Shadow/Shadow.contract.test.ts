import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { ShadowComponent, ShadowSystem } from './Shadow';
import { DirectionalLightComponent } from '../DirectionalLight/DirectionalLight';

runMechanicContract({
  name: 'Shadow',
  componentClass: ShadowComponent,
  systemClass: ShadowSystem,
  sampleInput: { castShadow: true, receiveShadow: false },
  events: {
    input: ['meshprimitive.created'],
    // Shadow's output (SHADOW_CASTER_ADDED etc.) only fires once a matching
    // mesh handle and light handle both exist — the full flow is covered by
    // Shadow.test.ts and the scene-level demo, not the generic contract.
  },
  setup({ world, renderer }) {
    // Shadow needs a DirectionalLight already in the world to find the
    // shadow-caster attachment target.
    const lightEntity = world.createEntity();
    const light = new DirectionalLightComponent({
      shadowEnabled: true,
      direction: [-1, -2, -1],
    });
    light.handle = renderer.createDirectionalLight(lightEntity.id, {
      direction: [-1, -2, -1],
      intensity: 1,
      diffuse: [1, 1, 1],
      specular: [1, 1, 1],
    });
    lightEntity.add(light);
  },
});
