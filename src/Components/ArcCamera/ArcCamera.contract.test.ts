import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  ArcCameraComponent,
  ArcCameraSystem,
  ArcCameraEvents,
} from './ArcCamera';

runMechanicContract({
  name: 'ArcCamera',
  componentClass: ArcCameraComponent,
  systemClass: ArcCameraSystem,
  sampleInput: { distance: 14, alpha: 1.4 },
  events: {
    // ArcCameraSystem subscribes to 'meshprimitive.created' to lazily pick
    // up target-follow handles.
    input: ['meshprimitive.created'],
    output: [ArcCameraEvents.CREATED],
  },
});
