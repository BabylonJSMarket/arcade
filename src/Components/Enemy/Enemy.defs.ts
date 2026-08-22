/**
 * Enemy — definitions.
 *
 * The Enemy component class, its event dictionary and the payload shapes that
 * travel on those events. Import from HERE when another component needs to name
 * Enemy in a query or react to what it emits: this file carries no System, so
 * naming Enemy never drags its behaviour into your bundle.
 */

import { Component } from '@babylonjsmarket/ecs';
/** Marker for hostile entities. Pure classification — no data of its own. */
export class EnemyComponent extends Component {
  serialize(): Record<string, never> {
    return {}
  }
}