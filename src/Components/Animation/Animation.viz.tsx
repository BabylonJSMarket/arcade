/**
 * Animation.viz.tsx — ECS wrapper that registers the renderer-free Panel
 * with vizStore. The Panel (Animation.panel.tsx) is what Three.js / Babylon
 * demos both mount — this wrapper only exists to wire the Panel's callbacks
 * through the EventBus.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { AnimationPanel } from './Animation.panel';
import {
  AnimationComponent,
  AnimationInputEvents,
} from './Animation';
import type { AnimationInstance } from './Animation.core';

export interface AnimationDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Entity id of the Animation target the panel controls. */
  targetEntityId?: string;
}

export class AnimationDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  targetEntityId: string | null;

  constructor(data: AnimationDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
    this.targetEntityId = data.targetEntityId ?? null;
  }

  serialize(): AnimationDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
      targetEntityId: this.targetEntityId ?? undefined,
    };
  }
}

const PANEL_ID = 'animation-debugger';

export class AnimationDebuggerSystem extends System {
  private component: AnimationDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [AnimationDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(AnimationDebuggerComponent);
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
      title: 'Animation',
      position: this.component.position,
      titleColor: '#66cc55',
      content: () => (
        <AnimationPanel
          core={core}
          onSpeed={(speed) =>
            this.eventBus.emit(AnimationInputEvents.SET_SPEED, { entityId, speed })
          }
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
    }
  }

  private findTarget(): { entityId: string; core: AnimationInstance } | null {
    if (!this.world || !this.component) return null;

    if (this.component.targetEntityId) {
      const entity = this.world.getEntity(this.component.targetEntityId);
      const comp = entity?.get(AnimationComponent);
      if (comp?.instance) {
        return { entityId: this.component.targetEntityId, core: comp.instance };
      }
    }

    for (const entity of this.world.getEntities()) {
      const comp = entity.get(AnimationComponent);
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
    const comp = entity.get(AnimationDebuggerComponent);
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
