// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { MeshPrimitivePanel, type MeshPrimitiveParams } from './MeshPrimitive.panel';

function makeParams(): MeshPrimitiveParams {
  return { scaleX: 1, scaleY: 1, scaleZ: 1, visibility: 1 };
}

describe('MeshPrimitivePanel', () => {
  it('mounts and shows Scale X', () => {
    const { container } = render(() => (
      <MeshPrimitivePanel params={makeParams()} setParam={vi.fn()} onReset={vi.fn()} />
    ));
    expect(container.textContent).toContain('Scale X');
  });

  it('moving Scale X fires setParam with scaleX key', () => {
    const setParam = vi.fn();
    const { getAllByRole } = render(() => (
      <MeshPrimitivePanel params={makeParams()} setParam={setParam} onReset={vi.fn()} />
    ));
    fireEvent.input(
      (getAllByRole('slider') as HTMLInputElement[])[0],
      { target: { value: '2.5' } },
    );
    expect(setParam).toHaveBeenCalledWith('scaleX', 2.5);
  });

  it('Reset fires onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <MeshPrimitivePanel params={makeParams()} setParam={vi.fn()} onReset={onReset} />
    ));
    fireEvent.click(getByText(/reset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
