import { NeonSignEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { NeonSignComponent, NeonSignSystem } from './NeonSign';

runMechanicContract({
  name: 'NeonSign',
  componentClass: NeonSignComponent,
  systemClass: NeonSignSystem,
  sampleInput: { text: 'PLAY', color: [0.15, 0.9, 1], size: 0.4, glow: 3, lightKind: 'spot' },
  events: {
    // TEXT_CHANGED / COLOR_CHANGED need a later mutation and EXTRUDED needs
    // the adapter plugin; NeonSign.test.ts covers those.
    output: [NeonSignEvents.CREATED],
  },
});
