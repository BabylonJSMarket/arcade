/**
 * Enemy.core.ts — the genre-neutral hostile marker.
 *
 * A REAL marker COMPONENT, not a bare string tag. It carries no data, but being
 * a class is what earns it a place: targeting, scoring and impact code can ask
 * `entity.get(EnemyComponent)` type-safely instead of string-matching an
 * `'enemy'` tag that a rename would silently break, and the component graph can
 * see who is hostile.
 *
 * Deliberately empty. "This entity is hostile" is the only claim every genre
 * agrees on; a chase speed, a contact radius or a point value belongs to one
 * subgenre's AI, not to the idea of an enemy. The twin-stick swarm brain that
 * used to occupy this name is `TwinStickEnemy` — it kept the behaviour and gave
 * the bare name back.
 *
 * Zero imports from @babylonjs, three, solid-js, or the DOM.
 */

import { Component } from '@babylonjsmarket/ecs'

/** Marker for hostile entities. Pure classification — no data of its own. */
export class EnemyComponent extends Component {
  serialize(): Record<string, never> {
    return {}
  }
}
