// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { MovementPanel } from './Movement.panel';
import { createMovement } from './Movement.core';

describe('MovementPanel', () => {
  it('mounts without a renderer and shows the Locomotion section', () => {
    const core = createMovement();
    const { container } = render(() => <MovementPanel core={core} />);
    expect(container.textContent).toContain('Locomotion');
    expect(container.textContent).toContain('speed');
    expect(container.textContent).toContain('Jump & gravity');
  });

  it('moving a slider calls core.setParams with the new value', () => {
    const core = createMovement();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <MovementPanel core={core} />);
    const firstSlider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(firstSlider, { target: { value: '12' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ speed: 12 }));
  });

  it('the Jump button fires onJump when supplied', () => {
    const core = createMovement();
    const onJump = vi.fn();
    const { getByText } = render(() => <MovementPanel core={core} onJump={onJump} />);
    fireEvent.click(getByText(/Trigger jump/));
    expect(onJump).toHaveBeenCalled();
  });

  it('the Reset button clears params back to defaults', () => {
    const core = createMovement({ speed: 15 });
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <MovementPanel core={core} />);
    fireEvent.click(getByText(/reset/i));
    expect(spy).toHaveBeenCalled();
  });
});
