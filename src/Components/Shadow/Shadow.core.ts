/**
 * Shadow.core.ts — pure data Component.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { MeshHandle, ShadowCasterHandle } from '@babylonjsmarket/ecs/renderer-types';

export interface ShadowInput {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class ShadowComponent extends Component {
  castShadow: boolean;
  receiveShadow: boolean;
  casterHandle?: ShadowCasterHandle;
  meshHandle?: MeshHandle;
  initialized = false;

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
