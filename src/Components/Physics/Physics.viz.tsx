/**
 * Physics.viz.tsx — ECS wrapper that registers the renderer-free PhysicsPanel
 * with vizStore. The Panel itself is in Physics.panel.tsx and works against
 * either the Babylon or the Three.js demo unchanged.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { PhysicsPanel } from './Physics.panel';
import {
  PhysicsComponent,
  PhysicsInputEvents,
} from './Physics';

export interface PhysicsDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class PhysicsDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: PhysicsDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
  }

  serialize(): PhysicsDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

const PANEL_ID = 'physics-debugger';

export class PhysicsDebuggerSystem extends System {
  private component: PhysicsDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [PhysicsDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(PhysicsDebuggerComponent);
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

  private findPhysicsEntity(): { entityId: string; comp: PhysicsComponent } | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(PhysicsComponent);
      if (comp) return { entityId: entity.id, comp };
    }
    return null;
  }

  private tryRegisterPanel(): void {
    if (this.panelRegistered || !this.component || !this.world) return;
    const found = this.findPhysicsEntity();
    if (!found) return;

    const entityId = found.entityId;
    const comp = found.comp;

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Physics',
      position: this.component.position,
      titleColor: '#66ccff',
      content: () => (
        <PhysicsPanel
          component={comp}
          onKick={(vx, vy, vz) =>
            this.eventBus.emit(PhysicsInputEvents.SET_VELOCITY, {
              entityId,
              vx,
              vy,
              vz,
            })
          }
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
    }
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
    const comp = entity.get(PhysicsDebuggerComponent);
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
