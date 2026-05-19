// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { HemisphericLightPanel, type HemisphericLightParams } from './HemisphericLight.panel';

function makeParams(): HemisphericLightParams {
  return {
    intensity: 0.4,
    directionX: 0, directionY: 1, directionZ: 0,
    diffuseR: 1, diffuseG: 1, diffuseB: 1,
    groundR: 0.3, groundG: 0.3, groundB: 0.4,
    specularR: 0, specularG: 0, specularB: 0,
  };
}

describe('HemisphericLightPanel', () => {
  it('mounts and shows Intensity', () => {
    const { container } = render(() => (
      <HemisphericLightPanel params={makeParams()} setParam={vi.fn()} onReset={vi.fn()} />
    ));
    expect(container.textContent).toContain('Intensity');
  });

  it('moving the intensity slider calls setParam', () => {
    const setParam = vi.fn();
    const { getAllByRole } = render(() => (
      <HemisphericLightPanel params={makeParams()} setParam={setParam} onReset={vi.fn()} />
    ));
    fireEvent.input(
      (getAllByRole('slider') as HTMLInputElement[])[0],
      { target: { value: '1.2' } },
    );
    expect(setParam).toHaveBeenCalledWith('intensity', 1.2);
  });

  it('Reset fires onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <HemisphericLightPanel params={makeParams()} setParam={vi.fn()} onReset={onReset} />
    ));
    fireEvent.click(getByText(/reset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
