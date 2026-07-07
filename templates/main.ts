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
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const sceneUrl = new URLSearchParams(window.location.search).get('scene')

const adapter = new BabylonAdapter()

// Built-in arcade adapter plugin: the ACES tone-mapping grade that
// EnvironmentTexture{preset:'studio'} + ToneMapping rely on for the marketplace
// figure look. Free arcade components aren't downloaded, so the auto-wire below
// won't catch this one — register it explicitly.
registerBabylonToneMappingExtension(adapter)

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

// Controls HUD — a small key-hint overlay pinned bottom-left. Hints come from
// the scene's optional `controls` list, or are parsed from its `sceneTitle`
// when it already spells them out ("Walk (WASD), run (Shift), jump (Space)…").
const hudScene: { controls?: { key: string; label: string }[]; sceneTitle?: string } | null =
  sceneUrl ? await fetch(sceneUrl).then((r) => r.json()).catch(() => null) : (scene as never)
const hudHints = hudScene?.controls ?? hintsFromSceneTitle(hudScene?.sceneTitle)
if (hudHints.length) mountControlsHud(hudHints)

window.addEventListener('resize', () => game.renderer.resize())
