/**
 * Enemy — definitions.
 *
 * Holds the `EnemyComponent` class. No System lives here, which is the
 * point: another component can name Enemy in a query, or type an event it
 * listens for, without pulling Enemy's behaviour into its own bundle. Import
 * from here, not from Enemy.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
/** Marker for hostile entities. Pure classification — no data of its own. */
export class EnemyComponent extends Component {
  serialize(): Record<string, never> {
    return {}
  }
}