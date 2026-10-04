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
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in Enemy must still match a copy in the project.
  static componentType = 'Enemy';

  serialize(): Record<string, never> {
    return {}
  }
}