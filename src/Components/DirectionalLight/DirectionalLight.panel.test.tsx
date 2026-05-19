// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { DirectionalLightPanel, type DirectionalLightParams } from './DirectionalLight.panel';

function makeParams(): DirectionalLightParams {
  return {
    dirX: -1, dirY: -1, dirZ: -1,
    posX: 0, posY: 10, posZ: 0,
    intensity: 1,
    diffuseR: 1, diffuseG: 1, diffuseB: 1,
    specularR: 1, specularG: 1, specularB: 1,
  };
}

describe('DirectionalLightPanel', () => {
  it('mounts and shows the Direction section', () => {
    const { container } = render(() => (
      <DirectionalLightPanel params={makeParams()} setParam={vi.fn()} onReset={vi.fn()} />
    ));
    expect(container.textContent).toContain('Direction');
    expect(container.textContent).toContain('Intensity');
  });

  it('moving a direction slider calls setParam', () => {
    const setParam = vi.fn();
    const { getAllByRole } = render(() => (
      <DirectionalLightPanel params={makeParams()} setParam={setParam} onReset={vi.fn()} />
    ));
    const slider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(slider, { target: { value: '0.5' } });
    expect(setParam).toHaveBeenCalledWith('dirX', 0.5);
  });

  it('Reset fires onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <DirectionalLightPanel params={makeParams()} setParam={vi.fn()} onReset={onReset} />
    ));
    fireEvent.click(getByText(/reset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
