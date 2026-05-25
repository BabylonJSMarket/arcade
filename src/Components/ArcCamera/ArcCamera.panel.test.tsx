// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { CameraControlPanel, type CameraControlParams } from './ArcCamera.panel';

function makeParams(over: Partial<CameraControlParams> = {}): CameraControlParams {
  return { zoom: 30, panX: 0, panZ: 0, follow: true, ...over };
}

function noop() {
  return {
    setZoom: vi.fn(),
    setPanX: vi.fn(),
    setPanZ: vi.fn(),
    setFollow: vi.fn(),
    onCenter: vi.fn(),
  };
}

describe('CameraControlPanel', () => {
  it('mounts and shows the Zoom slider + follow state', () => {
    const { container } = render(() => (
      <CameraControlPanel params={makeParams()} {...noop()} />
    ));
    expect(container.textContent).toContain('Zoom');
    expect(container.textContent).toMatch(/Following/i);
  });

  it('moving the Zoom slider calls setZoom', () => {
    const fns = noop();
    const { getAllByRole } = render(() => (
      <CameraControlPanel params={makeParams()} {...fns} />
    ));
    const slider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(slider, { target: { value: '50' } });
    expect(fns.setZoom).toHaveBeenCalledWith(50);
  });

  it('clicking the follow toggle flips follow', () => {
    const fns = noop();
    const { getByText } = render(() => (
      <CameraControlPanel params={makeParams({ follow: true })} {...fns} />
    ));
    fireEvent.click(getByText(/Following/i));
    expect(fns.setFollow).toHaveBeenCalledWith(false);
  });

  it('Center button fires onCenter', () => {
    const fns = noop();
    const { getByText } = render(() => (
      <CameraControlPanel params={makeParams()} {...fns} />
    ));
    fireEvent.click(getByText(/center/i));
    expect(fns.onCenter).toHaveBeenCalled();
  });
});
