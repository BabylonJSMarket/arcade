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
import { SCENES, DEFAULT_SCENE } from './scenes'
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const sceneUrl = new URLSearchParams(window.location.search).get('scene')

const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY })
await game.init(canvas)

if (sceneUrl) {
  // Downloaded-asset preview: load the JSON scene by URL.
  mountArcadeViz(game.world, { sceneName: sceneUrl })
  await game.loadSceneFromUrl(sceneUrl)
} else {
  // Default: the scene registered in src/scenes/index.ts.
  const scene = SCENES[DEFAULT_SCENE]
  // mountArcadeViz must run *before* loadScene so any HUD-panel components in
  // the scene find a live vizStore to register against.
  mountArcadeViz(game.world, { sceneName: scene.name })
  await game.loadScene(scene)
}

game.start()

window.addEventListener('resize', () => game.renderer.resize())
