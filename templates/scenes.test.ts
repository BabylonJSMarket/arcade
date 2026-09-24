/**
 * Example test — run it with `npm test`.
 *
 * It loads the default scene into a real ArcadeGame, but swaps the 3D engine
 * for MockRendererAdapter. The mock draws nothing; it just records every call
 * a System makes (createMesh, createLight, ...). So the test runs in Node with
 * no browser, no canvas and no GPU. (vite.config.js runs tests in Node; a
 * test that needs `document` can install jsdom and switch its environment.)
 *
 * Copy this file to test your own scenes and components.
 */
import { describe, it, expect } from 'vitest'
import { ArcadeGame } from '@babylonjsmarket/arcade'
import { MockRendererAdapter } from '@babylonjsmarket/ecs'
import { SCENES, DEFAULT_SCENE } from './index'
import { REGISTRY } from '../registry'

describe('default scene', () => {
  it('loads every entity it declares', async () => {
    const scene = SCENES[DEFAULT_SCENE]
    const renderer = new MockRendererAdapter()
    const game = new ArcadeGame(renderer, { componentRegistry: REGISTRY })

    await game.loadScene(scene)

    for (const name of Object.keys(scene.entities)) {
      expect(game.world.getEntity(name), `entity "${name}"`).toBeDefined()
    }
    // The Systems asked the (mock) renderer to build something.
    expect(renderer.calls.length).toBeGreaterThan(0)
  })
})
