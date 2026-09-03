/**
 * Canonical global keyboard input event names. Components that bridge raw DOM
 * key events onto the EventBus (KeyboardMover, Flipper, TwinStickShooter) and
 * anything that listens for them import these constants instead of hardcoding
 * the strings, so emitter and listener can't drift into silent synonyms.
 */
export const KeyboardInputEvents = {
  KEYDOWN: 'keyboard.keydown',
  KEYUP: 'keyboard.keyup',
} as const;

/**
 * Canonical global pointer input event names, the mouse's half of the same
 * contract. `MouseInput` bridges raw DOM pointer events (including pointer
 * lock) onto the bus and anything that steers from them — a 6-DOF flight stick,
 * a free-look camera — listens here.
 *
 * This lives in the dictionary rather than in MouseInput's own defs for the
 * usual reason: a listener that had to `import` the emitter would drag the
 * emitter's System into its bundle and stop being downloadable on its own.
 */
export const MouseInputEvents = {
  /** Relative motion since the last DOM event: `{ dx, dy }` device pixels. */
  MOVE: 'mouse.move',
  /** Button pressed: `{ button }` (0 = left, 1 = middle, 2 = right). */
  DOWN: 'mouse.down',
  /** Button released: `{ button }`. */
  UP: 'mouse.up',
  /** Pointer-lock acquired or released: `{ locked }`. */
  LOCK_CHANGED: 'mouse.lockchanged',
} as const;
