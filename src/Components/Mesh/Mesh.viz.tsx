/**
 * Mesh.viz.tsx — ECS wrapper that registers the renderer-free Panel with
 * vizStore. The Panel lives in Mesh.panel.tsx and is what both renderers
 * mount — this wrapper exists to wire the panel's callbacks through the
 * EventBus.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { MeshPanel } from './Mesh.panel';
import {
  MeshComponent,
  MeshInputEvents,
} from './Mesh';
import type { MeshInstance } from './Mesh.core';

export interface MeshDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Entity id of the Mesh target the panel controls. */
  targetEntityId?: string;
}

export class MeshDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  targetEntityId: string | null;

  constructor(data: MeshDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
    this.targetEntityId = data.targetEntityId ?? null;
  }

  serialize(): MeshDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
      targetEntityId: this.targetEntityId ?? undefined,
    };
  }
}

const PANEL_ID = 'mesh-debugger';

export class MeshDebuggerSystem extends System {
  private component: MeshDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [MeshDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(MeshDebuggerComponent);
      if (comp) {
        this.component = comp;
        break;
      }
    }
    this.setupKeyboardListener();
    this.tryRegisterPanel();
  }

  protected onUpdate(_dt: number): void {
    if (!this.panelRegistered) this.tryRegisterPanel();
  }

  private tryRegisterPanel(): void {
    if (this.panelRegistered || !this.component || !this.world) return;

    const found = this.findTarget();
    if (!found) return;
    const { entityId, core } = found;

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Mesh',
      position: this.component.position,
      titleColor: '#66ccff',
      content: () => (
        <MeshPanel
          core={core}
          onReload={(src) =>
            this.eventBus.emit(MeshInputEvents.LOAD, { entityId, src })
          }
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
    }
  }

  private findTarget(): { entityId: string; core: MeshInstance } | null {
    if (!this.world || !this.component) return null;

    if (this.component.targetEntityId) {
      const entity = this.world.getEntity(this.component.targetEntityId);
      const comp = entity?.get(MeshComponent);
      if (comp?.instance) {
        return { entityId: this.component.targetEntityId, core: comp.instance };
      }
    }

    for (const entity of this.world.getEntities()) {
      const comp = entity.get(MeshComponent);
      if (comp?.instance) {
        return {
          entityId: (entity as unknown as { id: string }).id,
          core: comp.instance,
        };
      }
    }
    return null;
  }

  private setupKeyboardListener(): void {
    if (this.keydownHandler) return;
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.component) return;
      if (e.code === this.component.activationKey) {
        e.preventDefault();
        vizStore.togglePanel(PANEL_ID);
        this.component.visible = vizStore.isVisible(PANEL_ID);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected onEntityAdded(entity: Entity): void {
    const comp = entity.get(MeshDebuggerComponent);
    if (comp && !this.component) {
      this.component = comp;
      this.tryRegisterPanel();
    }
  }

  protected onShutdown(): void {
    vizStore.unregisterPanel(PANEL_ID);
    this.panelRegistered = false;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}
