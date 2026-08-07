/**
 * __TITLE__ — this game's code seam.
 *
 * The ENTITIES live next door in `public/games/__NAME__/scene.json`: pure data,
 * editable without a rebuild. This file is for the parts a scene can't express —
 * this game's own Systems, and any component it needs registered by name.
 *
 * Nothing here is required. A game made only of stock components (the ones
 * `@babylonjsmarket/arcade` already knows, plus anything you have installed via
 * `bjs download`) runs from its scene JSON alone, and this file just names it.
 *
 * Everything in `src/Components/` and `public/` is SHARED with the rest of the
 * arcade — download a component or an asset once and every game can use it.
 */
import type { ArcadeGameEntry } from '../index'

export const GAME: ArcadeGameEntry = {
  name: '__NAME__',
  title: '__TITLE__',
  sceneUrl: '/games/__NAME__/scene.json',
}

/**
 * Custom components for THIS game, merged into the shared registry when it
 * loads. Add entries as `{ MyComponent: () => import('../../Components/MyComponent/MyComponent') }`
 * — the same shape as `src/registry.ts`.
 */
export const GAME_COMPONENTS = {}
