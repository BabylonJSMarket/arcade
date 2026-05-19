/**
 * KeyboardMover.viz.tsx — ECS wrapper that registers the renderer-free
 * KeyboardMoverPanel with vizStore and finds the first KeyboardMoverComponent
 * to bind to.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { KeyboardMoverPanel } from './KeyboardMover.panel';
import { KeyboardMoverComponent } from './KeyboardMover';

export interface KeyboardMoverDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class KeyboardMoverDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: KeyboardMoverDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
  }

  serialize(): KeyboardMoverDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

const PANEL_ID = 'keyboard-mover-debugger';

export class KeyboardMoverDebuggerSystem extends System {
  private component: KeyboardMoverDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [KeyboardMoverDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(KeyboardMoverDebuggerComponent);
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

    const target = this.findComponent();
    if (!target) return;

    vizStore.registerPanel({
      id: PANEL_ID,
      title: 'Keyboard Mover',
      position: this.component.position,
      titleColor: '#fbbf24',
      content: () => <KeyboardMoverPanel component={target} />,
    });
    this.panelRegistered = true;
    if (this.component.visible) vizStore.showPanel(PANEL_ID);
  }

  private findComponent(): KeyboardMoverComponent | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(KeyboardMoverComponent);
      if (comp) return comp;
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
    const comp = entity.get(KeyboardMoverDebuggerComponent);
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
