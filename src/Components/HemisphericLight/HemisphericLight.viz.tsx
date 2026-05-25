/**
 * HemisphericLight.viz.tsx - Visual Debugger for HemisphericLight
 *
 * This module provides a real-time visual debugger that displays hemispheric light
 * parameters and allows live adjustment of intensity, colors, and direction.
 *
 * Features:
 * - Slider controls for intensity
 * - Color pickers for diffuse, ground, and specular colors
 * - Direction vector controls
 * - Live updates to all hemispheric lights in scene
 * - Reset to defaults button
 * - Keyboard shortcut (Digit7 by default) to toggle
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
import { HemisphericLightComponent } from './HemisphericLight';
import { vizStore } from '../_shared/viz';
import { createStore } from 'solid-js/store';
import { HemisphericLightPanel, HemisphericLightParams } from './HemisphericLight.panel';

// ============================================
// Events emitted by HemisphericLightDebugger
// ============================================

/**
 * Events emitted by the debugger itself.
 */
export const HemisphericLightDebuggerEvents = {
  SHOWN: 'hemisphericlightdebugger.shown',
  HIDDEN: 'hemisphericlightdebugger.hidden',
} as const;

// ============================================
// Input interface
// ============================================

/**
 * Configuration options for the HemisphericLight debugger.
 */
export interface HemisphericLightDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: "Digit7") */
  activationKey?: string;
  /** Panel position (default: "top-left") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================
// HemisphericLightDebuggerComponent
// ============================================

/**
 * Component that stores the debugger's state and configuration.
 *
 * Add this to an entity to enable the HemisphericLight debugger panel.
 */
export class HemisphericLightDebuggerComponent extends Component {
  /** Whether the debug panel is currently visible */
  visible: boolean;

  /** Keyboard key to toggle visibility */
  activationKey: string;

  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: HemisphericLightDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? '';
    this.position = data.position ?? 'top-left';
  }

  /** Serialize configuration for saving */
  serialize(): HemisphericLightDebuggerInput {
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

const STORAGE_KEY = 'hemispheric-light-debugger-params';

function loadParamsFromStorage(): Partial<HemisphericLightParams> {
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

function saveParamToStorage(params: HemisphericLightParams): void {
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

const DEFAULT_PARAMS: HemisphericLightParams = {
  intensity: 0.3,
  directionX: 0,
  directionY: 1,
  directionZ: 0,
  diffuseR: 1,
  diffuseG: 1,
  diffuseB: 1,
  groundR: 0.2,
  groundG: 0.2,
  groundB: 0.2,
  specularR: 0,
  specularG: 0,
  specularB: 0,
};

// ============================================
// HemisphericLightDebuggerSystem
// ============================================

const PANEL_ID = 'hemispheric-light-debugger';

/**
 * System that manages the HemisphericLight debugger UI.
 *
 * This system:
 * - Registers a panel with the VizRoot
 * - Provides slider controls for intensity and direction
 * - Provides color controls for diffuse, ground, and specular
 * - Updates all hemispheric lights in the scene
 * - Handles keyboard shortcuts
 */
export class HemisphericLightDebuggerSystem extends System {
  protected query = { required: [HemisphericLightDebuggerComponent] };
  private component: HemisphericLightDebuggerComponent | null = null;

  // Local params reference for applying to lights
  private params: HemisphericLightParams = { ...DEFAULT_PARAMS };

  constructor(eventBus: EventBus) {
    super(eventBus);
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(HemisphericLightDebuggerComponent);
      if (comp) {
        this.component = comp;
        break;
      }
    }

    this.registerPanel();
  }

  private registerPanel(): void {
    if (!this.component) return;

    // Load saved params
    const savedParams = loadParamsFromStorage();
    this.params = { ...DEFAULT_PARAMS, ...savedParams };

    // Create reactive store
    const [params, setParams] = createStore<HemisphericLightParams>({ ...this.params });

    // Register panel with VizRoot
    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Hemispheric Light Controls',
      activationKey: this.component.activationKey,
      position: this.component.position,
      titleColor: '#ffcc00',
      visible: this.component.visible,
      content: () => (
        <HemisphericLightPanel
          params={params}
          setParam={(key, value) => {
            setParams(key, value);
            this.params[key] = value;
            saveParamToStorage(this.params);
          }}
          onReset={() => {
            const defaults = { ...DEFAULT_PARAMS };
            Object.entries(defaults).forEach(([key, value]) => {
              setParams(key as keyof HemisphericLightParams, value);
            });
            this.params = { ...defaults };
            saveParamToStorage(this.params);
          }}
        />
      ),
    });
  }

  protected onEntityAdded(entity: any): void {
    const comp = entity.get(HemisphericLightDebuggerComponent);
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

    // Apply params to all hemispheric light components in the scene. The
    // HemisphericLightSystem detects intensity changes and forwards them to
    // the renderer adapter. Colors/direction mutate the component fields;
    // live visual update for those requires a re-create (planned).
    if (panelVisible) {
      for (const entity of this.world.getEntities()) {
        const lightComp = entity.get(HemisphericLightComponent);
        if (!lightComp) continue;
        lightComp.intensity = this.params.intensity;
        const len = Math.hypot(this.params.directionX, this.params.directionY, this.params.directionZ) || 1;
        lightComp.direction[0] = this.params.directionX / len;
        lightComp.direction[1] = this.params.directionY / len;
        lightComp.direction[2] = this.params.directionZ / len;
        lightComp.diffuse[0] = this.params.diffuseR;
        lightComp.diffuse[1] = this.params.diffuseG;
        lightComp.diffuse[2] = this.params.diffuseB;
        lightComp.groundColor[0] = this.params.groundR;
        lightComp.groundColor[1] = this.params.groundG;
        lightComp.groundColor[2] = this.params.groundB;
        lightComp.specular[0] = this.params.specularR;
        lightComp.specular[1] = this.params.specularG;
        lightComp.specular[2] = this.params.specularB;
      }
    }
  }

  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID);
  }

  protected onEntityRemoved(entity: any): void {
    const comp = entity.get(HemisphericLightDebuggerComponent);
    if (comp === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }
}
