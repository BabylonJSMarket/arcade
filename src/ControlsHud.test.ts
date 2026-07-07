// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { hintsFromSceneTitle, mountControlsHud } from './ControlsHud';

describe('hintsFromSceneTitle', () => {
  it('parses "verb (KEY)" pairs into key-cap hints', () => {
    expect(hintsFromSceneTitle('Walk (WASD), run (Shift), jump (Space)')).toEqual([
      { key: 'WASD', label: 'Walk' },
      { key: 'Shift', label: 'Run' },
      { key: 'Space', label: 'Jump' },
    ]);
  });

  it('drops a leading hold/press/panel word from the key', () => {
    expect(hintsFromSceneTitle('strafe (hold Alt), fire (panel 5)')).toEqual([
      { key: 'Alt', label: 'Strafe' },
      { key: '5', label: 'Fire' },
    ]);
  });

  it('returns [] for an empty/undefined title or one without "(…)"', () => {
    expect(hintsFromSceneTitle(undefined)).toEqual([]);
    expect(hintsFromSceneTitle('just a plain title')).toEqual([]);
  });

  it('skips a pair whose parens are empty after stripping', () => {
    expect(hintsFromSceneTitle('nothing (hold )')).toEqual([]);
  });
});

describe('mountControlsHud', () => {
  let handle: { dispose(): void } | null = null;
  afterEach(() => {
    handle?.dispose();
    handle = null;
    document.body.innerHTML = '';
  });

  it('mounts an overlay with one row per hint', () => {
    handle = mountControlsHud([
      { key: 'WASD', label: 'Move' },
      { key: 'Space', label: 'Jump' },
    ]);
    const el = document.querySelector('[data-controls-hud]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('WASD');
    expect(el!.textContent).toContain('Move');
    expect(el!.querySelectorAll(':scope > div')).toHaveLength(2);
  });

  it('is a no-op with no hints', () => {
    handle = mountControlsHud([]);
    expect(document.querySelector('[data-controls-hud]')).toBeNull();
  });

  it('dispose removes the overlay', () => {
    handle = mountControlsHud([{ key: 'X', label: 'Y' }]);
    handle.dispose();
    expect(document.querySelector('[data-controls-hud]')).toBeNull();
  });
});
