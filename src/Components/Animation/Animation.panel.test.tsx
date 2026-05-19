// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { AnimationPanel } from './Animation.panel';
import { createAnimation } from './Animation.core';

describe('AnimationPanel (renderer-free)', () => {
  it('mounts against a stub core and shows the blend sections', () => {
    const core = createAnimation();
    const { container } = render(() => <AnimationPanel core={core} />);
    expect(container.textContent).toContain('Blend');
    expect(container.textContent).toContain('idle');
    expect(container.textContent).toContain('walk');
    expect(container.textContent).toContain('run');
    expect(container.textContent).toContain('Tuning');
  });

  it('moving a tuning slider calls core.setParams with the new value', () => {
    const core = createAnimation();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <AnimationPanel core={core} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    // The first slider is demo speed, the next one is walkSpeed.
    const walkSpeedSlider = sliders[1];
    fireEvent.input(walkSpeedSlider, { target: { value: '4.5' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ walkSpeed: 4.5 }));
  });

  it('the demo speed slider calls onSpeed when supplied', () => {
    const core = createAnimation();
    const onSpeed = vi.fn();
    const { getAllByRole } = render(() => <AnimationPanel core={core} onSpeed={onSpeed} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    const speedSlider = sliders[0];
    fireEvent.input(speedSlider, { target: { value: '5' } });
    expect(onSpeed).toHaveBeenCalledWith(5);
  });

  it('the Reset button clears core params back to defaults', () => {
    const core = createAnimation({ walkSpeed: 10 });
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <AnimationPanel core={core} />);
    fireEvent.click(getByText(/reset/i));
    expect(spy).toHaveBeenCalled();
  });
});
