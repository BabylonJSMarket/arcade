import { createStore, produce } from 'solid-js/store';
import type { JSX } from 'solid-js';

export interface PanelState {
  id: string;
  title: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  titleColor?: string;
  content: () => JSX.Element;
}

interface VizState {
  sceneName: string;
  panels: Record<string, PanelState>;
}

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
  'top-left': { x: 10, y: 10 },
  'top-right': { x: -10, y: 10 },
  'bottom-left': { x: 10, y: -10 },
  'bottom-right': { x: -10, y: -10 },
};

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 400;

const [state, setState] = createStore<VizState>({
  sceneName: 'default',
  panels: {},
});

function getStorageKey(id: string): string {
  return `viz-${state.sceneName}-${id}`;
}

function loadFromStorage(id: string): Partial<PanelState> | null {
  try {
    const saved = localStorage.getItem(getStorageKey(id));
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveToStorage(id: string, panel: PanelState): void {
  try {
    const { content, ...serializable } = panel;
    localStorage.setItem(getStorageKey(id), JSON.stringify(serializable));
  } catch {
    // Ignore storage errors
  }
}

export type PanelConfig = Omit<PanelState, 'visible' | 'x' | 'y' | 'width' | 'height'> & Partial<PanelState>;

export const vizStore = {
  get panels() {
    return state.panels;
  },

  get sceneName() {
    return state.sceneName;
  },

  setSceneName(name: string): void {
    setState('sceneName', name);
  },

  registerPanel(config: PanelConfig): void {
    const saved = loadFromStorage(config.id);
    const pos = DEFAULT_POSITIONS[config.position || 'top-right'];

    const panel: PanelState = {
      visible: false,
      x: pos.x,
      y: pos.y,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      ...config,
      ...saved,
      // Fall back only if neither config nor saved specified a position.
      position: saved?.position ?? config.position ?? 'top-right',
      // Always use the new content function
      content: config.content,
    };

    setState('panels', config.id, panel);
  },

  unregisterPanel(id: string): void {
    setState(
      'panels',
      produce((panels) => {
        delete panels[id];
      })
    );
  },

  isVisible(id: string): boolean {
    return state.panels[id]?.visible ?? false;
  },

  showPanel(id: string): void {
    if (!state.panels[id]) return;
    setState('panels', id, 'visible', true);
    saveToStorage(id, state.panels[id]);
  },

  hidePanel(id: string): void {
    if (!state.panels[id]) return;
    setState('panels', id, 'visible', false);
    saveToStorage(id, state.panels[id]);
  },

  togglePanel(id: string): void {
    if (!state.panels[id]) return;
    const newVisible = !state.panels[id].visible;
    setState('panels', id, 'visible', newVisible);
    saveToStorage(id, state.panels[id]);
  },

  updatePosition(id: string, x: number, y: number): void {
    if (!state.panels[id]) return;
    setState('panels', id, { x, y });
    saveToStorage(id, state.panels[id]);
  },

  updateSize(id: string, width: number, height: number): void {
    if (!state.panels[id]) return;
    setState('panels', id, { width, height });
    saveToStorage(id, state.panels[id]);
  },

  clear(): void {
    setState('panels', {});
  },
};
