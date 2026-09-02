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
  FirstPersonCamera: () => import("./Components/FirstPersonCamera/FirstPersonCamera"),
  DirectionalLight: () => import("./Components/DirectionalLight/DirectionalLight"),
  HemisphericLight: () => import("./Components/HemisphericLight/HemisphericLight"),
  PointLight: () => import("./Components/PointLight/PointLight"),
  CabinetLink: () => import("./Components/CabinetLink/CabinetLink"),
  NeonSign: () => import("./Components/NeonSign/NeonSign"),
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
  // Room atmosphere: the scene-wide effects and the aimed light + audio that
  // turn a box with cabinets in it into an arcade hall. All free core.
  SpotLight: () => import("./Components/SpotLight/SpotLight"),
  Fog: () => import("./Components/Fog/Fog"),
  GlowLayer: () => import("./Components/GlowLayer/GlowLayer"),
  AmbientOcclusion: () => import("./Components/AmbientOcclusion/AmbientOcclusion"),
  Sound: () => import("./Components/Sound/Sound"),
  Animation: () => import("./Components/Animation/Animation"),
  Mesh: () => import("./Components/Mesh/Mesh"),
  // A free collision footprint, declared per entity in scene data (every wall,
  // cabinet and prop in a walk-around room carries one) and read by the
  // movement systems through collectObstacleBoxes. Pure data — it has no
  // System of its own, like Enemy.
  Obstacle: () => import("./Components/Obstacle/Obstacle"),
  // Free generic AI + pooling primitives.
  EntityPool: () => import("./Components/EntityPool/EntityPool"),
  Pool: () => import("./Components/Pool/Pool"),
  Enemy: () => import("./Components/Enemy/Enemy"),
  TwinStickEnemy: () => import("./Components/TwinStickEnemy/TwinStickEnemy"),
  LineOfSight: () => import("./Components/LineOfSight/LineOfSight"),
  // NOTE: premium gameplay components are NOT registered here — they are paid
  // marketplace components a project acquires via the download flow and registers
  // in its own per-game registry (see games' soccer / spaceshooter / shooter / pinball
  // cabinets, which vendor them under src/.../<game>/components). That now includes
  // the whole PINBALL kit (table/flipper/bumper/plunger/…) and the SHOOTER kit
  // (Bullet/BulletPool/TwinStickShooter/ShooterCamera/EnemySpawner/SkeletonAnimator/
  // ObstacleField) — previously bundled free, now premium. This free registry is
  // the "build-a-room" core only: mesh/material loading, cameras, movement, lights,
  // shadows, the room's atmosphere (fog, glow, SSAO, spot lights, sound), plus
  // the generic AI/pooling primitives above.
};

export const ARCADE_COMPONENT_NAMES = Object.keys(ARCADE_COMPONENT_REGISTRY);
