// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { PlayerInputPanel } from './PlayerInput.panel';
import { createPlayerInput } from './PlayerInput.core';

describe('PlayerInputPanel', () => {
  it('mounts without a renderer and shows the active-actions section', () => {
    const core = createPlayerInput();
    const { container } = render(() => <PlayerInputPanel core={core} />);
    expect(container.textContent).toContain('Active actions');
    expect(container.textContent).toContain('Move vector');
    expect(container.textContent).toContain('deadzone');
  });

  it('moving the deadzone slider pushes the new value into the core', () => {
    const core = createPlayerInput();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <PlayerInputPanel core={core} />);
    const slider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(slider, { target: { value: '0.3' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ deadzone: 0.3 }));
  });

  it('renders the default key bindings in a readable row per action', () => {
    const core = createPlayerInput();
    const { container } = render(() => <PlayerInputPanel core={core} />);
    expect(container.textContent).toContain('jump');
    expect(container.textContent).toContain('Space');
    expect(container.textContent).toContain('KeyW');
  });

  it('the Reset button restores defaults on the core', () => {
    const core = createPlayerInput({ deadzone: 0.4 });
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <PlayerInputPanel core={core} />);
    fireEvent.click(getByText(/Reset/i));
    // Reset pushes deadzone + both binding tables.
    expect(spy).toHaveBeenCalled();
  });
});
