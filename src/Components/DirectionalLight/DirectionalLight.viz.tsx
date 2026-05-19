/**
 * DirectionalLight.viz.tsx - Visual Debugger for DirectionalLight
 *
 * This module provides a real-time visual debugger that displays directional light
 * parameters and allows live adjustment of direction, intensity, and colors.
 *
 * Features:
 * - Slider controls for direction, position, intensity
 * - Color pickers for diffuse and specular
 * - Live updates to all directional lights in scene
 * - Visualization of light direction with debug arrows
 * - Reset to defaults button
 * - Keyboard shortcut (Digit8 by default) to toggle
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
// Adapter-driven: no Babylon imports needed in the viz wrapper.
import { DirectionalLightComponent } from './DirectionalLight';
import { vizStore } from '../_shared/viz';
import { createStore } from 'solid-js/store';
import { DirectionalLightPanel, DirectionalLightParams } from './DirectionalLight.panel';

// ============================================
// Events emitted by DirectionalLightDebugger
// ============================================

/**
 * Events emitted by the debugger itself.
 */
export const DirectionalLightDebuggerEvents = {
  SHOWN: 'directionallightdebugger.shown',
  HIDDEN: 'directionallightdebugger.hidden',
} as const;

// ============================================
// Input interface
// ============================================

/**
 * Configuration options for the DirectionalLight debugger.
 */
export interface DirectionalLightDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: "Digit8") */
  activationKey?: string;
  /** Panel position (default: "top-right") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Show direction arrows in scene (default: true) */
  showArrows?: boolean;
}

// ============================================
// DirectionalLightDebuggerComponent
// ============================================

/**
 * Component that stores the debugger's state and configuration.
 *
 * Add this to an entity to enable the DirectionalLight debugger panel.
 */
export class DirectionalLightDebuggerComponent extends Component {
  /** Whether the debug panel is currently visible */
  visible: boolean;

  /** Keyboard key to toggle visibility */
  activationKey: string;

  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /** Show direction arrows in scene */
  showArrows: boolean;

  constructor(data: DirectionalLightDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit8';
    this.position = data.position ?? 'top-right';
    this.showArrows = data.showArrows ?? true;
  }

  /** Serialize configuration for saving */
  serialize(): DirectionalLightDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
      showArrows: this.showArrows,
    };
  }
}

// ============================================
// Storage helpers for debugger params
// ============================================

const STORAGE_KEY = 'directional-light-debugger-params';

function loadParamsFromStorage(): Partial<DirectionalLightParams> {
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

function saveParamToStorage(params: DirectionalLightParams): void {
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

const DEFAULT_PARAMS: DirectionalLightParams = {
  dirX: -1,
  dirY: -3,
  dirZ: -1,
  posX: 15,
  posY: 30,
  posZ: 15,
  intensity: 0.8,
  diffuseR: 1,
  diffuseG: 1,
  diffuseB: 1,
  specularR: 1,
  specularG: 1,
  specularB: 1,
};

// ============================================
// DirectionalLightDebuggerSystem
// ============================================

const PANEL_ID = 'directional-light-debugger';

/**
 * System that manages the DirectionalLight debugger UI.
 *
 * This system:
 * - Registers a panel with the VizRoot
 * - Provides slider controls for light parameters
 * - Updates all directional lights in the scene
 * - Visualizes light direction with arrows
 * - Handles keyboard shortcuts
 */
export class DirectionalLightDebuggerSystem extends System {
  private component: DirectionalLightDebuggerComponent | null = null;

  // Keyboard handler
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Solid store for reactive params
  private paramsStore: ReturnType<typeof createStore<DirectionalLightParams>> | null = null;

  // Local params reference for applying to lights
  private params: DirectionalLightParams = { ...DEFAULT_PARAMS };

  // Reused tuple buffer for normalized direction (avoid per-frame allocation).
  private _tempDir: [number, number, number] = [0, -1, 0];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [DirectionalLightDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(DirectionalLightDebuggerComponent);
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
    const [params, setParams] = createStore<DirectionalLightParams>({ ...this.params });
    this.paramsStore = [params, setParams];

    // Register panel with VizRoot
    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Directional Light Controls',
      position: this.component.position,
      titleColor: '#ffa500',
      content: () => (
        <DirectionalLightPanel
          params={params}
          setParam={(key, value) => {
            setParams(key, value);
            this.params[key] = value;
            saveParamToStorage(this.params);
          }}
          onReset={() => {
            const defaults = { ...DEFAULT_PARAMS };
            Object.entries(defaults).forEach(([key, value]) => {
              setParams(key as keyof DirectionalLightParams, value);
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
      this.eventBus.emit(DirectionalLightDebuggerEvents.SHOWN, {});
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
          this.eventBus.emit(DirectionalLightDebuggerEvents.SHOWN, {});
        } else {
          this.eventBus.emit(DirectionalLightDebuggerEvents.HIDDEN, {});
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected onEntityAdded(entity: any): void {
    const comp = entity.get(DirectionalLightDebuggerComponent);
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

    // Apply params to all directional light components in the scene. The
    // DirectionalLightSystem detects field changes and forwards them to the
    // renderer adapter.
    if (panelVisible) {
      const len = Math.hypot(this.params.dirX, this.params.dirY, this.params.dirZ) || 1;
      this._tempDir[0] = this.params.dirX / len;
      this._tempDir[1] = this.params.dirY / len;
      this._tempDir[2] = this.params.dirZ / len;

      for (const entity of this.world.getEntities()) {
        const lightComp = entity.get(DirectionalLightComponent);
        if (!lightComp) continue;
        lightComp.direction[0] = this._tempDir[0];
        lightComp.direction[1] = this._tempDir[1];
        lightComp.direction[2] = this._tempDir[2];
        lightComp.position[0] = this.params.posX;
        lightComp.position[1] = this.params.posY;
        lightComp.position[2] = this.params.posZ;
        lightComp.intensity = this.params.intensity;
        lightComp.diffuse[0] = this.params.diffuseR;
        lightComp.diffuse[1] = this.params.diffuseG;
        lightComp.diffuse[2] = this.params.diffuseB;
        lightComp.specular[0] = this.params.specularR;
        lightComp.specular[1] = this.params.specularG;
        lightComp.specular[2] = this.params.specularB;
      }
    }
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
    const comp = entity.get(DirectionalLightDebuggerComponent);
    if (comp === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }
}
