// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
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

// jsdom does no layout, so every box is 0×0. These tests give the HUD a size
// that follows its `bottom` style, and each fixture the rect in its
// `data-rect="x,y,w,h"`, so the step-aside logic sees a screen with things on
// it. The window is jsdom's 1024×768.
describe('mountControlsHud — stepping aside for a game HUD', () => {
  const HUD_W = 260;
  const HUD_H = 150;
  let handle: { dispose(): void } | null = null;

  const rect = (x: number, y: number, w: number, h: number) =>
    ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect;

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-controls-hud')) {
        const bottom = parseFloat((this as HTMLElement).style.bottom) || 0;
        return rect(12, window.innerHeight - bottom - HUD_H, HUD_W, HUD_H);
      }
      const spec = this.getAttribute('data-rect');
      if (!spec) return rect(0, 0, 0, 0);
      const [x, y, w, h] = spec.split(',').map(Number);
      return rect(x, y, w, h);
    });
  });

  afterEach(() => {
    handle?.dispose();
    handle = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /** A fixture element at x,y,w,h, appended to the body (or `parent`). */
  function put(spec: string, tag = 'div', parent: Element = document.body): HTMLElement {
    const el = document.createElement(tag);
    el.setAttribute('data-rect', spec);
    parent.append(el);
    return el;
  }

  const hud = () => document.querySelector('[data-controls-hud]') as HTMLElement;
  const mount = () => {
    handle = mountControlsHud([{ key: 'WASD', label: 'Move' }]);
  };

  it('stays in the corner when nothing else is there', () => {
    mount();
    expect(hud().style.bottom).toBe('12px');
    expect(hud().style.visibility).toBe('');
  });

  it('moves up to sit just above a panel already in its corner', () => {
    // Space Golf's TOP / SIDE / RESTART panel: bottom-left, 150px tall.
    put('18,600,400,150');
    mount();
    // 768 - 600 + 12: the box's bottom edge lands 12px above the panel's top.
    expect(hud().style.bottom).toBe('180px');
    expect(hud().style.visibility).toBe('');
  });

  it('keeps moving up while each lift lands it on another panel', () => {
    put('18,600,400,150');
    // The first lift puts the box at 438..588, on top of this one.
    put('18,400,300,160');
    mount();
    expect(hud().style.bottom).toBe('380px');
  });

  it('ignores what is not in the way: a screen-wide layer, the canvas, a faded-out element', () => {
    put('0,0,1024,768'); // a HUD root that spans the screen
    put('0,700,1000,60'); // a full-width row holding the real panels
    put('20,650,100,50', 'canvas');
    const faded = put('20,650,100,50');
    faded.checkVisibility = () => false;
    put('600,650,100,50'); // overlaps nothing
    mount();
    expect(hud().style.bottom).toBe('12px');
  });

  it('counts an element the browser reports as visible', () => {
    const shown = put('20,650,100,50');
    shown.checkVisibility = () => true;
    mount();
    expect(hud().style.bottom).toBe(`${768 - 650 + 12}px`);
  });

  it('gives up after a few passes if its own box never moves', () => {
    // A browser that reports a stale rect for the box would lift it forever.
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-controls-hud')) return rect(12, 606, HUD_W, HUD_H);
      return this.hasAttribute('data-rect') ? rect(18, 600, 400, 150) : rect(0, 0, 0, 0);
    });
    put('18,600,400,150');
    mount();
    expect(hud().style.bottom).toBe('180px');
  });

  it('hides when there is no room above the panel', () => {
    put('18,100,400,600');
    mount();
    expect(hud().style.visibility).toBe('hidden');
  });

  it('steps aside for a HUD that mounts after it', async () => {
    mount();
    expect(hud().style.bottom).toBe('12px');
    put('18,600,400,150');
    await new Promise((r) => setTimeout(r, 0)); // the observer reports on a later tick
    expect(hud().style.bottom).toBe('180px');
  });

  it('moves back down on resize once the corner is clear again', () => {
    const panel = put('18,600,400,150');
    mount();
    expect(hud().style.bottom).toBe('180px');
    panel.setAttribute('data-rect', '600,600,400,150');
    window.dispatchEvent(new Event('resize'));
    expect(hud().style.bottom).toBe('12px');
  });

  it('stops watching once disposed', async () => {
    mount();
    const host = hud();
    handle!.dispose();
    handle = null;
    put('18,600,400,150');
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 0));
    expect(host.isConnected).toBe(false);
    expect(host.style.bottom).toBe('12px');
  });
});
