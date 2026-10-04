// Tiny boot — boots the renderer, loads a scene, and starts the render loop.
// In dev (`npm run dev`) it also mounts the debug panels: F1 Entities,
// F2 EventBus, F3 State Stepper, and Esc for the menu that lists them all.
// A production build (`npm run build`) leaves the panels out.
// You rarely need to edit this. To change the game, edit the scenes under
// src/scenes/ (src/scenes/index.ts lists them).
//
// `?scene=<url>` override: if the URL carries a scene query param, that JSON
// scene is loaded instead of the default. This is how `bjs download <asset>`
// previews a downloaded asset — it drops public/<key>/scene.json and opens
// /?scene=/<key>/scene.json. With no param, the default scene loads.
import { ArcadeGame, mountControlsHud, hintsFromSceneTitle } from '@babylonjsmarket/arcade'
import { registerArcadePlugins } from '@babylonjsmarket/arcade/babylon'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { SCENES, DEFAULT_SCENE } from './scenes'
import { GAMES, gameFromPath } from './games'
import { CabinetLinkEvents } from '@babylonjsmarket/arcade'
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const sceneUrl = new URLSearchParams(window.location.search).get('scene')

const adapter = new BabylonAdapter()

// Built-in arcade adapter plugins: one call installs the ACES grade behind
// ToneMapping, the SSAO2 pass behind AmbientOcclusion, the extruded text behind
// NeonSign and the Havok casts behind Physics. The components ship inside the
// arcade package, so the auto-wire below can't see them. When arcade adds a
// built-in plugin, this call picks it up with no edit here.
registerArcadePlugins(adapter)

// Auto-wire adapter plugins shipped by downloaded components. A component that
// needs an engine feature the adapter doesn't expose — AnimateMeshy's runtime
// retarget, for example — ships an `adapter/register.ts` exporting a
// `register…Extension(adapter)` function. `bjs download` drops it under
// `src/components/<Name>/adapter/`; this installs every one on the adapter
// BEFORE the scene loads, so the component's System finds its plugin at load
// time. Projects with no such component match nothing here (a no-op).
const adapterPlugins = import.meta.glob(
  ['./Components/*/adapter/register.ts', './components/*/adapter/register.ts'],
  { eager: true },
)
for (const mod of Object.values(adapterPlugins)) {
  for (const [name, fn] of Object.entries(mod as Record<string, unknown>)) {
    if (typeof fn === 'function' && /^register[A-Za-z]*Extension$/.test(name)) {
      ;(fn as (a: unknown) => void)(adapter)
    }
  }
}

const game = new ArcadeGame(adapter, { componentRegistry: REGISTRY })
await game.init(canvas)

// Scene name namespaces persisted panel state. For a downloaded-asset preview
// (`?scene=<url>`) it's the URL; otherwise the default scene's name.
const scene = sceneUrl ? null : SCENES[DEFAULT_SCENE]
const sceneName = sceneUrl ?? scene!.name

// Mount the debug viz *before* loadScene so any HUD-panel components in the
// scene find a live vizStore to register against:
//   - mountArcadeViz: Entities (F1) + the EventBus debugger (F2) + an FPS counter.
//   - mountViz: the panel renderer + State Stepper (F3) + the Esc gear/FPS menu
//     that lists every panel so you can toggle them on/off.
// F-keys go out in the order panels register, so these three are F1-F3, and a
// scene's own panels that don't name a key get F4 and up. The themes style the
// panels; the gear menu switches between them.
//
// Dev only. In a production build import.meta.env.DEV is the constant false,
// so the bundler drops this block and everything it imports: players get the
// game, not the debugger.
if (import.meta.env.DEV) {
  const [{ mountArcadeViz }, { mountViz }] = await Promise.all([
    import('@babylonjsmarket/arcade/viz'),
    import('@babylonjsmarket/viz/solid'),
    import('@babylonjsmarket/viz/themes/flat.css'),
    import('@babylonjsmarket/viz/themes/neumorphic.css'),
    import('@babylonjsmarket/viz/themes/glassmorphic.css'),
    import('@babylonjsmarket/viz/themes/brutalism.css'),
    import('@babylonjsmarket/viz/themes/comicbook.css'),
    import('@babylonjsmarket/viz/themes/windows95.css'),
    import('@babylonjsmarket/viz/themes/unity.css'),
    import('@babylonjsmarket/viz/themes/unreal.css'),
    import('@babylonjsmarket/viz/themes/godot.css'),
  ])
  mountArcadeViz(game.world, { sceneName })
  mountViz(game.world, { sceneName })
}

if (sceneUrl) {
  await game.loadSceneFromUrl(sceneUrl)
} else {
  await game.loadScene(scene!)
}

game.start()

// ── Arcade router ──────────────────────────────────────────────────────────
// The arcade is ONE running app. Walking into a game swaps the scene and
// pushes `/games/<name>/`; it does not reload the page — so the engine, the
// loaded assets and every downloaded component stay warm, and coming back to
// the room is instant. The URL is still real: shareable, bookmarkable, and the
// browser Back button walks you back out to the arcade floor.
//
// Vite's dev server needs no extra config for this (it falls back to index.html
// for unknown paths); a static host needs the usual SPA rewrite to index.html.
async function showRoute(pathname: string): Promise<void> {
  // `replace` tears the previous scene down first — without it the room's
  // entities and the game's collide (two `Sun`s) and both scenes' systems run
  // at once.
  const entry = gameFromPath(pathname)
  if (entry) {
    await game.loadSceneFromUrl(entry.sceneUrl, { replace: true })
  } else {
    await game.loadScene(SCENES[DEFAULT_SCENE], { replace: true })
  }
}

// Double-clicking a cabinet emits LAUNCH (see the CabinetLink component). The
// component deliberately doesn't know about routing — this is where the app
// decides what "start the game" means.
game.eventBus.on(CabinetLinkEvents.LAUNCH, (e: { game: string; route: string }) => {
  if (!GAMES[e.game]) {
    console.warn(`[arcade] cabinet points at unknown game "${e.game}" — is it in src/games/index.ts?`)
    return
  }
  history.pushState({ game: e.game }, '', e.route)
  void showRoute(e.route)
})

window.addEventListener('popstate', () => {
  void showRoute(window.location.pathname)
})

// Deep link: someone opened /games/<name>/ directly, so start there rather than
// in the room. (`?scene=` previews win over this — they're a different mode.)
if (!sceneUrl && gameFromPath(window.location.pathname)) {
  await showRoute(window.location.pathname)
}

// Controls HUD — a small key-hint overlay pinned bottom-left. Unlike the debug
// panels it is for players, so it stays in a production build; it moves up out
// of the way if the scene's own HUD already has something in that corner.
// Hints come from the scene's optional `controls` list (`[]` turns the box
// off), or are parsed from its `sceneTitle` when it already spells them out
// ("Walk (WASD), run (Shift), jump (Space)…").
const hudScene: { controls?: { key: string; label: string }[]; sceneTitle?: string } | null =
  sceneUrl ? await fetch(sceneUrl).then((r) => r.json()).catch(() => null) : (scene as never)
const hudHints = hudScene?.controls ?? hintsFromSceneTitle(hudScene?.sceneTitle)
if (hudHints.length) mountControlsHud(hudHints)

window.addEventListener('resize', () => game.renderer.resize())
