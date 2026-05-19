/**
 * PlayerInput.core.ts — action-map input abstraction.
 *
 * The problem: games need to react to intents ("jump", "attack", "interact"),
 * not to raw key codes. Hard-coding `KeyW` into every system means rebinding
 * is impossible and gamepad support is bolted on ad-hoc later. This core
 * maintains a pure action-map: callers push down/up events in and the core
 * reports which actions are currently active, plus fires edge events on
 * transitions.
 *
 * Pure core: zero imports from @babylonjs, three, solid-js, or the DOM. Same
 * inputs => same outputs. The System wires it to the real keyboard; tests
 * drive it directly.
 */

/** Named actions the game asks about. Add your own to the bindings map. */
export type ActionName = string;

/** Where an input came from this frame. */
export type InputSource = 'keyboard' | 'gamepad' | 'none';

/** Map from action name -> list of accepted keyboard key codes ("KeyW", etc). */
export type KeyBindings = Record<ActionName, string[]>;

/** Map from action name -> list of accepted gamepad button indices. */
export type GamepadBindings = Record<ActionName, number[]>;

export interface PlayerInputParams {
  /** Stick deadzone for gamepad axes in [0, 1]. Values below are zeroed. */
  deadzone: number;
  /** Keyboard binding table, action -> list of key codes. */
  keyBindings: KeyBindings;
  /** Gamepad binding table, action -> list of button indices. */
  gamepadBindings: GamepadBindings;
}

/** The four directional actions the mover reads. */
export const MOVE_ACTIONS = ['moveForward', 'moveBackward', 'moveLeft', 'moveRight'] as const;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  attack: ['KeyE', 'Enter'],
  interact: ['KeyF'],
};

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  jump: [0],      // A / Cross
  attack: [2],    // X / Square
  interact: [3],  // Y / Triangle
};

export const DEFAULT_PLAYER_INPUT_PARAMS: PlayerInputParams = {
  deadzone: 0.15,
  keyBindings: DEFAULT_KEY_BINDINGS,
  gamepadBindings: DEFAULT_GAMEPAD_BINDINGS,
};

/** Per-frame summary consumed by downstream systems / panel. */
export interface PlayerInputState {
  /** Actions currently pressed this frame. */
  active: Set<ActionName>;
  /** Actions whose pressed state rose this call. */
  justPressed: ActionName[];
  /** Actions whose pressed state fell this call. */
  justReleased: ActionName[];
  /** Normalized move vector derived from directional actions + gamepad axes. */
  moveX: number;
  moveZ: number;
  /** Where the last activity came from. */
  source: InputSource;
}

export interface PlayerInputInstance {
  /** Record a key down. Returns the action that became active, if any. */
  pressKey(code: string): ActionName | null;
  /** Record a key up. Returns the action that went inactive, if any. */
  releaseKey(code: string): ActionName | null;
  /** Record a gamepad button press. */
  pressGamepadButton(button: number): ActionName | null;
  /** Record a gamepad button release. */
  releaseGamepadButton(button: number): ActionName | null;
  /** Record a gamepad axis value in [-1, 1]. Axis 0 = stick X, 1 = stick Y. */
  setGamepadAxis(axis: 0 | 1, value: number): void;
  /** Ask whether an action is currently active. */
  isActive(action: ActionName): boolean;
  /**
   * End-of-frame sample: returns the state, empties the justPressed /
   * justReleased queues, and clears gamepad axes so callers only pay attention
   * to changes they haven't seen yet.
   */
  consume(): PlayerInputState;
  setParams(partial: Partial<PlayerInputParams>): void;
  getParams(): Readonly<PlayerInputParams>;
  reset(): void;
}

