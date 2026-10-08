/**
 * Game registry — the cabinets' games.
 *
 * One entry per folder under `src/games/`. Each game's ENTITIES live in a scene
 * JSON under `public/games/<name>/scene.json`, so you can edit a level and just
 * reload — no rebuild, and the same file `bjs download` produces for a scene.
 * The TS file beside it (`src/games/<name>/index.ts`) is where that game's own
 * Systems go, if it needs any.
 *
 * You don't normally edit this file by hand. Run, INSIDE this project:
 *
 *     npm create @babylonjsmarket/arcade@latest my-game
 *
 * and it adds the folder, the scene JSON, and the entry below — then points a
 * free cabinet at it.
 *
 * Components and assets are SHARED: everything `bjs download` installs lands in
 * this project's `src/components/` and `public/`, so every game here draws from
 * the same pool. Downloading a component once makes it available to all of them.
 */

/** One playable game fronted by a cabinet in the arcade room. */
export interface ArcadeGameEntry {
  /** Folder key under src/games/ — also the URL segment (`/games/<name>/`). */
  name: string
  /** Shown on the cabinet / HUD. */
  title: string
  /** Scene JSON, served from public/. Loaded with `game.loadSceneFromUrl`. */
  sceneUrl: string
}

export const GAMES: Record<string, ArcadeGameEntry> = {
  // 'frogger': { name: 'frogger', title: 'Frogger', sceneUrl: '/games/frogger/scene.json' },
}

/** The route a game is reachable at. Kept here so the router and the cabinets agree. */
export function gameRoute(name: string): string {
  return `/games/${name}/`
}

/** Parse `/games/<name>/` back to a registered game, or null for the arcade room. */
export function gameFromPath(pathname: string): ArcadeGameEntry | null {
  const match = /^\/games\/([^/]+)\/?$/.exec(pathname)
  if (!match) return null
  return GAMES[match[1]] ?? null
}
