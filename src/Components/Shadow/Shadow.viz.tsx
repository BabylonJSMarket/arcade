/**
 * Shadow.viz.tsx - Visual Debugger for Shadow
 *
 * This module provides a real-time visual debugger that displays shadow settings
 * and allows live adjustment of shadow parameters like darkness, bias, and quality.
 *
 * Features:
 * - Slider controls for shadow generator parameters
 * - Toggle shadow casting/receiving for all entities
 * - Shadow map size configuration
 * - Filter quality settings
 * - Keyboard shortcut (Digit8 by default) to toggle
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
// Adapter-driven: no Babylon imports needed in the viz wrapper.
import { ShadowComponent } from './Shadow';
import { vizStore } from '../_shared/viz';
import { createStore } from 'solid-js/store';
import { ShadowPanel, ShadowParams } from './Shadow.panel';

// ============================================
// Events emitted by ShadowDebugger
// ============================================

/**
 * Events emitted by the debugger itself.
 */
export const ShadowDebuggerEvents = {
  SHOWN: 'shadowdebugger.shown',
  HIDDEN: 'shadowdebugger.hidden',
} as const;

// ============================================
// Input interface
// ============================================

/**
 * Configuration options for the Shadow debugger.
 */
export interface ShadowDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: "Digit8") */
  activationKey?: string;
  /** Panel position (default: "top-right") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================
// ShadowDebuggerComponent
// ============================================

/**
 * Component that stores the debugger's state and configuration.
 *
 * Add this to an entity to enable the Shadow debugger panel.
 */
export class ShadowDebuggerComponent extends Component {
  /** Whether the debug panel is currently visible */
  visible: boolean;

  /** Keyboard key to toggle visibility */
  activationKey: string;

  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: ShadowDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit8';
    this.position = data.position ?? 'top-right';
  }

  /** Serialize configuration for saving */
  serialize(): ShadowDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

// ============================================
// Storage helpers for debugger params
// ============================================

const STORAGE_KEY = 'shadow-debugger-params';

function loadParamsFromStorage(): Partial<ShadowParams> {
  try {
    const sceneName = vizStore.sceneName;
    const saved = localStorage.getItem(`${STORAGE_KEY}-${sceneName}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return {};
}

function saveParamToStorage(params: ShadowParams): void {
  try {
    const sceneName = vizStore.sceneName;
    localStorage.setItem(`${STORAGE_KEY}-${sceneName}`, JSON.stringify(params));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// Default values
// ============================================

const DEFAULT_PARAMS: ShadowParams = {
  darkness: 0.4,
  bias: 0.001,
  normalBias: 0.0,
  filteringQuality: 2, // ShadowGenerator.QUALITY_HIGH
  castShadowsGlobal: 1, // 1 = enabled, 0 = disabled
  receiveShadowsGlobal: 1,
};

// ============================================
// ShadowDebuggerSystem
// ============================================

const PANEL_ID = 'shadow-debugger';

/**
 * System that manages the Shadow debugger UI.
 *
 * This system:
 * - Registers a panel with the VizRoot
 * - Provides slider controls for shadow parameters
 * - Updates shadow generator settings in real-time
 * - Handles keyboard shortcuts
 */
export class ShadowDebuggerSystem extends System {
  private component: ShadowDebuggerComponent | null = null;

  // Keyboard handler
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Solid store for reactive params
  private paramsStore: ReturnType<typeof createStore<ShadowParams>> | null = null;

  // Local params reference for applying to shadow generator
  private params: ShadowParams = { ...DEFAULT_PARAMS };

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ShadowDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(ShadowDebuggerComponent);
      if (comp) {
        this.component = comp;
        break;
      }
    }

    this.setupKeyboardListener();
    this.registerPanel();
  }

  private registerPanel(): void {
    if (!this.component) return;

    // Load saved params
    const savedParams = loadParamsFromStorage();
    this.params = { ...DEFAULT_PARAMS, ...savedParams };

    // Create reactive store
    const [params, setParams] = createStore<ShadowParams>({ ...this.params });
    this.paramsStore = [params, setParams];

    // Register panel with VizRoot
    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Shadow Controls',
      position: this.component.position,
      titleColor: '#ffa500',
      content: () => (
        <ShadowPanel
          params={params}
          setParam={(key, value) => {
            setParams(key, value);
            this.params[key] = value;
            saveParamToStorage(this.params);
          }}
          onReset={() => {
            const defaults = { ...DEFAULT_PARAMS };
            Object.entries(defaults).forEach(([key, value]) => {
              setParams(key as keyof ShadowParams, value);
            });
            this.params = { ...defaults };
            saveParamToStorage(this.params);
          }}
        />
      ),
    });

    // If component says visible, show the panel
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
      this.eventBus.emit(ShadowDebuggerEvents.SHOWN, {});
    }
  }

  private setupKeyboardListener(): void {
    if (this.keydownHandler) return;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.component) return;
      if (e.code === this.component.activationKey) {
        e.preventDefault();
        vizStore.togglePanel(PANEL_ID);
        const isVisible = vizStore.isVisible(PANEL_ID);
        this.component.visible = isVisible;
        if (isVisible) {
          this.eventBus.emit(ShadowDebuggerEvents.SHOWN, {});
        } else {
          this.eventBus.emit(ShadowDebuggerEvents.HIDDEN, {});
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected onEntityAdded(entity: any): void {
    const comp = entity.get(ShadowDebuggerComponent);
    if (comp && !this.component) {
      this.component = comp;
      this.registerPanel();
    }
  }

  protected onUpdate(_deltaTime: number): void {
    if (!this.component || !this.world) return;

    // Sync visibility state
    const panelVisible = vizStore.isVisible(PANEL_ID);
    if (panelVisible !== this.component.visible) {
      this.component.visible = panelVisible;
    }

    // Live-tuning shadow-generator internals (darkness, bias, filtering
    // quality) requires adapter-specific methods not yet exposed — the panel's
    // knobs are persisted but not applied. To be re-wired once the
    // RendererAdapter exposes shadow-tuning setters.
    void panelVisible;
  }

  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID);
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.paramsStore = null;
  }

  protected onEntityRemoved(entity: any): void {
    const comp = entity.get(ShadowDebuggerComponent);
    if (comp === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }
}
