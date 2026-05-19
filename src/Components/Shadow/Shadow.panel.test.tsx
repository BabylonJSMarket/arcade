// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ShadowPanel, type ShadowParams } from './Shadow.panel';

function makeParams(): ShadowParams {
  return {
    darkness: 0.4,
    bias: 0.00005,
    normalBias: 0,
    filteringQuality: 2,
    castShadowsGlobal: 1,
    receiveShadowsGlobal: 1,
  };
}

describe('ShadowPanel', () => {
  it('mounts and shows Darkness', () => {
    const { container } = render(() => (
      <ShadowPanel params={makeParams()} setParam={vi.fn()} onReset={vi.fn()} />
    ));
    expect(container.textContent).toContain('Darkness');
  });

  it('moving the darkness slider fires setParam', () => {
    const setParam = vi.fn();
    const { getAllByRole } = render(() => (
      <ShadowPanel params={makeParams()} setParam={setParam} onReset={vi.fn()} />
    ));
    fireEvent.input(
      (getAllByRole('slider') as HTMLInputElement[])[0],
      { target: { value: '0.8' } },
    );
    expect(setParam).toHaveBeenCalledWith('darkness', 0.8);
  });

  it('Reset fires onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <ShadowPanel params={makeParams()} setParam={vi.fn()} onReset={onReset} />
    ));
    fireEvent.click(getByText(/reset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
