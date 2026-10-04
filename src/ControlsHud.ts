/**
 * ControlsHud — a tiny always-on key-hint overlay pinned bottom-left.
 *
 * Like the FPS overlay, it lives outside the vizStore panel system: a controls
 * reference should just sit in a corner, not be a draggable/closable panel.
 * Plain DOM (no Solid) — the hints are static once mounted.
 *
 * Drive it from a scene's `controls` array, or parse them out of a `sceneTitle`
 * that already lists them ("Walk (WASD), run (Shift), …") via
 * {@link hintsFromSceneTitle}.
 *
 * It is for players, so it ships in a production build. That is why it is
 * exported from the package root as well as from `@babylonjsmarket/arcade/viz`:
 * the viz barrel drags Solid and the debug panels in with it, and the scaffold
 * only imports that in dev.
 */

export interface ControlHint {
  /** What to press, shown as a key-cap. e.g. 'WASD', 'Space', 'Alt'. */
  key: string;
  /** What it does. e.g. 'Move', 'Jump', 'Strafe'. */
  label: string;
}

/**
 * Parse "verb (KEY)" pairs out of a scene title into key-cap hints:
 * "Walk (WASD), run (Shift), strafe (hold Alt), fire a clip (panel 5)" →
 * [{key:'WASD',label:'Walk'}, {key:'Shift',label:'Run'}, {key:'Alt',label:'Strafe'}, …].
 * A leading hold/press/panel/key word inside the parens is dropped.
 */
export function hintsFromSceneTitle(title: string | undefined): ControlHint[] {
  if (!title) return [];
  const out: ControlHint[] = [];
  for (const m of title.matchAll(/([A-Za-z][\w-]*)\s*\(([^)]+)\)/g)) {
    const label = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const key = m[2].replace(/^(hold|press|panel|key)\s+/i, '').trim();
    if (key) out.push({ key, label });
  }
  return out;
}

export interface ControlsHudHandle {
  dispose(): void;
}

/** Gap to the screen edge, and to a HUD panel the box moves above. */
const MARGIN = 12;

/**
 * Anything at least this share of the screen wide or tall is a layer (a HUD
 * root that spans the screen, a full-width row), not a panel. The panels sit
 * inside it, and measuring the layer itself would push the box off the top.
 */
const LAYER_SHARE = 0.9;

/**
 * Move the box up past anything else drawn in its corner.
 *
 * A game with a HUD of its own often puts something bottom-left too (Space
 * Golf's TOP / SIDE / RESTART panel, for one), and a fixed box on top of it
 * hides those buttons. Nothing tells us where a game's HUD sits, so look:
 * every visible element overlapping the box lifts it to just above that
 * element. If that leaves no room on screen, hide the box: the game's own HUD
 * matters more than a key reminder. With nothing in the corner, nothing moves.
 */
function stepAsideFromOtherHuds(host: HTMLElement): void {
  host.style.bottom = `${MARGIN}px`;
  host.style.visibility = '';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Each lift can land the box on something higher up, so measure again until
  // it sits clear. A handful of passes covers any real stack of panels.
  for (let pass = 0; pass < 8; pass++) {
    const box = host.getBoundingClientRect();
    let top = Infinity;
    for (const el of document.body.querySelectorAll('*')) {
      if (host.contains(el) || el instanceof HTMLCanvasElement) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width >= vw * LAYER_SHARE || r.height >= vh * LAYER_SHARE) continue;
      if (r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue;
      // Faded-out banners and hidden toasts still have a box; they are not in the way.
      if (
        typeof el.checkVisibility === 'function' &&
        !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      ) {
        continue;
      }
      top = Math.min(top, r.top);
    }
    if (top === Infinity) return;
    const bottom = vh - top + MARGIN;
    if (bottom + box.height > vh - MARGIN) {
      host.style.visibility = 'hidden';
      return;
    }
    host.style.bottom = `${bottom}px`;
  }
}

/**
 * Pin a controls HUD (key-cap + label rows) bottom-left, clear of anything
 * else already there (see {@link stepAsideFromOtherHuds}). No-op if no hints.
 */
export function mountControlsHud(hints: ControlHint[]): ControlsHudHandle {
  if (!hints.length || typeof document === 'undefined') return { dispose() {} };

  const host = document.createElement('div');
  host.setAttribute('data-controls-hud', '');
  host.style.cssText = [
    'position:fixed',
    'left:12px',
    `bottom:${MARGIN}px`,
    'z-index:9998',
    'display:flex',
    'flex-direction:column',
    'gap:5px',
    'padding:9px 11px',
    'border-radius:9px',
    'background:rgba(12,14,20,0.72)',
    'backdrop-filter:blur(6px)',
    '-webkit-backdrop-filter:blur(6px)',
    'font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace',
    'color:#c8d0e0',
    'pointer-events:none',
    'user-select:none',
  ].join(';');

  for (const h of hints) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px';

    const cap = document.createElement('span');
    cap.textContent = h.key;
    cap.style.cssText = [
      'min-width:38px',
      'text-align:center',
      'padding:2px 7px',
      'border-radius:5px',
      'background:rgba(255,255,255,0.13)',
      'box-shadow:inset 0 -1px 0 rgba(0,0,0,0.35)',
      'color:#fff',
      'font-weight:600',
      'white-space:nowrap',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = h.label;

    row.append(cap, label);
    host.append(row);
  }

  document.body.appendChild(host);

  // Place it now, and again whenever the screen or the page's top-level
  // overlays change: a game HUD mounted after this one, or a window resize
  // that moves the game's panels, would otherwise end up underneath it.
  const place = () => stepAsideFromOtherHuds(host);
  place();
  window.addEventListener('resize', place);
  const observer = new MutationObserver(place);
  observer.observe(document.body, { childList: true });

  return {
    dispose() {
      window.removeEventListener('resize', place);
      observer.disconnect();
      host.remove();
    },
  };
}
