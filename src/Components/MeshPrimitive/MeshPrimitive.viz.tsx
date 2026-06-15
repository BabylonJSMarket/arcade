/**
 * MeshPrimitive.viz.ts - Visual Debugger for MeshPrimitive
 *
 * This module provides a real-time visual debugger that displays mesh primitive
 * parameters and allows live adjustment of dimensions, segments, and visibility.
 *
 * Features:
 * - Slider controls for all primitive parameters
 * - Live updates to all mesh primitives in scene
 * - Visibility control
 * - Reset to defaults button
 * - Keyboard shortcut (Digit9 by default) to toggle
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
// Adapter-driven: no Babylon imports needed in the viz wrapper.
import { MeshPrimitiveComponent } from './MeshPrimitive';
import { vizStore } from '@babylonjsmarket/viz';
import { createStore } from 'solid-js/store';
import { MeshPrimitivePanel, MeshPrimitiveParams } from './MeshPrimitive.panel';

// ============================================
// Events emitted by MeshPrimitiveDebugger
// ============================================

/**
 * Events emitted by the debugger itself.
 */
export const MeshPrimitiveDebuggerEvents = {
  SHOWN: 'meshprimitivedebugger.shown',
  HIDDEN: 'meshprimitivedebugger.hidden',
} as const;

// ============================================
// Input interface
// ============================================

/**
 * Configuration options for the MeshPrimitive debugger.
 */
export interface MeshPrimitiveDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: "Digit9") */
  activationKey?: string;
  /** Panel position (default: "top-left") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================
// MeshPrimitiveDebuggerComponent
// ============================================

/**
 * Component that stores the debugger's state and configuration.
 *
 * Add this to an entity to enable the MeshPrimitive debugger panel.
 */
export class MeshPrimitiveDebuggerComponent extends Component {
  /** Whether the debug panel is currently visible */
  visible: boolean;

  /** Keyboard key to toggle visibility */
  activationKey: string;

  /** Panel position */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: MeshPrimitiveDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? '';
    this.position = data.position ?? 'top-left';
  }

  /** Serialize configuration for saving */
  serialize(): MeshPrimitiveDebuggerInput {
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

const STORAGE_KEY = 'mesh-primitive-debugger-params';

function loadParamsFromStorage(): Partial<MeshPrimitiveParams> {
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

function saveParamToStorage(params: MeshPrimitiveParams): void {
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

const DEFAULT_PARAMS: MeshPrimitiveParams = {
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  visibility: 1,
};

// ============================================
// MeshPrimitiveDebuggerSystem
// ============================================

const PANEL_ID = 'mesh-primitive-debugger';

/**
 * System that manages the MeshPrimitive debugger UI.
 *
 * This system:
 * - Registers a panel with the VizRoot
 * - Provides slider controls for primitive parameters
 * - Updates all mesh primitives in the scene
 * - Handles keyboard shortcuts
 */
export class MeshPrimitiveDebuggerSystem extends System {
  private component: MeshPrimitiveDebuggerComponent | null = null;

  // Local params reference for applying to meshes
  private params: MeshPrimitiveParams = { ...DEFAULT_PARAMS };
  protected query = { required: [MeshPrimitiveDebuggerComponent] };

  constructor(eventBus: EventBus) {
    super(eventBus);
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(MeshPrimitiveDebuggerComponent);
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
    const [params, setParams] = createStore<MeshPrimitiveParams>({ ...this.params });

    // Register panel with VizRoot
    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Mesh Primitive Controls',
      position: this.component.position,
      titleColor: '#9f4aff',
      activationKey: this.component.activationKey,
      visible: this.component.visible,
      content: () => (
        <MeshPrimitivePanel
          params={params}
          setParam={(key, value) => {
            setParams(key, value);
            this.params[key] = value;
            saveParamToStorage(this.params);
          }}
          onReset={() => {
            const defaults = { ...DEFAULT_PARAMS };
            Object.entries(defaults).forEach(([key, value]) => {
              setParams(key as keyof MeshPrimitiveParams, value);
            });
            this.params = { ...defaults };
            saveParamToStorage(this.params);
          }}
        />
      ),
    });
  }

  protected onEntityAdded(entity: any): void {
    const comp = entity.get(MeshPrimitiveDebuggerComponent);
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

    // Apply params to all mesh primitive components in the scene. We go
    // through the renderer adapter, not the raw mesh — the component no
    // longer exposes a .mesh field (that was the pre-adapter shape). Scale
    // isn't on the adapter interface yet; once it is, add setMeshScale.
    if (panelVisible && this.world.renderer) {
      const r = this.world.renderer;
      for (const entity of this.world.getEntities()) {
        const primComp = entity.get(MeshPrimitiveComponent);
        if (primComp?.handle) {
          r.setMeshVisible(primComp.handle, this.params.visibility > 0.5);
        }
      }
    }
  }

  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID);
  }

  protected onEntityRemoved(entity: any): void {
    const comp = entity.get(MeshPrimitiveDebuggerComponent);
    if (comp === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }
}
