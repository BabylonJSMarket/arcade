// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { MeshPanel } from './Mesh.panel';
import { createMesh } from './Mesh.core';

describe('MeshPanel (viz mount)', () => {
  it('mounts without a renderer and exposes status/source sections', () => {
    const core = createMesh({ src: '/x.glb' });
    const { container } = render(() => <MeshPanel core={core} />);
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Source');
  });

  it('reload button fires onReload when supplied', () => {
    const core = createMesh({ src: '/x.glb' });
    const onReload = vi.fn();
    const { getByText } = render(() => <MeshPanel core={core} onReload={onReload} />);
    fireEvent.click(getByText(/reload/i));
    expect(onReload).toHaveBeenCalledWith('/x.glb');
  });
});
