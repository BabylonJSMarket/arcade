/**
 * ArcCamera.viz.tsx — runtime Camera Controls panel.
 *
 * A small on-screen panel (toggled by an activation key) that drives the live
 * ArcCamera via its component fields — the ArcCameraSystem is the authority
 * that pushes those fields to the renderer each frame, so the panel only edits
 * data:
 *   • Zoom    → ArcCameraComponent.distance (radius)
 *   • Pan X/Z → ArcCameraComponent.targetOffset (applied only when not following)
 *   • Follow  → ArcCameraComponent.follow (keep the target centred)
 *
 * Until the user touches a control the sliders mirror the live camera (so they
 * show pinball's auto-fit zoom, etc.); after that the panel owns the values and
 * they persist (localStorage, keyed by scene).
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { ArcCameraComponent } from './ArcCamera';
import { vizStore } from '../_shared/viz';
import { createStore } from 'solid-js/store';
import { CameraControlPanel, type CameraControlParams } from './ArcCamera.panel';

export const ArcCameraDebuggerEvents = {
  SHOWN: 'arccameradebugger.shown',
  HIDDEN: 'arccameradebugger.hidden',
} as const;

export interface ArcCameraDebuggerInput {
  /** Start visible? (default: false) */
  visible?: boolean;
  /** Keyboard key to toggle (default: ""—none) */
  activationKey?: string;
  /** Panel position (default: "top-right") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class ArcCameraDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: ArcCameraDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? '';
    this.position = data.position ?? 'top-right';
  }

  serialize(): ArcCameraDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

// ============================================
// Persistence (scene-keyed)
// ============================================

const STORAGE_KEY = 'camera-controls';

function loadParams(): Partial<CameraControlParams> | null {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${vizStore.sceneName}`);
    return saved ? (JSON.parse(saved) as Partial<CameraControlParams>) : null;
  } catch {
    return null;
  }
}

function saveParams(params: CameraControlParams): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${vizStore.sceneName}`, JSON.stringify(params));
  } catch {
    // ignore storage errors
  }
}

const DEFAULT_PARAMS: CameraControlParams = { zoom: 30, panX: 0, panZ: 0, follow: true };

const PANEL_ID = 'camera-controls';

export class ArcCameraDebuggerSystem extends System {
  protected query = { required: [ArcCameraDebuggerComponent] };
  private component: ArcCameraDebuggerComponent | null = null;

  private params: CameraControlParams = { ...DEFAULT_PARAMS };
  private setParams!: (key: keyof CameraControlParams, value: number | boolean) => void;
  // Until the user touches a control, mirror the live camera into the sliders
  // (shows the scene/auto-fit values). Once touched, the panel owns the values.
  private touched = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
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
    this.registerPanel();
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(ArcCameraDebuggerComponent);
    if (comp && !this.component) {
      this.component = comp;
      this.registerPanel();
    }
  }

  protected onEntityRemoved(entity: Entity): void {
    if (entity.get(ArcCameraDebuggerComponent) === this.component) {
      vizStore.unregisterPanel(PANEL_ID);
      this.component = null;
    }
  }

  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID);
  }

  private registerPanel(): void {
    if (!this.component) return;

    const saved = loadParams();
    if (saved) {
      this.params = { ...DEFAULT_PARAMS, ...saved };
      this.touched = true; // restore tuned values over the scene defaults
    }
    const [params, setParams] = createStore<CameraControlParams>({ ...this.params });
    this.setParams = (key, value) => setParams(key as keyof CameraControlParams, value as never);

    const commit = () => {
      this.touched = true;
      saveParams(this.params);
      this.applyToCameras();
    };

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Camera',
      position: this.component.position,
      titleColor: '#66ccff',
      activationKey: this.component.activationKey,
      visible: this.component.visible,
      content: () => (
        <CameraControlPanel
          params={params}
          setZoom={(v) => { this.params.zoom = v; setParams('zoom', v); commit(); }}
          setPanX={(v) => { this.params.panX = v; setParams('panX', v); commit(); }}
          setPanZ={(v) => { this.params.panZ = v; setParams('panZ', v); commit(); }}
          setFollow={(v) => {
            this.params.follow = v;
            setParams('follow', v);
            if (v) { this.params.panX = 0; this.params.panZ = 0; setParams('panX', 0); setParams('panZ', 0); }
            commit();
          }}
          onCenter={() => {
            this.params.panX = 0; this.params.panZ = 0;
            setParams('panX', 0); setParams('panZ', 0);
            commit();
          }}
        />
      ),
    });
  }

  /** First ArcCamera in the world (the one the panel reads/seeds from). */
  private firstArcCamera(): ArcCameraComponent | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const arc = entity.get(ArcCameraComponent);
      if (arc) return arc;
    }
    return null;
  }

  /** Push the panel's values onto every ArcCamera (the System applies them). */
  private applyToCameras(): void {
    if (!this.world) return;
    for (const entity of this.world.getEntities()) {
      const arc = entity.get(ArcCameraComponent);
      if (!arc) continue;
      arc.distance = this.params.zoom;
      arc.follow = this.params.follow;
      arc.targetOffset = [this.params.panX, arc.targetOffset[1], this.params.panZ];
    }
  }

  /** Mirror the live camera into the sliders (used before the user takes over). */
  private syncFromCamera(): void {
    const arc = this.firstArcCamera();
    if (!arc) return;
    this.params.zoom = arc.distance;
    this.params.follow = arc.follow;
    this.params.panX = arc.targetOffset[0];
    this.params.panZ = arc.targetOffset[2];
    this.setParams('zoom', arc.distance);
    this.setParams('follow', arc.follow);
    this.setParams('panX', arc.targetOffset[0]);
    this.setParams('panZ', arc.targetOffset[2]);
  }

  protected onUpdate(_deltaTime: number): void {
    if (!this.component) return;

    const panelVisible = vizStore.isVisible(PANEL_ID);
    if (panelVisible !== this.component.visible) {
      this.component.visible = panelVisible;
    }

    if (this.touched) {
      this.applyToCameras();
    } else {
      this.syncFromCamera();
    }
  }
}
