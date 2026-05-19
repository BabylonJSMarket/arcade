/**
 * PlayerInput.viz.tsx — ECS wrapper that registers the renderer-free
 * PlayerInputPanel with vizStore.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { PlayerInputPanel } from './PlayerInput.panel';
import { PlayerInputComponent } from './PlayerInput';
import type { PlayerInputInstance } from './PlayerInput.core';

export interface PlayerInputDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class PlayerInputDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: PlayerInputDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
  }

  serialize(): PlayerInputDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

const PANEL_ID = 'player-input-debugger';

export class PlayerInputDebuggerSystem extends System {
  private component: PlayerInputDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [PlayerInputDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(PlayerInputDebuggerComponent);
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

    const core = this.findCoreInstance();
    if (!core) return;

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Player Input',
      position: this.component.position,
      titleColor: '#66ccff',
      content: () => <PlayerInputPanel core={core} />,
    });
    this.panelRegistered = true;
    if (this.component.visible) vizStore.showPanel(PANEL_ID);
  }

  private findCoreInstance(): PlayerInputInstance | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(PlayerInputComponent);
      if (comp?.instance) return comp.instance;
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
    const comp = entity.get(PlayerInputDebuggerComponent);
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
