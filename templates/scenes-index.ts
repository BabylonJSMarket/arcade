/**
 * Scene registry — the "multigame" seam.
 *
 * Each entry is a self-contained scene the arcade can load. The starter ships
 * one scene (the arcade room). To add a cabinet's game:
 *
 *   1. Author its scene under `src/scenes/<my-game>.ts` (export the scene
 *      object — copy `arcade-room.ts` as a template).
 *   2. Import it here and add it under a new key below.
 *   3. Switch to it at runtime with `game.loadScene(SCENES['<my-game>'])`
 *      (e.g. when the player walks up to / activates a cabinet).
 */
import { ARCADE_ROOM } from './arcade-room'

export const SCENES = {
  'arcade-room': ARCADE_ROOM,
}

export const DEFAULT_SCENE: keyof typeof SCENES = 'arcade-room'
