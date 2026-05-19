/**
 * Lazy resolver map for the 14 components in @babylonjsmarket/arcade.
 *
 * Each entry returns a Promise of the component module. ArcadeGame consults
 * this map when a scene references a component by name — only the components
 * actually used by a loaded scene get pulled into the bundle. Bundlers turn
 * each `import()` into a separate chunk, so tree-shaking happens at the
 * component-folder level rather than the package level.
 */

export type ComponentModule = Record<string, unknown>;
export type LazyComponentResolver = () => Promise<ComponentModule>;

export const ARCADE_COMPONENT_REGISTRY: Record<string, LazyComponentResolver> = {
  MeshPrimitive: () => import("./Components/MeshPrimitive/MeshPrimitive"),
  Movement: () => import("./Components/Movement/Movement"),
  KeyboardMover: () => import("./Components/KeyboardMover/KeyboardMover"),
  PlayerInput: () => import("./Components/PlayerInput/PlayerInput"),
  ArcCamera: () => import("./Components/ArcCamera/ArcCamera"),
  CameraFollow: () => import("./Components/CameraFollow/CameraFollow"),
  DirectionalLight: () => import("./Components/DirectionalLight/DirectionalLight"),
  HemisphericLight: () => import("./Components/HemisphericLight/HemisphericLight"),
  Physics: () => import("./Components/Physics/Physics"),
  Score: () => import("./Components/Score/Score"),
  Scoreboard: () => import("./Components/Scoreboard/Scoreboard"),
  Shadow: () => import("./Components/Shadow/Shadow"),
  Animation: () => import("./Components/Animation/Animation"),
  Mesh: () => import("./Components/Mesh/Mesh"),
};

export const ARCADE_COMPONENT_NAMES = Object.keys(ARCADE_COMPONENT_REGISTRY);
