import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  CameraFollowComponent,
  CameraFollowSystem,
  CameraFollowEvents,
} from './CameraFollow';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';

runMechanicContract({
  name: 'CameraFollow',
  componentClass: CameraFollowComponent,
  systemClass: CameraFollowSystem,
  sampleInput: { offsetY: 5, target: 'Hero' },
  events: {
    // CameraFollow subscribes to 'meshprimitive.created' — declared here so
    // the "Registers a listener for each declared input event" check runs.
    input: ['meshprimitive.created'],
    output: [CameraFollowEvents.TARGET_CHANGED],
  },
  makeInputPayload(event) {
    if (event === 'meshprimitive.created') {
      return { entityId: 'Hero', handle: { __mockHandle: 'mesh:Hero' } };
    }
    return {};
  },
  setup({ world, renderer }) {
    // The mechanic needs: (a) an active ArcCamera handle and (b) a target
    // MeshHandle mapped to the Follow component's `target` id. We pre-create
    // both so the update path doesn't bail before emitting TARGET_CHANGED.
    const arcEntity = world.createEntity();
    const arc = new ArcCameraComponent();
    arc.handle = renderer.createArcCamera(arcEntity.id, arc.toSpec());
    arc.initialized = true;
    arcEntity.add(arc);

    // Stub a world position the mesh handle reports through the adapter.
    const targetHandle = renderer.createMesh('Hero', { kind: 'box' });
    renderer.meshWorldPositions.set(targetHandle, [0, 1, 0]);
    // Announce the mesh so CameraFollowSystem latches onto it under id 'Hero'.
    world.getEventBus().emit('meshprimitive.created', {
      entityId: 'Hero',
      handle: targetHandle,
    });
  },
});
