/**
 * Movement.viz.tsx — ECS wrapper that registers the renderer-free MovementPanel
 * with vizStore. The Panel itself lives in Movement.panel.tsx and binds to the
 * pure core.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { MovementPanel } from './Movement.panel';
import {
  MovementComponent,
  MovementInputEvents,
} from './Movement';
import type { MovementInstance } from './Movement.core';

export interface MovementDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class MovementDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: MovementDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
  }

  serialize(): MovementDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

const PANEL_ID = 'movement-debugger';

export class MovementDebuggerSystem extends System {
  private component: MovementDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [MovementDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(MovementDebuggerComponent);
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

  private findMovement(): { entityId: string; core: MovementInstance } | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(MovementComponent);
      if (comp?.instance) return { entityId: entity.id, core: comp.instance };
    }
    return null;
  }

  private tryRegisterPanel(): void {
    if (this.panelRegistered || !this.component || !this.world) return;

    const found = this.findMovement();
    if (!found) return;

    const entityId = found.entityId;

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Movement',
      position: this.component.position,
      titleColor: '#7fe5a0',
      content: () => (
        <MovementPanel
          core={found.core}
          onJump={() =>
            this.eventBus.emit(MovementInputEvents.JUMP_REQUESTED, { entityId })
          }
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) vizStore.showPanel(PANEL_ID);
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
    const comp = entity.get(MovementDebuggerComponent);
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
