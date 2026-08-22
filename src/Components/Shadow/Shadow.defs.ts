/**
 * Shadow — definitions.
 *
 * The Shadow component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Shadow in a query or react to what it emits: this file carries no System, so
 * naming Shadow never drags its behaviour into your bundle.
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