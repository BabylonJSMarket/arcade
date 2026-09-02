// Tiny boot — boots the renderer, mounts viz panels (` for Entities, F4 for
// the EventBus debugger), loads a scene, and starts the render loop.
// You rarely need to edit this. To change the arcade, edit the scenes under
// src/scenes/ (start with src/scenes/arcade-room.ts).
//
// `?scene=<url>` override: if the URL carries a scene query param, that JSON
// scene is loaded instead of the default. This is how `bjs download <asset>`
// previews a downloaded asset — it drops public/<key>/scene.json and opens
// /?scene=/<key>/scene.json. With no param, the default scene loads.
import { ArcadeGame, registerBabylonToneMappingExtension } from '@babylonjsmarket/arcade'
import { registerBabylonAmbientOcclusionExtension, registerBabylonNeonTextExtension } from '@babylonjsmarket/arcade/babylon'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { mountArcadeViz, mountControlsHud, hintsFromSceneTitle } from '@babylonjsmarket/arcade/viz'
import { mountViz } from '@babylonjsmarket/viz/solid'
// Debug-panel themes — the Esc gear menu lets you switch between them. Without
// at least one theme the panels register and the hotkeys toggle them, but they
// render unstyled (the "old"/invisible look).
import '@babylonjsmarket/viz/themes/flat.css'
import '@babylonjsmarket/viz/themes/neumorphic.css'
import '@babylonjsmarket/viz/themes/glassmorphic.css'
import '@babylonjsmarket/viz/themes/brutalism.css'
import '@babylonjsmarket/viz/themes/comicbook.css'
import '@babylonjsmarket/viz/themes/windows95.css'
import '@babylonjsmarket/viz/themes/unity.css'
import '@babylonjsmarket/viz/themes/unreal.css'
import '@babylonjsmarket/viz/themes/godot.css'
import { SCENES, DEFAULT_SCENE } from './scenes'
import { GAMES, gameFromPath } from './games'
import { CabinetLinkEvents } from '@babylonjsmarket/arcade'
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const sceneUrl = new URLSearchParams(window.location.search).get('scene')

const adapter = new BabylonAdapter()

// Built-in arcade adapter plugins: the ACES tone-mapping grade that
// EnvironmentTexture{preset:'studio'} + ToneMapping rely on for the marketplace
// figure look, the SSAO2 contact-shadow pass behind AmbientOcclusion, and the
// slab-geometry text extrusion behind NeonSign (without it a sign quietly draws
// a flat label quad instead). Free arcade components aren't downloaded, so the
// auto-wire below won't catch these — register them explicitly.
registerBabylonToneMappingExtension(adapter)
registerBabylonAmbientOcclusionExtension(adapter)
registerBabylonNeonTextExtension(adapter)

// Auto-wire adapter plugins shipped by downloaded components. A component that
// needs an engine feature the adapter doesn't expose — AnimateMeshy's runtime
// retarget, for example — ships an `adapter/register.ts` exporting a
// `register…Extension(adapter)` function. `bjs download` drops it under
// `src/Components/<Name>/adapter/`; this installs every one on the adapter
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
//   - mountArcadeViz: entity list (`) + EventBus debugger (F4).
//   - mountViz: the panel renderer + StateStepper + the Esc gear/FPS menu that
//     lists every panel so you can toggle them on/off.
mountArcadeViz(game.world, { sceneName })
mountViz(game.world, { sceneName })

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

// Controls HUD — a small key-hint overlay pinned bottom-left. Hints come from
// the scene's optional `controls` list, or are parsed from its `sceneTitle`
// when it already spells them out ("Walk (WASD), run (Shift), jump (Space)…").
const hudScene: { controls?: { key: string; label: string }[]; sceneTitle?: string } | null =
  sceneUrl ? await fetch(sceneUrl).then((r) => r.json()).catch(() => null) : (scene as never)
const hudHints = hudScene?.controls ?? hintsFromSceneTitle(hudScene?.sceneTitle)
if (hudHints.length) mountControlsHud(hudHints)

window.addEventListener('resize', () => game.renderer.resize())
