import { FirstPersonCameraEvents } from '../../events';
import { KeyboardInputEvents } from '../../inputEvents';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { FirstPersonCameraComponent, FirstPersonCameraSystem } from './FirstPersonCamera';

runMechanicContract({
  name: 'FirstPersonCamera',
  componentClass: FirstPersonCameraComponent,
  systemClass: FirstPersonCameraSystem,
  sampleInput: { eyeHeight: 1.55, position: [0, 4.8], yaw: Math.PI, moveSpeed: 2.2, radius: 0.45 },
  events: {
    input: [KeyboardInputEvents.KEYDOWN, KeyboardInputEvents.KEYUP, FirstPersonCameraEvents.GOTO],
    output: [FirstPersonCameraEvents.CREATED],
  },
  makeInputPayload(event) {
    if (event === FirstPersonCameraEvents.GOTO) return { x: 1, z: 1 };
    return { code: 'KeyW' };
  },
});
