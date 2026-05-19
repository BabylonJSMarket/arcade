/**
 * ArcCamera.viz.tsx - Visual Debugger for ArcCamera
 *
 * This module provides a real-time visual debugger that displays arc camera
 * parameters and allows live adjustment of angles, distances, and sensitivity.
 *
 * Features:
 * - Slider controls for all camera parameters
 * - Live updates to all arc cameras in scene
 * - Reset to defaults button
 * - Keyboard shortcut (Digit8 by default) to toggle
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
import { ArcCameraComponent } from './ArcCamera';
import { vizStore } from '../_shared/viz';
import { createStore } from 'solid-js/store';
import { ArcCameraPanel, ArcCameraParams } from './ArcCamera.panel';

// ============================================
// Events emitted by ArcCameraDebugger
// ============================================

/**
 * Events emitted by the debugger itself.
 */
export const ArcCameraDebuggerEvents = {
  SHOWN: 'arccameradebugger.shown',
  HIDDEN: 'arccameradebugger.hidden',
} as const;

// ============================================
// Input interface
// ============================================

/**
 * Configuration options for the ArcCamera debugger.
 */
export interface ArcCameraDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: "Digit8") */
  activationKey?: string;
  /** Panel position (default: "top-right") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================
// ArcCameraDebuggerComponent
// ============================================

/**
 * Component that stores the debugger's state and configuration.
 *
 * Add this to an entity to enable the ArcCamera debugger panel.
 */
export class ArcCameraDebuggerComponent extends Component {
  /** Whether the debug panel is currently visible */
  visible: boolean;

  /** Keyboard key to toggle visibility */
  activationKey: string;

  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: ArcCameraDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit8';
    this.position = data.position ?? 'top-right';
  }

  /** Serialize configuration for saving */
  serialize(): ArcCameraDebuggerInput {
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

const STORAGE_KEY = 'arc-camera-debugger-params';

function loadParamsFromStorage(): Partial<ArcCameraParams> {
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

function saveParamToStorage(params: ArcCameraParams): void {
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

const DEFAULT_PARAMS: ArcCameraParams = {
  distance: 15,
  minDistance: 5,
  maxDistance: 50,
  alpha: Math.PI / 2,
  beta: Math.PI / 3,
  minBeta: 0.1,
  maxBeta: Math.PI / 2 - 0.1,
  inertia: 0.9,
  wheelPrecision: 50,
  angularSensibility: 1000,
  speed: 1,
  autoRotateSpeed: 0.5,
};

// ============================================
// ArcCameraDebuggerSystem
// ============================================

const PANEL_ID = 'arc-camera-debugger';

/**
 * System that manages the ArcCamera debugger UI.
 *
 * This system:
 * - Registers a panel with the VizRoot
 * - Provides slider controls for camera parameters
 * - Updates all arc cameras in the scene
 * - Handles keyboard shortcuts
 */
export class ArcCameraDebuggerSystem extends System {
  private component: ArcCameraDebuggerComponent | null = null;

  // Keyboard handler
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Solid store for reactive params
  private paramsStore: ReturnType<typeof createStore<ArcCameraParams>> | null = null;

  // Local params reference for applying to cameras
  private params: ArcCameraParams = { ...DEFAULT_PARAMS };

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ArcCameraDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(ArcCameraDebuggerComponent);
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
    const [params, setParams] = createStore<ArcCameraParams>({ ...this.params });
    this.paramsStore = [params, setParams];

    // Register panel with VizRoot
    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Arc Camera Controls',
      position: this.component.position,
      titleColor: '#66ccff',
      content: () => (
        <ArcCameraPanel
          params={params}
          setParam={(key, value) => {
            setParams(key, value);
            this.params[key] = value;
            saveParamToStorage(this.params);
          }}
          onReset={() => {
            const defaults = { ...DEFAULT_PARAMS };
            Object.entries(defaults).forEach(([key, value]) => {
              setParams(key as keyof ArcCameraParams, value);
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
      this.eventBus.emit(ArcCameraDebuggerEvents.SHOWN, {});
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
          this.eventBus.emit(ArcCameraDebuggerEvents.SHOWN, {});
        } else {
          this.eventBus.emit(ArcCameraDebuggerEvents.HIDDEN, {});
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected onEntityAdded(entity: any): void {
    const comp = entity.get(ArcCameraDebuggerComponent);
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

    // Apply params to all arc camera components. The ArcCameraSystem detects
    // angle/radius changes via the renderer adapter and emits events. For live
    // limit/inertia changes, the System re-seeds the camera (not yet wired up).
    if (panelVisible) {
      for (const entity of this.world.getEntities()) {
        const arcCamera = entity.get(ArcCameraComponent);
        if (!arcCamera) continue;
        arcCamera.distance = this.params.distance;
        arcCamera.minDistance = this.params.minDistance;
        arcCamera.maxDistance = this.params.maxDistance;
        arcCamera.alpha = this.params.alpha;
        arcCamera.beta = this.params.beta;
        arcCamera.minBeta = this.params.minBeta;
        arcCamera.maxBeta = this.params.maxBeta;
        arcCamera.inertia = this.params.inertia;
        arcCamera.wheelPrecision = this.params.wheelPrecision;
        arcCamera.angularSensibility = this.params.angularSensibility;
        arcCamera.speed = this.params.speed;
        arcCamera.autoRotateSpeed = this.params.autoRotateSpeed;
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
    const comp = entity.get(ArcCameraDebuggerComponent);
    if (comp === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }
}
