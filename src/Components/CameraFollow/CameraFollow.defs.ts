/**
 * CameraFollow — definitions.
 *
 * Holds the `CameraFollowComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name CameraFollow in a query, or type an event it listens for, without
 * pulling CameraFollow's behaviour into its own bundle. Import from here,
 * not from CameraFollow.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import { type CameraFollowInstance, type CameraFollowParams, DEFAULT_CAMERA_FOLLOW_PARAMS } from './CameraFollow.core';

export interface CameraFollowInput extends Partial<CameraFollowParams> {
  /** Entity id of the thing to follow. Must own a MeshPrimitive. */
  target?: string;
}

export class CameraFollowComponent extends Component {
  params: CameraFollowParams;
  target: string;
  instance: CameraFollowInstance | null = null;

  constructor(data: CameraFollowInput = {}) {
    super();
    const { target, ...params } = data;
    this.target = target ?? '';
    this.params = { ...DEFAULT_CAMERA_FOLLOW_PARAMS, ...params };
  }

  serialize(): CameraFollowInput {
    return { target: this.target, ...this.params };
  }
}