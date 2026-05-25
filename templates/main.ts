// Tiny boot — boots the renderer, mounts viz panels (` for Entities, F4 for
// the EventBus debugger), loads the scene, and starts the render loop. You
// rarely need to edit this. To change the game itself, edit src/scene.ts.
import { ArcadeGame } from '@babylonjsmarket/arcade'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { mountArcadeViz } from '@babylonjsmarket/arcade/viz'
import { SCENE } from './scene'
import { REGISTRY } from './registry'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement

const game = new ArcadeGame(new BabylonAdapter(), { componentRegistry: REGISTRY })
await game.init(canvas)
// mountArcadeViz must run *before* loadScene so any HUD-panel components in
// scene.ts find a live vizStore to register against.
mountArcadeViz(game.world, { sceneName: SCENE.name })
await game.loadScene(SCENE)
game.start()

window.addEventListener('resize', () => game.renderer.resize())
