// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { PlayerInputPanel } from './PlayerInput.panel';
import { createPlayerInput } from './PlayerInput.core';

describe('PlayerInputPanel mount check', () => {
  it('a stub core can power the panel with no renderer imports', () => {
    const core = createPlayerInput();
    const { container } = render(() => <PlayerInputPanel core={core} />);
    expect(container.textContent).toContain('Active actions');
  });
});
