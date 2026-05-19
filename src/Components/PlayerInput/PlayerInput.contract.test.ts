import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  PlayerInputComponent,
  PlayerInputSystem,
  PlayerInputInputEvents,
} from './PlayerInput';

runMechanicContract({
  name: 'PlayerInput',
  componentClass: PlayerInputComponent,
  systemClass: PlayerInputSystem,
  sampleInput: { gamepadIndex: 2 },
  // Only SET_ENABLED is a pure-EventBus input; ACTION_PRESSED / MOVE_CHANGED
  // are driven by DOM keyboard + Gamepad API traffic that the contract battery
  // can't synthesize reliably. Mechanic-specific tests in PlayerInput.test.ts
  // cover those output paths.
  events: {
    input: [PlayerInputInputEvents.SET_ENABLED],
  },
  makeInputPayload(event) {
    if (event === PlayerInputInputEvents.SET_ENABLED) return { enabled: true };
    return {};
  },
});
