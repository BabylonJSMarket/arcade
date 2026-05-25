import { runMechanicContract } from '@babylonjsmarket/ecs/testing'
import { EntityPoolComponent, EntityPoolSystem } from './EntityPool'

runMechanicContract({
  name: 'EntityPool',
  componentClass: EntityPoolComponent,
  systemClass: EntityPoolSystem,
  // Empty `components` keeps the contract harness (which has no SceneLoader)
  // from needing a component registry — the pool still pre-allocates + tags.
  sampleInput: { pool: 'contract', size: 2, tags: ['pooled'], components: {} },
  events: {
    input: ['entityPool.spawn', 'entityPool.release'],
  },
})
