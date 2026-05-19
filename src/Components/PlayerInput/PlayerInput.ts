/**
 * PlayerInput.ts — renderer-agnostic System wiring the DOM keyboard + browser
 * Gamepad API into the pure core. Emits action.pressed / action.released /
 * move.changed on the EventBus so other systems (jump, attack, mover) never
 * have to know which key fired.
 *
 * Zero imports from @babylonjs or three — this System is a driver around
 * PlayerInput.core and the browser input APIs.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import {
  createPlayerInput,
  DEFAULT_PLAYER_INPUT_PARAMS,
  type PlayerInputInstance,
  type PlayerInputParams,
  type KeyBindings,
  type GamepadBindings,
  type InputSource,
} from './PlayerInput.core';

export const PlayerInputEvents = {
  ACTION_PRESSED: 'playerInput.actionPressed',
  ACTION_RELEASED: 'playerInput.actionReleased',
  MOVE_CHANGED: 'playerInput.moveChanged',
  SOURCE_CHANGED: 'playerInput.sourceChanged',
} as const;

export const PlayerInputInputEvents = {
  SET_ENABLED: 'playerInput.setEnabled',
} as const;

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
interface GamepadSnapshot {
  buttons: boolean[];
  axisX: number;
  axisZ: number;
}

export class PlayerInputSystem extends System {
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private unsubscribes: Array<() => void> = [];
  private lastSources: Map<string, InputSource> = new Map();
  private lastMoveX: Map<string, number> = new Map();
  private lastMoveZ: Map<string, number> = new Map();
  private gamepadCache: Map<number, GamepadSnapshot> = new Map();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [PlayerInputComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) this.ensureInstance(entity);

    this.keydownHandler = (e: KeyboardEvent) => this.dispatchKey(e.code, true);
    this.keyupHandler = (e: KeyboardEvent) => this.dispatchKey(e.code, false);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydownHandler);
      window.addEventListener('keyup', this.keyupHandler);
    }

    this.unsubscribes.push(
      this.eventBus.on(PlayerInputInputEvents.SET_ENABLED, (e: PlayerInputSetEnabledEvent) => {
        for (const entity of this.entities) {
          const comp = entity.get(PlayerInputComponent);
          if (comp) {
            comp.enabled = e.enabled;
            if (!e.enabled) comp.instance?.reset();
          }
        }
      }),
    );
  }

  protected onShutdown(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    }
    this.keydownHandler = null;
    this.keyupHandler = null;
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.lastSources.clear();
    this.lastMoveX.clear();
    this.lastMoveZ.clear();
    this.gamepadCache.clear();
  }

  protected onEntityAdded(entity: Entity): void {
    this.ensureInstance(entity);
  }

  protected onEntityRemoved(entity: Entity): void {
    const id = (entity as unknown as { id: string }).id;
    this.lastSources.delete(id);
    this.lastMoveX.delete(id);
    this.lastMoveZ.delete(id);
  }

  private ensureInstance(entity: Entity): void {
    const comp = entity.get(PlayerInputComponent);
    if (!comp || comp.instance) return;
    comp.instance = createPlayerInput(comp.params);
  }

  private dispatchKey(code: string, down: boolean): void {
    for (const entity of this.entities) {
      const comp = entity.get(PlayerInputComponent);
      if (!comp?.instance || !comp.enabled) continue;
      if (down) comp.instance.pressKey(code);
      else comp.instance.releaseKey(code);
    }
  }

  private pollGamepads(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (const entity of this.entities) {
      const comp = entity.get(PlayerInputComponent);
      if (!comp?.instance || !comp.enabled) continue;
      const gp = gamepads[comp.gamepadIndex];
      if (!gp) continue;

      let snap = this.gamepadCache.get(comp.gamepadIndex);
      if (!snap) {
        snap = { buttons: [], axisX: 0, axisZ: 0 };
        this.gamepadCache.set(comp.gamepadIndex, snap);
      }

      for (let b = 0; b < gp.buttons.length; b++) {
        const now = !!gp.buttons[b]?.pressed;
        const was = snap.buttons[b] ?? false;
        if (now && !was) comp.instance.pressGamepadButton(b);
        else if (!now && was) comp.instance.releaseGamepadButton(b);
        snap.buttons[b] = now;
      }

      const x = gp.axes[0] ?? 0;
      const z = gp.axes[1] ?? 0;
      if (x !== snap.axisX) {
        comp.instance.setGamepadAxis(0, x);
        snap.axisX = x;
      }
      if (z !== snap.axisZ) {
        comp.instance.setGamepadAxis(1, z);
        snap.axisZ = z;
      }
    }
  }

  protected onUpdate(_dt: number): void {
    this.pollGamepads();

    for (const entity of this.entities) {
      const comp = entity.get(PlayerInputComponent);
      if (!comp?.instance) continue;

      // Pick up panel edits to params before reading the state.
      comp.instance.setParams(comp.params);

      const state = comp.instance.consume();
      const entityId = (entity as unknown as { id: string }).id;

      for (const action of state.justPressed) {
        this.eventBus.emit(PlayerInputEvents.ACTION_PRESSED, {
          entityId,
          action,
          source: state.source,
        });
      }
      for (const action of state.justReleased) {
        this.eventBus.emit(PlayerInputEvents.ACTION_RELEASED, {
          entityId,
          action,
          source: state.source,
        });
      }

      const prevX = this.lastMoveX.get(entityId) ?? 0;
      const prevZ = this.lastMoveZ.get(entityId) ?? 0;
      if (prevX !== state.moveX || prevZ !== state.moveZ) {
        this.eventBus.emit(PlayerInputEvents.MOVE_CHANGED, {
          entityId,
          x: state.moveX,
          z: state.moveZ,
        });
        this.lastMoveX.set(entityId, state.moveX);
        this.lastMoveZ.set(entityId, state.moveZ);
      }

      const prevSource = this.lastSources.get(entityId);
      if (state.source !== 'none' && state.source !== prevSource) {
        this.eventBus.emit(PlayerInputEvents.SOURCE_CHANGED, {
          entityId,
          source: state.source,
        });
        this.lastSources.set(entityId, state.source);
      }
    }
  }
}
