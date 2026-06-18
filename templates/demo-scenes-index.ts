/**
 * Scene registry for the adapter-comparison demo. One scene, rendered by every
 * adapter at once (see src/main.ts).
 */
import { COMPARE_SCENE } from './compare'

export const SCENES = {
  'adapter-compare': COMPARE_SCENE,
}

export const DEFAULT_SCENE: keyof typeof SCENES = 'adapter-compare'
