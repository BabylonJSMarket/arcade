import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { AmbientOcclusionComponent, AmbientOcclusionSystem } from './AmbientOcclusion';

runMechanicContract({
  name: 'AmbientOcclusion',
  componentClass: AmbientOcclusionComponent,
  systemClass: AmbientOcclusionSystem,
  sampleInput: { radius: 0.8, strength: 1.0, samples: 8, maxZ: 40, base: 0.1, blurRatio: 1.0, ssaoRatio: 0.5 },
  events: {
    // With no plugin registered (the battery's bare MockRendererAdapter) the
    // only output is a single UNSUPPORTED; APPLIED/CLEARED need the plugin.
    // AmbientOcclusion.test.ts covers both paths.
  },
});
