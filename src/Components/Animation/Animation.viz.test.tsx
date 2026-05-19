// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { AnimationPanel } from './Animation.panel';
import { createAnimation } from './Animation.core';

describe('AnimationPanel (viz mount)', () => {
  it('mounts without a renderer and exposes the blend readout', () => {
    const core = createAnimation();
    const { container } = render(() => <AnimationPanel core={core} />);
    expect(container.textContent).toContain('Blend');
    expect(container.textContent).toContain('walkSpeed');
  });

  it('demo speed slider fires onSpeed when supplied', () => {
    const core = createAnimation();
    const onSpeed = vi.fn();
    const { getAllByRole } = render(() => <AnimationPanel core={core} onSpeed={onSpeed} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    fireEvent.input(sliders[0], { target: { value: '3.5' } });
    expect(onSpeed).toHaveBeenCalledWith(3.5);
  });
});
