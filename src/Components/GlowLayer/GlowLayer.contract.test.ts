import { GlowLayerEvents, MeshEvents, MeshPrimitiveEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { GlowLayerComponent, GlowLayerSystem } from './GlowLayer';

runMechanicContract({
  name: 'GlowLayer',
  componentClass: GlowLayerComponent,
  systemClass: GlowLayerSystem,
  sampleInput: { intensity: 0.45, textureRatio: 0.25 },
  events: {
    // The mesh announcements it enrols from — other components' outputs, but
    // this System must subscribe to them, so they are its inputs.
    input: [MeshPrimitiveEvents.CREATED, MeshEvents.LOADED],
    output: [GlowLayerEvents.APPLIED],
  },
  makeInputPayload: () => ({ entityId: 'cabinet', handle: { __mockHandle: 'mesh:cabinet' } }),
});
