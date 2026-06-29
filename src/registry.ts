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
  PlayerInputBridge: () =>
    import("./Components/PlayerInputBridge/PlayerInputBridge"),
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
  // Soccer — pitch, ball, AI team play, stamina/movement.
  Goal: () => import("./Components/Goal/Goal"),
  BallPossession: () => import("./Components/BallPossession/BallPossession"),
  BallReset: () => import("./Components/BallReset/BallReset"),
  TeamSpawner: () => import("./Components/TeamSpawner/TeamSpawner"),
  AISeek: () => import("./Components/AISeek/AISeek"),
  AIInput: () => import("./Components/AIInput/AIInput"),
  AIBrakeNearBall: () =>
    import("./Components/AIBrakeNearBall/AIBrakeNearBall"),
  AIAvoidance: () => import("./Components/AIAvoidance/AIAvoidance"),
  AIGoalSeek: () => import("./Components/AIGoalSeek/AIGoalSeek"),
  AIKick: () => import("./Components/AIKick/AIKick"),
  AIZone: () => import("./Components/AIZone/AIZone"),
  AICoach: () => import("./Components/AICoach/AICoach"),
  SoccerDirector: () => import("./Components/SoccerDirector/SoccerDirector"),
  Stamina: () => import("./Components/Stamina/Stamina"),
  Stride: () => import("./Components/Stride/Stride"),
  AimIndicator: () => import("./Components/AimIndicator/AimIndicator"),
};

export const ARCADE_COMPONENT_NAMES = Object.keys(ARCADE_COMPONENT_REGISTRY);
