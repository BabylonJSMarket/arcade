import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { ShadowComponent, ShadowSystem } from './Shadow';
import { DirectionalLightComponent } from '../DirectionalLight/DirectionalLight.defs';

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
  setup({ world }) {
    // Shadow needs a DirectionalLight present so it has a shadow-caster
    // attachment target. The light handle now lives in DirectionalLightSystem's
    // runtime (not on the Component) and reaches Shadow via the CREATED event;
    // the generic contract only exercises Shadow's input plumbing, not its
    // caster output, so simply having the component in the world is enough.
    const lightEntity = world.createEntity();
    lightEntity.add(
      new DirectionalLightComponent({
        shadowEnabled: true,
        direction: [-1, -2, -1],
      }),
    );
  },
});
