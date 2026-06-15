// Tiny boot — boots the renderer, mounts viz panels (` for Entities, F4 for
// the EventBus debugger), loads the default scene, and starts the render loop.
// You rarely need to edit this. To change the arcade, edit the scenes under
// src/scenes/ (start with src/scenes/arcade-room.ts).
import { ArcadeGame } from '@babylonjsmarket/arcade'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { mountArcadeViz } from '@babylonjsmarket/arcade/viz'
import { SCENES, DEFAULT_SCENE } from './scenes'
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement

const scene = SCENES[DEFAULT_SCENE]
const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY })
await game.init(canvas)
// mountArcadeViz must run *before* loadScene so any HUD-panel components in the
// scene find a live vizStore to register against.
mountArcadeViz(game.world, { sceneName: scene.name })
await game.loadScene(scene)
game.start()

window.addEventListener('resize', () => game.renderer.resize())
