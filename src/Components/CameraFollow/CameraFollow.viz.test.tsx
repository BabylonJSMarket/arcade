// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { CameraFollowPanel } from './CameraFollow.panel';
import { createCameraFollow } from './CameraFollow.core';

describe('CameraFollowPanel', () => {
  it('mounts without a renderer and shows the smoothing controls', () => {
    const core = createCameraFollow();
    const { container } = render(() => <CameraFollowPanel core={core} />);
    expect(container.textContent).toContain('Smoothing');
    expect(container.textContent).toContain('offsetY');
  });

  it('moving a slider pushes the new value into the core', () => {
    const core = createCameraFollow();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <CameraFollowPanel core={core} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    fireEvent.input(sliders[0], { target: { value: '12' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ smoothing: 12 }));
  });

  it('reset button restores the defaults on the core', () => {
    const core = createCameraFollow({ smoothing: 1, offsetY: 0 });
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <CameraFollowPanel core={core} />);
    fireEvent.click(getByText(/Reset/i));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ smoothing: 6, offsetY: 1.2 }));
  });
});
