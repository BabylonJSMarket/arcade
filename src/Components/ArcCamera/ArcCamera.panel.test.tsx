// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ArcCameraPanel, type ArcCameraParams } from './ArcCamera.panel';

function makeParams(): ArcCameraParams {
  return {
    distance: 10, minDistance: 1, maxDistance: 100,
    alpha: 0, beta: 1, minBeta: 0, maxBeta: 1.5,
    inertia: 0.9, wheelPrecision: 50, angularSensibility: 1000,
    speed: 1, autoRotateSpeed: 0.5,
  };
}

describe('ArcCameraPanel', () => {
  it('mounts and shows the Distance slider', () => {
    const { container } = render(() => (
      <ArcCameraPanel params={makeParams()} setParam={vi.fn()} onReset={vi.fn()} />
    ));
    expect(container.textContent).toContain('Distance');
  });

  it('moving a slider calls setParam', () => {
    const setParam = vi.fn();
    const { getAllByRole } = render(() => (
      <ArcCameraPanel params={makeParams()} setParam={setParam} onReset={vi.fn()} />
    ));
    const slider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(slider, { target: { value: '25' } });
    expect(setParam).toHaveBeenCalledWith('distance', 25);
  });

  it('Reset button fires onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <ArcCameraPanel params={makeParams()} setParam={vi.fn()} onReset={onReset} />
    ));
    fireEvent.click(getByText(/reset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
