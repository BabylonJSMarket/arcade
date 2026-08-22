/**
 * PlayerInput — definitions.
 *
 * The PlayerInput component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * PlayerInput in a query or react to what it emits: this file carries no System, so
 * naming PlayerInput never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
import { DEFAULT_PLAYER_INPUT_PARAMS, type PlayerInputInstance, type PlayerInputParams, type KeyBindings, type GamepadBindings, type InputSource } from './PlayerInput.core';
export interface PlayerInputActionEvent {
  entityId: string;
  action: string;
  source: InputSource;
}

export interface PlayerInputMoveEvent {
  entityId: string;
  x: number;
  z: number;
}

export interface PlayerInputSourceEvent {
  entityId: string;
  source: InputSource;
}

export interface PlayerInputSetEnabledEvent {
  enabled: boolean;
}

export interface PlayerInputInput extends Partial<PlayerInputParams> {
  enabled?: boolean;
  /** Which gamepad slot (0-3) to poll each frame. */
  gamepadIndex?: number;
}

export class PlayerInputComponent extends Component {
  params: PlayerInputParams;
  gamepadIndex: number;
  instance: PlayerInputInstance | null = null;

  constructor(data: PlayerInputInput = {}) {
    super();
    const { enabled, gamepadIndex, keyBindings, gamepadBindings, deadzone } = data;
    this.params = {
      deadzone: deadzone ?? DEFAULT_PLAYER_INPUT_PARAMS.deadzone,
      keyBindings: { ...DEFAULT_PLAYER_INPUT_PARAMS.keyBindings, ...(keyBindings ?? {}) } as KeyBindings,
      gamepadBindings: {
        ...DEFAULT_PLAYER_INPUT_PARAMS.gamepadBindings,
        ...(gamepadBindings ?? {}),
      } as GamepadBindings,
    };
    this.enabled = enabled ?? true;
    this.gamepadIndex = gamepadIndex ?? 0;
  }

  serialize(): PlayerInputInput {
    return {
      enabled: this.enabled,
      gamepadIndex: this.gamepadIndex,
      deadzone: this.params.deadzone,
      keyBindings: this.params.keyBindings,
      gamepadBindings: this.params.gamepadBindings,
    };
  }
}

// Gamepads that have been seen and whose button/axis state we last cached.
export interface GamepadSnapshot {
  buttons: boolean[];
  axisX: number;
  axisZ: number;
}