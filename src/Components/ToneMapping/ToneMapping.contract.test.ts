import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { ToneMappingComponent, ToneMappingSystem } from './ToneMapping';

runMechanicContract({
  name: 'ToneMapping',
  componentClass: ToneMappingComponent,
  systemClass: ToneMappingSystem,
  sampleInput: { mode: 'aces', exposure: 1.05, contrast: 1.05 },
  events: {
    // ToneMapping is one-shot init: it drives the Babylon adapter plugin's
    // apply/clear through renderer.extension() and emits no events.
  },
});
