/**
 * Adapter comparison boot.
 *
 * Runs the SAME ECS scene through all three renderer adapters at once — one
 * ArcadeGame per canvas — so you can see Babylon, Three (+Rapier physics) and
 * Babylon Lite render identical data side by side. Each pane is its own World +
 * EventBus + adapter; drag to orbit each independently. The only honest
 * difference is the per-pane FPS counter (WebGPU vs WebGL cadence).
 */
import { ArcadeGame } from '@babylonjsmarket/arcade'
import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'
import { ThreeAdapter } from '@babylonjsmarket/ecs/three'
import { BabylonLiteAdapter } from '@babylonjsmarket/ecs/babylon-lite'
import type { RendererAdapter } from '@babylonjsmarket/ecs/renderer-types'
import { SCENES, DEFAULT_SCENE } from './scenes'
import { REGISTRY } from './registry'

const SCENE = SCENES[DEFAULT_SCENE]

async function run(
  make: () => RendererAdapter,
  canvasId: string,
  fpsId: string,
  statusId: string,
): Promise<void> {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement
  const fpsEl = document.getElementById(fpsId)
  const statusEl = document.getElementById(statusId)
  try {
    const game = new ArcadeGame(make(), { componentRegistry: REGISTRY })
    await game.init(canvas)
    // Each world gets its own copy of the scene data (loadScene reads it).
    await game.loadScene(JSON.parse(JSON.stringify(SCENE)))

    // Drive the loop ourselves (instead of game.start()) so we can read FPS.
    let frames = 0
    let last = performance.now()
    game.renderer.startLoop((dt) => {
      game.world.update(dt)
      frames++
      const now = performance.now()
      if (now - last >= 500) {
        if (fpsEl) fpsEl.textContent = `${Math.round((frames * 1000) / (now - last))} fps`
        frames = 0
        last = now
      }
    })
    window.addEventListener('resize', () => game.renderer.resize())
    if (statusEl) statusEl.style.display = 'none'
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    if (statusEl) {
      statusEl.classList.add('error')
      statusEl.style.display = 'block'
      statusEl.textContent = canvasId.includes('lite')
        ? `Babylon Lite needs a WebGPU browser — ${msg}`
        : `init failed: ${msg}`
    }
    console.error(`[${canvasId}]`, err)
  }
}

run(() => new BabylonAdapter(), 'cv-babylon', 'fps-babylon', 'st-babylon')
run(() => new ThreeAdapter(), 'cv-three', 'fps-three', 'st-three')
run(() => new BabylonLiteAdapter(), 'cv-lite', 'fps-lite', 'st-lite')
