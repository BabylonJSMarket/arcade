/**
 * Lazy resolver map for the components in @babylonjsmarket/arcade.
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
  Jump: () => import("./Components/Jump/Jump"),
  ArcCamera: () => import("./Components/ArcCamera/ArcCamera"),
  CameraFollow: () => import("./Components/CameraFollow/CameraFollow"),
  DirectionalLight: () => import("./Components/DirectionalLight/DirectionalLight"),
  HemisphericLight: () => import("./Components/HemisphericLight/HemisphericLight"),
  Physics: () => import("./Components/Physics/Physics"),
  Score: () => import("./Components/Score/Score"),
  Scoreboard: () => import("./Components/Scoreboard/Scoreboard"),
  Health: () => import("./Components/Health/Health"),
  HealthBar: () => import("./Components/HealthBar/HealthBar"),
  Flash: () => import("./Components/Flash/Flash"),
  Shadow: () => import("./Components/Shadow/Shadow"),
  Skybox: () => import("./Components/Skybox/Skybox"),
  EnvironmentTexture: () => import("./Components/EnvironmentTexture/EnvironmentTexture"),
  ToneMapping: () => import("./Components/ToneMapping/ToneMapping"),
  Animation: () => import("./Components/Animation/Animation"),
  Mesh: () => import("./Components/Mesh/Mesh"),
  // Pinball — flipper-driven physics tables.
  Plunger: () => import("./Components/Plunger/Plunger"),
  PinballCamera: () => import("./Components/PinballCamera/PinballCamera"),
  PinballLayout: () => import("./Components/PinballLayout/PinballLayout"),
  PinballTable: () => import("./Components/PinballTable/PinballTable"),
  PinballBuilder: () => import("./Components/PinballBuilder/PinballBuilder"),
  PinballBuilderInput: () =>
    import("./Components/PinballBuilderInput/PinballBuilderInput"),
  Bumper: () => import("./Components/Bumper/Bumper"),
  Flipper: () => import("./Components/Flipper/Flipper"),
  MouseHole: () => import("./Components/MouseHole/MouseHole"),
  Spinner: () => import("./Components/Spinner/Spinner"),
  // Shooter — top-down arena, twin-stick, spawner, projectile.
  BulletPool: () => import("./Components/BulletPool/BulletPool"),
  Bullet: () => import("./Components/Bullet/Bullet"),
  EntityPool: () => import("./Components/EntityPool/EntityPool"),
  Enemy: () => import("./Components/Enemy/Enemy"),
  SkeletonAnimator: () => import("./Components/SkeletonAnimator/SkeletonAnimator"),
  EnemySpawner: () => import("./Components/EnemySpawner/EnemySpawner"),
  ObstacleField: () => import("./Components/ObstacleField/ObstacleField"),
  LineOfSight: () => import("./Components/LineOfSight/LineOfSight"),
  TwinStickShooter: () =>
    import("./Components/TwinStickShooter/TwinStickShooter"),
  ShooterCamera: () => import("./Components/ShooterCamera/ShooterCamera"),
  // NOTE: premium gameplay components (the soccer team-AI set, the Wingman 6-DOF
  // flight stack, etc.) are NOT registered here — they are paid marketplace
  // components a project acquires via the download flow and registers in its own
  // per-game registry (see games' soccer + wingman cabinets, which vendor them
  // under src/.../<game>/components). This free registry is the "build-a-room"
  // core only: mesh/material loading, cameras, movement, lights, shadows, plus
  // the free mechanic sets.
};

export const ARCADE_COMPONENT_NAMES = Object.keys(ARCADE_COMPONENT_REGISTRY);
