/**
 * Animation — definitions.
 *
 * Holds the `AnimationComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Animation in a query, or type an event it listens for, without
 * pulling Animation's behaviour into its own bundle. Import from here, not
 * from Animation.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import { DEFAULT_ANIMATION_PARAMS, type AnimationInstance, type AnimationParams, type AnimationState } from './Animation.core';
// ============================================
// Events
// ============================================

export interface AnimationSetSpeedRequest {
  entityId: string;
  speed: number;
}

export interface AnimationInput extends Partial<AnimationParams> {
  /** Name of the idle clip in the imported GLB (default: `"IDLE_RIFLE"`). */
  idleClip?: string;
  /** Name of the walk clip. */
  walkClip?: string;
  /** Name of the run clip. Optional — falls back to pure walk if missing. */
  runClip?: string;
  /** Start playing with full idle weight on attach (default: true). */
  autoPlay?: boolean;
}

// ============================================
// Component
// ============================================

export class AnimationComponent extends Component {
  params: AnimationParams;
  idleClip: string;
  walkClip: string;
  runClip: string;
  autoPlay: boolean;
  /** Populated by the System at attach time. */
  instance: AnimationInstance | null = null;
  /** Cached dominant state so tests + HUDs can observe without calling update. */
  lastState: AnimationState = 'idle';

  constructor(data: AnimationInput = {}) {
    super();
    const { idleClip, walkClip, runClip, autoPlay, ...params } = data;
    this.params = { ...DEFAULT_ANIMATION_PARAMS, ...params };
    this.idleClip = idleClip ?? 'IDLE_RIFLE';
    this.walkClip = walkClip ?? 'WALK_RIFLE';
    this.runClip = runClip ?? 'RUN_RIFLE';
    this.autoPlay = autoPlay ?? true;
  }

  serialize(): AnimationInput {
    return {
      ...this.params,
      idleClip: this.idleClip,
      walkClip: this.walkClip,
      runClip: this.runClip,
      autoPlay: this.autoPlay,
    };
  }
}