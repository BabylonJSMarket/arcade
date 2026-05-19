// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { KeyboardMoverPanel } from './KeyboardMover.panel';
import { KeyboardMoverComponent } from './KeyboardMover';

describe('KeyboardMoverPanel', () => {
  it('mounts without a renderer and shows the speed control', () => {
    const comp = new KeyboardMoverComponent({ speed: 5 });
    const { container } = render(() => <KeyboardMoverPanel component={comp} />);
    expect(container.textContent).toContain('speed');
    expect(container.textContent).toContain('Face direction');
  });

  it('dragging the speed slider writes back to the component', () => {
    const comp = new KeyboardMoverComponent({ speed: 4 });
    const { getAllByRole } = render(() => <KeyboardMoverPanel component={comp} />);
    const slider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(slider, { target: { value: '8.5' } });
    expect(comp.speed).toBe(8.5);
  });

  it('the faceMotion checkbox toggles the component field', () => {
    const comp = new KeyboardMoverComponent({ faceMotion: true });
    const { getByRole } = render(() => <KeyboardMoverPanel component={comp} />);
    const box = getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(box);
    expect(comp.faceMotion).toBe(false);
    void vi;
  });
});
