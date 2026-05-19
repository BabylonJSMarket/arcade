import { describe, it, expect } from 'vitest';
import { createPlayerInput, DEFAULT_PLAYER_INPUT_PARAMS } from './PlayerInput.core';

describe('PlayerInput core', () => {
  it('a pressed key activates its bound action', () => {
    const input = createPlayerInput();
    input.pressKey('Space');
    expect(input.isActive('jump')).toBe(true);
  });

  it('justPressed fires once, then empties on the next consume', () => {
    const input = createPlayerInput();
    input.pressKey('Space');
    const first = input.consume();
    expect(first.justPressed).toContain('jump');
    const second = input.consume();
    expect(second.justPressed).toHaveLength(0);
  });

  it('releasing a key deactivates the action and queues justReleased', () => {
    const input = createPlayerInput();
    input.pressKey('KeyE');
    input.consume();
    input.releaseKey('KeyE');
    const s = input.consume();
    expect(s.justReleased).toContain('attack');
    expect(input.isActive('attack')).toBe(false);
  });

  it('multiple keys bound to the same action only release when the last one lifts', () => {
    const input = createPlayerInput();
    input.pressKey('KeyW');
    input.pressKey('ArrowUp');
    input.releaseKey('KeyW');
    expect(input.isActive('moveForward')).toBe(true);
    input.releaseKey('ArrowUp');
    expect(input.isActive('moveForward')).toBe(false);
  });

  it('forward + right produces a diagonal move vector normalised to unit length', () => {
    const input = createPlayerInput();
    input.pressKey('KeyW');
    input.pressKey('KeyD');
    const s = input.consume();
    expect(Math.hypot(s.moveX, s.moveZ)).toBeCloseTo(1, 5);
    expect(s.moveX).toBeGreaterThan(0);
    expect(s.moveZ).toBeGreaterThan(0);
  });

  it('gamepad axis below the deadzone is treated as zero', () => {
    const input = createPlayerInput({ deadzone: 0.2 });
    input.setGamepadAxis(0, 0.1);
    expect(input.consume().moveX).toBe(0);
    input.setGamepadAxis(0, 0.5);
    expect(input.consume().moveX).toBe(0.5);
  });

  it('gamepad button triggers the same action as its bound key', () => {
    const input = createPlayerInput();
    input.pressGamepadButton(0);
    expect(input.isActive('jump')).toBe(true);
    const s = input.consume();
    expect(s.source).toBe('gamepad');
  });

  it('reset clears all active actions and zeroes the move vector', () => {
    const input = createPlayerInput();
    input.pressKey('KeyW');
    input.pressGamepadButton(2);
    input.reset();
    const s = input.consume();
    expect(s.active.size).toBe(0);
    expect(s.moveX).toBe(0);
    expect(s.moveZ).toBe(0);
  });

  it('setParams.keyBindings rebinds on the fly without dropping held state', () => {
    const input = createPlayerInput();
    input.pressKey('KeyQ');
    expect(input.isActive('attack')).toBe(false);
    input.setParams({ keyBindings: { attack: ['KeyQ'] } });
    expect(input.isActive('attack')).toBe(true);
  });

  it('getParams reflects the defaults when none are provided', () => {
    const input = createPlayerInput();
    expect(input.getParams().deadzone).toBe(DEFAULT_PLAYER_INPUT_PARAMS.deadzone);
  });
});
