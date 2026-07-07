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

/** Pin a controls HUD (key-cap + label rows) bottom-left. No-op if no hints. */
export function mountControlsHud(hints: ControlHint[]): ControlsHudHandle {
  if (!hints.length || typeof document === 'undefined') return { dispose() {} };

  const host = document.createElement('div');
  host.setAttribute('data-controls-hud', '');
  host.style.cssText = [
    'position:fixed',
    'left:12px',
    'bottom:12px',
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
  return {
    dispose() {
      host.remove();
    },
  };
}