export function createPlayerInput(
  params: Partial<PlayerInputParams> = {},
): PlayerInputInstance {
  const active: PlayerInputParams = {
    ...DEFAULT_PLAYER_INPUT_PARAMS,
    ...params,
    keyBindings: { ...DEFAULT_KEY_BINDINGS, ...(params.keyBindings ?? {}) },
    gamepadBindings: { ...DEFAULT_GAMEPAD_BINDINGS, ...(params.gamepadBindings ?? {}) },
  };

  const pressedKeys = new Set<string>();
  const pressedButtons = new Set<number>();
  const activeActions = new Set<ActionName>();
  const justPressed = new Set<ActionName>();
  const justReleased = new Set<ActionName>();
  let axisX = 0;
  let axisZ = 0;
  let source: InputSource = 'none';

  // Which actions does a given key code trigger?
  function actionsForKey(code: string): ActionName[] {
    const out: ActionName[] = [];
    for (const action of Object.keys(active.keyBindings)) {
      if (active.keyBindings[action]?.includes(code)) out.push(action);
    }
    return out;
  }

  function actionsForButton(button: number): ActionName[] {
    const out: ActionName[] = [];
    for (const action of Object.keys(active.gamepadBindings)) {
      if (active.gamepadBindings[action]?.includes(button)) out.push(action);
    }
    return out;
  }

  // Recompute an action's state from all bindings that feed it. Returns true
  // if the action transitioned to active, false if it transitioned to
  // inactive, null if unchanged.
  function refreshAction(action: ActionName): boolean | null {
    const keys = active.keyBindings[action] ?? [];
    const buttons = active.gamepadBindings[action] ?? [];
    const shouldBeActive =
      keys.some((k) => pressedKeys.has(k)) ||
      buttons.some((b) => pressedButtons.has(b));
    const wasActive = activeActions.has(action);
    if (shouldBeActive && !wasActive) {
      activeActions.add(action);
      justPressed.add(action);
      justReleased.delete(action);
      return true;
    }
    if (!shouldBeActive && wasActive) {
      activeActions.delete(action);
      justReleased.add(action);
      justPressed.delete(action);
      return false;
    }
    return null;
  }

  return {
    pressKey(code) {
      if (pressedKeys.has(code)) return null;
      pressedKeys.add(code);
      source = 'keyboard';
      let firstTrigger: ActionName | null = null;
      for (const action of actionsForKey(code)) {
        if (refreshAction(action) === true && firstTrigger === null) {
          firstTrigger = action;
        }
      }
      return firstTrigger;
    },
    releaseKey(code) {
      if (!pressedKeys.has(code)) return null;
      pressedKeys.delete(code);
      let firstRelease: ActionName | null = null;
      for (const action of actionsForKey(code)) {
        if (refreshAction(action) === false && firstRelease === null) {
          firstRelease = action;
        }
      }
      return firstRelease;
    },
    pressGamepadButton(button) {
      if (pressedButtons.has(button)) return null;
      pressedButtons.add(button);
      source = 'gamepad';
      let firstTrigger: ActionName | null = null;
      for (const action of actionsForButton(button)) {
        if (refreshAction(action) === true && firstTrigger === null) {
          firstTrigger = action;
        }
      }
      return firstTrigger;
    },
    releaseGamepadButton(button) {
      if (!pressedButtons.has(button)) return null;
      pressedButtons.delete(button);
      let firstRelease: ActionName | null = null;
      for (const action of actionsForButton(button)) {
        if (refreshAction(action) === false && firstRelease === null) {
          firstRelease = action;
        }
      }
      return firstRelease;
    },
    setGamepadAxis(axis, value) {
      const filtered = Math.abs(value) < active.deadzone ? 0 : value;
      if (axis === 0) axisX = filtered;
      else axisZ = filtered;
      if (filtered !== 0) source = 'gamepad';
    },
    isActive(action) {
      return activeActions.has(action);
    },
    consume() {
      // Derive move vector from directional actions (-1, 0, +1 per axis),
      // then overlay any gamepad stick that's outside the deadzone.
      let mx = 0;
      let mz = 0;
      if (activeActions.has('moveForward')) mz += 1;
      if (activeActions.has('moveBackward')) mz -= 1;
      if (activeActions.has('moveRight')) mx += 1;
      if (activeActions.has('moveLeft')) mx -= 1;
      if (axisX !== 0) mx = axisX;
      if (axisZ !== 0) mz = -axisZ; // Gamepad Y is forward-negative.
      // Normalise only when the combined magnitude exceeds 1 — a half-stick
      // throw should still read as half speed.
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const state: PlayerInputState = {
        active: new Set(activeActions),
        justPressed: Array.from(justPressed),
        justReleased: Array.from(justReleased),
        moveX: mx,
        moveZ: mz,
        source,
      };
      justPressed.clear();
      justReleased.clear();
      return state;
    },
    setParams(partial) {
      if (partial.deadzone !== undefined) active.deadzone = partial.deadzone;
      if (partial.keyBindings) {
        active.keyBindings = { ...active.keyBindings, ...partial.keyBindings };
      }
      if (partial.gamepadBindings) {
        active.gamepadBindings = { ...active.gamepadBindings, ...partial.gamepadBindings };
      }
      // Rebind may add or remove bindings that flip action state; recompute.
      for (const action of new Set([
        ...Object.keys(active.keyBindings),
        ...Object.keys(active.gamepadBindings),
      ])) {
        refreshAction(action);
      }
    },
    getParams() {
      return active;
    },
    reset() {
      pressedKeys.clear();
      pressedButtons.clear();
      activeActions.clear();
      justPressed.clear();
      justReleased.clear();
      axisX = 0;
      axisZ = 0;
      source = 'none';
    },
  };
}
