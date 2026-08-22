/**
 * Enemy.ts — the hostile marker's public surface.
 *
 * There is no EnemySystem, and that is the whole design: a marker declares a
 * fact about an entity and leaves acting on it to whoever cares. In a
 * space shooter the targeting code picks these ships as missile locks, the
 * impact path decides whose rounds may hit them, and the kill path scores them
 * — three consumers, no owner.
 *
 * A scene loader that finds no `${Name}System` for a component simply attaches
 * the data, which is exactly right here.
 */

export { EnemyComponent } from './Enemy.defs'
