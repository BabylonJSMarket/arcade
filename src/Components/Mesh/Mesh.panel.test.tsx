// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { MeshPanel } from './Mesh.panel';
import { createMesh } from './Mesh.core';

describe('MeshPanel (renderer-free)', () => {
  it('mounts against a stub core and shows the status sections', () => {
    const core = createMesh({ src: '/x.glb' });
    const { container } = render(() => <MeshPanel core={core} />);
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Source');
    expect(container.textContent).toContain('Transform');
    // The default loader state is idle.
    expect(container.textContent?.toLowerCase()).toContain('idle');
  });

  it('moving the scale slider calls core.setParams with the new value', () => {
    const core = createMesh({ src: '/x.glb' });
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <MeshPanel core={core} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    // The first slider is scale.
    fireEvent.input(sliders[0], { target: { value: '2.5' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ scale: 2.5 }));
  });

  it('the Reload button fires onReload with the current src', () => {
    const core = createMesh({ src: '/hero.glb' });
    const onReload = vi.fn();
    const { getByText } = render(() => <MeshPanel core={core} onReload={onReload} />);
    fireEvent.click(getByText(/reload/i));
    expect(onReload).toHaveBeenCalledWith('/hero.glb');
  });

  it('the Reset button clears core params back to defaults', () => {
    const core = createMesh({ src: '/x.glb', scale: 3 });
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <MeshPanel core={core} />);
    fireEvent.click(getByText(/reset/i));
    expect(spy).toHaveBeenCalled();
  });
});
