/**
 * Shared component resolver map for every scene in the arcade.
 *
 * Every component the arcade room uses (MeshPrimitive, Mesh, DirectionalLight,
 * HemisphericLight, Shadow, ArcCamera, ...) is registered by default in
 * @babylonjsmarket/arcade, so this map starts empty.
 *
 * To add your own component, drop it under `src/components/MyThing.ts`
 * exporting `MyThingComponent` (and optionally `MyThingSystem`), then add an
 * entry below — it is shared across all scenes in `src/scenes/`:
 *
 *   MyThing: () => import('./components/MyThing'),
 */
export const REGISTRY = {}
