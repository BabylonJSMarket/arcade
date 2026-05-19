import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  MeshPrimitiveEvents,
  MeshPrimitiveInputEvents,
} from './MeshPrimitive';

runMechanicContract({
  name: 'MeshPrimitive',
  componentClass: MeshPrimitiveComponent,
  systemClass: MeshPrimitiveSystem,
  sampleInput: { primitive: 'box', width: 2 },
  events: {
    input: [
      MeshPrimitiveInputEvents.SET_POSITION,
      MeshPrimitiveInputEvents.SET_COLOR,
      MeshPrimitiveInputEvents.SET_VISIBLE,
      MeshPrimitiveInputEvents.DISPOSE,
    ],
    output: [MeshPrimitiveEvents.CREATED],
  },
  makeInputPayload(event) {
    switch (event) {
      case MeshPrimitiveInputEvents.SET_POSITION:
        return { entityId: 'target', x: 1, y: 2, z: 3 };
      case MeshPrimitiveInputEvents.SET_COLOR:
        return { entityId: 'target', r: 1, g: 0, b: 0 };
      case MeshPrimitiveInputEvents.SET_VISIBLE:
        return { entityId: 'target', visible: false };
      case MeshPrimitiveInputEvents.DISPOSE:
        return { entityId: 'target' };
      default:
        return { entityId: 'target' };
    }
  },
});
