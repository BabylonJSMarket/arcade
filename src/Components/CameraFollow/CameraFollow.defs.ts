/**
 * CameraFollow — definitions.
 *
 * The CameraFollow component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * CameraFollow in a query or react to what it emits: this file carries no System, so
 * naming CameraFollow never drags its behaviour into your bundle.
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