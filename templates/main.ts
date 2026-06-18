// Tiny boot — boots the renderer, mounts viz panels (` for Entities, F4 for
// the EventBus debugger), loads a scene, and starts the render loop.
// You rarely need to edit this. To change the arcade, edit the scenes under
// src/scenes/ (start with src/scenes/arcade-room.ts).
//
// `?scene=<url>` override: if the URL carries a scene query param, that JSON
// scene is loaded instead of the default. This is how `bjs download <asset>`
// previews a downloaded asset — it drops public/<key>/scene.json and opens
// /?scene=/<key>/scene.json. With no param, the default scene loads.
import { ArcadeGame } from '@babylonjsmarket/arcade'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { mountArcadeViz } from '@babylonjsmarket/arcade/viz'
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

const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY })
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

window.addEventListener('resize', () => game.renderer.resize())
