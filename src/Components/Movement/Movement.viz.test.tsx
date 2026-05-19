// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { MovementPanel } from './Movement.panel';
import { createMovement } from './Movement.core';

describe('MovementPanel (renderer-free)', () => {
  it('mounts without a renderer and shows the state + locomotion sections', () => {
    const core = createMovement();
    const { container } = render(() => <MovementPanel core={core} />);
    expect(container.textContent).toContain('State');
    expect(container.textContent).toContain('speed');
    expect(container.textContent).toContain('jumpForce');
  });

  it('moving the first slider calls core.setParams with the new speed', () => {
    const core = createMovement();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <MovementPanel core={core} />);
    const firstSlider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(firstSlider, { target: { value: '9' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ speed: 9 }));
  });
});
