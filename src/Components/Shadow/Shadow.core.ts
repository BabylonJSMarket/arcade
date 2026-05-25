/**
 * Shadow.core.ts — pure data Component.
 */

import { Component } from '@babylonjsmarket/ecs';

export interface ShadowInput {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class ShadowComponent extends Component {
  castShadow: boolean;
  receiveShadow: boolean;

  constructor(data: ShadowInput = {}) {
    super();
    this.castShadow = data.castShadow ?? true;
    this.receiveShadow = data.receiveShadow ?? true;
  }

  serialize(): ShadowInput {
    return {
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
    };
  }
}
