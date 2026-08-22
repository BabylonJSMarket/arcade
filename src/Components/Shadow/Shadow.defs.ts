/**
 * Shadow — definitions.
 *
 * Holds the `ShadowComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name Shadow in a query, or type an event it listens for, without pulling
 * Shadow's behaviour into its own bundle. Import from here, not from
 * Shadow.ts.
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