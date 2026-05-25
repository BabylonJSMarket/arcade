/**
 * Component resolver map for the empty-3d scene. Every component the scene
 * uses (Skybox, DirectionalLight, MeshPrimitive, Shadow, ArcCamera, ...) is
 * registered by default in @babylonjsmarket/arcade, so this map is empty.
 *
 * To add your own component, drop it under `src/components/MyThing.ts`
 * exporting `MyThingComponent` (and optionally `MyThingSystem`), then add
 * an entry below:
 *
 *   MyThing: () => import('./components/MyThing'),
 */
export const REGISTRY = {}
