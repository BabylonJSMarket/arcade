/**
 * Score.viz.tsx — ECS wrapper that registers the renderer-free Panel with
 * vizStore. The Panel itself (Score.panel.tsx) is what the Three.js demo
 * mounts directly, without any of this ECS wiring.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { ScorePanel } from './Score.panel';
import {
  ScoreComponent,
  ScoreInputEvents,
} from './Score';
import type { ScoreInstance } from './Score.core';

export interface ScoreDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Players to show award buttons for when the live bucket is still empty. */
  players?: string[];
}

export class ScoreDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  players: string[];

  constructor(data: ScoreDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
    this.players = data.players ? [...data.players] : [];
  }

  serialize(): ScoreDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
      players: [...this.players],
    };
  }
}

const PANEL_ID = 'score-debugger';

export class ScoreDebuggerSystem extends System {
  private component: ScoreDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ScoreDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(ScoreDebuggerComponent);
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
      title: 'Score',
      position: this.component.position,
      titleColor: '#fbbf24',
      content: () => (
        <ScorePanel
          core={core}
          players={this.component?.players}
          onAward={(ownerEntity, points) =>
            this.eventBus.emit(ScoreInputEvents.ADD, { ownerEntity, points })
          }
          onResetScores={() => this.eventBus.emit(ScoreInputEvents.RESET, {})}
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
    }
  }

  private findCoreInstance(): ScoreInstance | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(ScoreComponent);
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
    const comp = entity.get(ScoreDebuggerComponent);
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
