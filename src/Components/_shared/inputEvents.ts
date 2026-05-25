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
