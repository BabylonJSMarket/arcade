/**
 * Scoreboard.viz.tsx — ECS wrapper that registers the renderer-free Panel
 * with vizStore. Mirrors Health.viz.tsx. The Panel itself is in
 * Scoreboard.panel.tsx and works against either the Babylon or the Three.js
 * demo unchanged — it only binds to the pure core.
 */

import { Component } from '@babylonjsmarket/ecs';
import { System } from '@babylonjsmarket/ecs';
import type { EventBus } from '@babylonjsmarket/ecs';
import type { Entity } from '@babylonjsmarket/ecs';
import { vizStore } from '../_shared/viz';
import { ScoreboardPanel } from './Scoreboard.panel';
import {
  ScoreboardComponent,
  ScoreboardInputEvents,
} from './Scoreboard';
import type { ScoreboardInstance } from './Scoreboard.core';

export interface ScoreboardDebuggerInput {
  visible?: boolean;
  activationKey?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class ScoreboardDebuggerComponent extends Component {
  visible: boolean;
  activationKey: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  constructor(data: ScoreboardDebuggerInput = {}) {
    super();
    this.visible = data.visible ?? false;
    this.activationKey = data.activationKey ?? 'Digit1';
    this.position = data.position ?? 'top-right';
  }

  serialize(): ScoreboardDebuggerInput {
    return {
      visible: this.visible,
      activationKey: this.activationKey,
      position: this.position,
    };
  }
}

const PANEL_ID = 'scoreboard-debugger';

export class ScoreboardDebuggerSystem extends System {
  private component: ScoreboardDebuggerComponent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private panelRegistered = false;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.query = { required: [ScoreboardDebuggerComponent] };
    this._pauseable = false;
  }

  protected onInitialize(): void {
    for (const entity of this.entities) {
      const comp = entity.get(ScoreboardDebuggerComponent);
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
      title: 'Scoreboard',
      position: this.component.position,
      titleColor: '#a78bfa',
      content: () => (
        <ScoreboardPanel
          core={core}
          onAddScore={(entityId, points) =>
            // Emits the same public Score event that a goal/scoring system
            // would — the Score system owns state mutation; we just request it.
            this.eventBus.emit('score.add', { ownerEntity: entityId, points })
          }
          onReset={() => this.eventBus.emit(ScoreboardInputEvents.SCORE_RESET, {})}
        />
      ),
    });

    this.panelRegistered = true;
    if (this.component.visible) {
      vizStore.showPanel(PANEL_ID);
    }
  }

  private findCoreInstance(): ScoreboardInstance | null {
    if (!this.world) return null;
    for (const entity of this.world.getEntities()) {
      const comp = entity.get(ScoreboardComponent);
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
    const comp = entity.get(ScoreboardDebuggerComponent);
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
