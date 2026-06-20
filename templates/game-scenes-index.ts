/**
 * Scene registry — the multigame seam.
 *
 * A single game starts with one scene (the starter game). To grow it:
 *
 *   1. Author another scene under `src/scenes/<my-scene>.ts` (export the scene
 *      object — copy `game.ts` as a template).
 *   2. Import it here and add it under a new key below.
 *   3. Switch to it at runtime with `game.loadScene(SCENES['<my-scene>'])`.
 *
 * To turn a single game into a full multigame ARCADE — a walk-up room whose
 * cabinets launch each game — re-scaffold with
 * `npm create @babylonjsmarket/arcade -- --kind arcade`, or add an arcade-room
 * scene here yourself.
 */
import { GAME } from './game'

export const SCENES = {
  game: GAME,
}

export const DEFAULT_SCENE: keyof typeof SCENES = 'game'
