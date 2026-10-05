/**
 * SHARED EVENT DICTIONARY — the EventBus names of the FREE arcade components.
 *
 * A component that LISTENS to another does NOT import the emitter's component
 * file; both sides import the event-name constant from here. The EventBus
 * decouples components at runtime; routing the name through a dictionary makes
 * that true at compile time too. `no-cross-component-event-import` enforces it.
 *
 * Only names a free arcade component emits or listens to belong here. A
 * marketplace component keeps its names beside it, in
 * `Components/<Name>/<Name>.events.ts` in CodeLibrary: `bjs download` hands
 * that file out free and it is not a dependency to buy. So a new marketplace
 * component never needs an arcade release. `npm run audit:events` fails if a
 * name here has no arcade emitter or listener.
 */
// AmbientOcclusionEvents — from AmbientOcclusion
export const AmbientOcclusionEvents = {
  /** The SSAO pass is live with the component's settings. `{ entityId }`. */
  APPLIED: 'ambientocclusion.applied',
  /**
   * Nothing can run the pass: no adapter plugin was registered, or the engine
   * can't do SSAO2 (WebGL1). Fired once; the scene renders without contact
   * shadows. `{ entityId, reason }`.
   */
  UNSUPPORTED: 'ambientocclusion.unsupported',
  /** The pass was torn down (component removed or disabled). `{ entityId }`. */
  CLEARED: 'ambientocclusion.cleared',
} as const;
// AnimationEvents — from Animation
export const AnimationEvents = {
  /** Fired the frame the dominant clip flips (e.g., idle → walk). */
  STATE_CHANGED: 'animation.state.changed',
  /** Fired every frame with the current blend weights. Useful for HUDs. */
  BLEND_UPDATED: 'animation.blend.updated',
  /** Fired once after the component has wired up to an animation set. */
  READY: 'animation.ready',
} as const;
// AnimationInputEvents — from Animation
export const AnimationInputEvents = {
  /** External producer (MovementSystem, StrideSystem, AI) pushes a speed. */
  SET_SPEED: 'animation.speed.set',
} as const;
// ArcCameraEvents — from ArcCamera
export const ArcCameraEvents = {
  CREATED: 'arccamera.created',
  MOVED: 'arccamera.moved',
  ROTATED: 'arccamera.rotated',
  ZOOMED: 'arccamera.zoomed',
  TARGET_CHANGED: 'arccamera.target.changed',
} as const;
// CameraFollowEvents — from CameraFollow
export const CameraFollowEvents = {
  TARGET_CHANGED: 'cameraFollow.targetChanged',
} as const;
// DirectionalLightEvents — from DirectionalLight
export const DirectionalLightEvents = {
  CREATED: 'directionallight.created',
  DIRECTION_CHANGED: 'directionallight.direction.changed',
  INTENSITY_CHANGED: 'directionallight.intensity.changed',
  COLOR_CHANGED: 'directionallight.color.changed',
  SHADOW_CREATED: 'directionallight.shadow.created',
} as const;
// EnemyEvents — from Enemy
export const EnemyEvents = {
  KILLED: 'enemy.killed',
} as const
// EntityPoolEvents — from EntityPool
export const EntityPoolEvents = {
  /** Emitted once per pool after it finishes pre-allocating. `{ pool, size }`. */
  READY: 'entityPool.ready',
  /** Emitted when a slot is acquired and placed. `{ pool, entityId, spawnerId? }`. */
  SPAWNED: 'entityPool.spawned',
  /**
   * Emitted during reset (after config re-apply + positioning) so game systems
   * can apply per-spawn dynamics. `{ pool, entityId, data }` (data = spawn event).
   */
  ACQUIRED: 'entityPool.acquired',
  /** Emitted when an entity is parked back into the pool. `{ pool, entityId }`. */
  RELEASED: 'entityPool.released',
  /** Emitted when a spawn can't be served (every slot live). `{ pool }`. */
  EXHAUSTED: 'entityPool.exhausted',
} as const
// EntityPoolInputEvents — from EntityPool
export const EntityPoolInputEvents = {
  /** Place a live entity from a pool. `{ pool, x, y, z, spawnerId?, ...overrides }`. */
  SPAWN: 'entityPool.spawn',
  /** Park the entity `entityId` back into its pool. `{ entityId }`. */
  RELEASE: 'entityPool.release',
} as const
// PoolEvents — from Pool (the blueprint-driven entity factory)
export const PoolEvents = {
  /** Emitted once per pool after it finishes pre-allocating its slots. `{ pool, size }`. */
  READY: 'pool.ready',
  /** Emitted when a slot is acquired (via SPAWN). `{ pool, entityId, spawnerId? }`. */
  SPAWNED: 'pool.spawned',
  /**
   * Emitted during reset (after the blueprint config is re-applied) so game
   * systems can apply per-spawn dynamics. `{ pool, entityId, data }`.
   */
  ACQUIRED: 'pool.acquired',
  /** Emitted when a slot is parked back into the pool. `{ pool, entityId }`. */
  RELEASED: 'pool.released',
  /** Emitted when a spawn can't be served (every slot live). `{ pool }`. */
  EXHAUSTED: 'pool.exhausted',
} as const
// PoolInputEvents — from Pool
export const PoolInputEvents = {
  /** Acquire + place a live entity from a pool. `{ pool, x, y, z, spawnerId?, ...overrides }`. */
  SPAWN: 'pool.spawn',
  /** Park the entity `entityId` back into its pool. `{ entityId }`. */
  RELEASE: 'pool.release',
} as const
// HealthEvents — from Health
export const HealthEvents = {
  /** Fired after HP changes (damage absorbed or healed). */
  DAMAGED: 'health.damaged',
  HEALED: 'health.healed',
  /** Fired the frame HP first hits 0, BEFORE any respawn happens. */
  DIED: 'health.died',
  /** Fired when a respawn-configured entity has been reset to full HP. */
  RESPAWNED: 'health.respawned',
} as const
// HealthInputEvents — from Health
export const HealthInputEvents = {
  /** Payload: { entityId: string, damage: number }. */
  DAMAGE: 'health.damage',
  /** Payload: { entityId: string, amount: number }. */
  HEAL: 'health.heal',
} as const
// HemisphericLightEvents — from HemisphericLight
export const HemisphericLightEvents = {
  CREATED: 'hemisphericlight.created',
  INTENSITY_CHANGED: 'hemisphericlight.intensity.changed',
} as const;
// NeonSignEvents — from NeonSign
export const NeonSignEvents = {
  CREATED: 'neonsign.created',
  /** The sign's text changed; payload `{ entityId, text }`. */
  TEXT_CHANGED: 'neonsign.text.changed',
  /**
   * The tube colour changed — lettering and light recoloured together.
   * Payload `{ entityId, color }`.
   */
  COLOR_CHANGED: 'neonsign.color.changed',
  /**
   * The lettering is real extruded geometry: the `neonText` adapter plugin
   * built it. With no plugin registered (a Three host, a bootstrap that
   * forgot) the sign quietly falls back to a label quad and this never fires.
   * Payload `{ entityId, text }`.
   */
  EXTRUDED: 'neonsign.extruded',
} as const;
// CabinetLinkEvents — from CabinetLink
export const CabinetLinkEvents = {
  /** A cabinet was single-clicked; the player is walking over. */
  FOCUSED: 'cabinetlink.focused',
  /**
   * A cabinet was double-clicked: start its game. Payload carries the `game`
   * key and its `route`. The host app decides what that means (the create-arcade
   * scaffold pushes the route and swaps scenes), so this component never
   * touches the router.
   */
  LAUNCH: 'cabinetlink.launch',
  /**
   * The confirming click landed but the player is still further from the
   * machine than its `launchDistance`. Nothing launches; the walk the first
   * click started keeps going, so the player simply arrives closer and tries
   * again. Payload `{ entityId, game, title, distance, launchDistance }`.
   */
  OUT_OF_RANGE: 'cabinetlink.launch.outofrange',
} as const;
// FirstPersonCameraEvents — from FirstPersonCamera
export const FirstPersonCameraEvents = {
  /**
   * The walking camera exists. Payload `{ entityId, handle }` — `handle` is the
   * renderer's camera handle, so anything that must follow the player's ears or
   * eyes (Sound's audio listener) can attach to it without asking the System.
   */
  CREATED: 'firstpersoncamera.created',
  /**
   * Ask the walking camera to WALK ITSELF to a spot: `{ x, z, yaw? }`. It
   * paths there at its own moveSpeed/turnSpeed rather than teleporting, and any
   * movement key cancels it — the player is never trapped in an animation.
   */
  GOTO: 'firstpersoncamera.goto',
  /**
   * Emitted once the camera reaches a GOTO target, or gives one up: payload
   * `{ entityId, x, z, yaw, cancelled }`, where `cancelled` is true when a
   * movement key took over or an Obstacle blocked the path for good.
   */
  ARRIVED: 'firstpersoncamera.arrived',
} as const;
// FogEvents — from Fog
export const FogEvents = {
  /** Fog is on with the component's current settings. `{ entityId, mode, density }`. */
  APPLIED: 'fog.applied',
  /** Fog was switched off (component removed or `enabled` false). `{ entityId }`. */
  CLEARED: 'fog.cleared',
} as const;
// GlowLayerEvents — from GlowLayer
export const GlowLayerEvents = {
  /** The glow pass is up with the component's intensity. `{ entityId, intensity }`. */
  APPLIED: 'glowlayer.applied',
  /**
   * A mesh was whitelisted into the glow pass. The adapter's layer starts EMPTY,
   * so this fires once per mesh the system enrols — it is the only way a
   * screen or a neon tube gets to bloom. `{ entityId, meshEntityId }`.
   */
  MESH_ENROLLED: 'glowlayer.mesh.enrolled',
  /** The glow pass was torn down. `{ entityId }`. */
  CLEARED: 'glowlayer.cleared',
} as const;
// PointLightEvents — from PointLight
export const PointLightEvents = {
  CREATED: 'pointlight.created',
  INTENSITY_CHANGED: 'pointlight.intensity.changed',
  MOVED: 'pointlight.moved',
} as const;
// JumpEvents — from Jump
export const JumpEvents = {
  /** Fired the frame the character leaves the ground. Payload: {@link JumpStartedEvent}. */
  STARTED: 'jump.started',
  /** Fired the frame the character lands. Payload: `{ entityId }`. */
  LANDED: 'jump.landed',
} as const;
// JumpInputEvents — from Jump
export const JumpInputEvents = {
  /** Request a jump for an entity (alongside the configured key). Payload: `{ entityId? }`. */
  JUMP: 'jump.request',
} as const;
// LineOfSightEvents — from LineOfSight
export const LineOfSightEvents = {
  ACQUIRED: 'lineofsight.acquired',
  LOST: 'lineofsight.lost',
} as const
// LineOfSightInputEvents — from LineOfSight
export const LineOfSightInputEvents = {
  SET_DEBUG_RAYS: 'lineofsight.debugrays.set',
} as const
// MeshEvents — from Mesh
export const MeshEvents = {
  /** A load request has been dispatched to the renderer. */
  LOADING: 'mesh.loading',
  /**
   * The model finished loading — `meshId` is now valid for animation calls,
   * and `handle` is the renderer handle for the loaded root (Shadow attaches
   * its caster to this so a GLB can shadow in place of a hidden proxy).
   */
  LOADED: 'mesh.loaded',
  /** The renderer rejected the load. `error` has the message. */
  ERROR: 'mesh.error',
} as const;
// MeshInputEvents — from Mesh
export const MeshInputEvents = {
  /**
   * Show or hide the loaded model. Payload: `{ entityId, visible }`.
   *
   * The model is the vehicle's PICTURE when a MeshPrimitive beside it is a
   * hidden gameplay proxy. Anything swapping a silhouette must hide THIS —
   * hiding the proxy achieves nothing visible, and un-hiding it puts a bare
   * collision box on screen.
   */
  SET_VISIBLE: 'mesh.visible.set',
  /** Kick a load for the matching entity. Payload: `{ entityId, src? }`. */
  LOAD: 'mesh.load',
  /**
   * Freeze / release a followed mesh's facing. While locked the follow holds
   * its current yaw instead of turning toward movement — e.g. a strafe mode
   * where the character keeps facing forward while stepping sideways.
   * Payload: `{ entityId, locked }`.
   */
  FACE_LOCK: 'mesh.faceLock',
} as const;
// MeshPrimitiveEvents — from MeshPrimitive
export const MeshPrimitiveEvents = {
  CREATED: 'meshprimitive.created',
  MATERIAL_APPLIED: 'meshprimitive.material.applied',
  DISPOSED: 'meshprimitive.disposed',
} as const;
// MeshPrimitiveInputEvents — from MeshPrimitive
export const MeshPrimitiveInputEvents = {
  CREATE: 'meshprimitive.create',
  SET_POSITION: 'meshprimitive.position.set',
  SET_SCALE: 'meshprimitive.scale.set',
  SET_COLOR: 'meshprimitive.color.set',
  SET_VISIBLE: 'meshprimitive.visible.set',
  DISPOSE: 'meshprimitive.dispose',
} as const;
// MovementEvents — from Movement
export const MovementEvents = {
  /** Emitted the frame the character leaves the ground via jump. */
  JUMP_STARTED: 'movement.jump.started',
  /** Emitted whenever the grounded state flips. Payload: { isGrounded }. */
  GROUNDED_CHANGED: 'movement.grounded.changed',
  /** Emitted the frame the character transitions from still to moving. */
  STARTED_MOVING: 'movement.started',
  /** Emitted the frame the character transitions from moving to still. */
  STOPPED_MOVING: 'movement.stopped',
} as const;
// MovementInputEvents — from Movement
export const MovementInputEvents = {
  /** External move intent. Payload: `{ entityId, x, y?, z }`. XZ plane only. */
  SET_MOVEMENT_VECTOR: 'input.movement.vector',
  /** External jump request. Payload: `{ entityId }`. Edge-triggered. */
  JUMP_REQUESTED: 'input.jump.requested',
} as const;
// PhysicsEvents — from Physics
export const PhysicsEvents = {
  /** Emitted once the adapter has successfully created a rigid body for the entity. */
  BODY_CREATED: 'physics.body.created',
  /** Emitted when an entity's rigid body has been disposed. */
  BODY_DISPOSED: 'physics.body.disposed',
} as const;
// PhysicsInputEvents — from Physics
export const PhysicsInputEvents = {
  /** Directly set a body's linear velocity. Payload: { entityId, vx, vy, vz }. */
  SET_VELOCITY: 'physics.setVelocity',
  /** Pause all physics stepping. Payload: {}. */
  PAUSE: 'physics.pause',
  /** Resume physics stepping. Payload: {}. */
  RESUME: 'physics.resume',
  /**
   * Reconfigure the engine's fixed simulation rate. Payload: { hz }. Higher
   * Hz = smaller substep → fewer tunneling artifacts at the cost of CPU.
   * Adapters without a configurable rate (Three/Mock) no-op.
   */
  SET_TIME_STEP: 'physics.setTimeStep',
  /** Set the world gravity vector. Payload: { x, y, z }. */
  SET_GRAVITY: 'physics.setGravity',
  /** Set a body's restitution (bounciness). Payload: { entityId, restitution }. */
  SET_RESTITUTION: 'physics.setRestitution',
  /** Toggle wireframe outlines of every collider. Payload: { visible }. */
  SET_COLLIDERS_VISIBLE: 'physics.setCollidersVisible',
} as const;
// PlayerInputEvents — from PlayerInput
export const PlayerInputEvents = {
  ACTION_PRESSED: 'playerInput.actionPressed',
  ACTION_RELEASED: 'playerInput.actionReleased',
  MOVE_CHANGED: 'playerInput.moveChanged',
  SOURCE_CHANGED: 'playerInput.sourceChanged',
} as const;
// PlayerInputInputEvents — from PlayerInput
export const PlayerInputInputEvents = {
  SET_ENABLED: 'playerInput.setEnabled',
} as const;
// ScoreboardEvents — from Scoreboard
export const ScoreboardEvents = {
  /** Emitted after the core rebuilds its rows; payload carries the snapshot. */
  UPDATED: 'scoreboard.updated',
} as const;
// ScoreboardInputEvents — from Scoreboard
export const ScoreboardInputEvents = {
  /** Public Score-system event — `{ ownerEntity, score, allScores }`. */
  SCORE_CHANGED: 'score.changed',
  /** Public Score-system event — clears every row to zero. */
  SCORE_RESET: 'score.reset',
} as const;
// ScoreEvents — from Score
export const ScoreEvents = {
  /** Fired when any player's score changes. */
  CHANGED: 'score.changed',
  /** Fired once when every bucket is cleared. */
  RESET: 'score.reset',
} as const;
// ScoreInputEvents — from Score
export const ScoreInputEvents = {
  /** Direct request to award points. `{ ownerEntity, points? }`. */
  ADD: 'score.add',
  /** External request to clear every player's score. `{}`. */
  RESET: 'score.resetRequest',
  /**
   * Score also listens to goal.scored so Goal mechanic scenes just work out
   * of the box — no middle-man system needed to route points from the net
   * into the scoreboard.
   */
  GOAL_SCORED: 'goal.scored',
} as const;
// ShadowEvents — from Shadow
export const ShadowEvents = {
  SHADOW_ENABLED: 'shadow.enabled',
  SHADOW_DISABLED: 'shadow.disabled',
  SHADOW_CASTER_ADDED: 'shadow.caster.added',
} as const;
// SkyboxEvents — from Skybox
export const SkyboxEvents = {
  CREATED: 'skybox.created',
  SUN_CHANGED: 'skybox.sun.changed',
} as const;
// SoundEvents — from Sound
export const SoundEvents = {
  /** The clip loaded and has a live handle. `{ entityId, src }`. */
  READY: 'sound.ready',
  /**
   * The audio engine refused to start — no WebAudio, or the browser is holding
   * it behind a user gesture. Fired once per world; the system retries on the
   * first click/key and goes quiet in between. `{ }`.
   */
  BLOCKED: 'sound.blocked',
  /** The clip could not be fetched or decoded; it will not be retried. `{ entityId, src }`. */
  ERROR: 'sound.error',
} as const;
// SoundInputEvents — from Sound
export const SoundInputEvents = {
  /** Start (or restart from the top) an entity's sound. `{ entityId }`. */
  PLAY: 'sound.play',
  /** Stop an entity's sound. `{ entityId }`. */
  STOP: 'sound.stop',
  /** Set an entity's gain at runtime. `{ entityId, volume }`. */
  SET_VOLUME: 'sound.volume.set',
} as const;
// SpotLightEvents — from SpotLight
export const SpotLightEvents = {
  CREATED: 'spotlight.created',
  INTENSITY_CHANGED: 'spotlight.intensity.changed',
  MOVED: 'spotlight.moved',
} as const;

// ── Emitted by marketplace components, but heard by free ones here ──
// TwinStickEnemy (free) listens for bullet hits and drives SkeletonAnimator, so
// these names stay in arcade. That is the bar: a free arcade component must
// emit or hear it.
/** Bullet impact observer (damage itself routes through HealthSystem). */
export const BulletEvents = {
  HIT: 'bullet.hit',
} as const;

/** Skeletal-animation drive + completion (premium SkeletonAnimator). */
export const SkeletonAnimatorInputEvents = {
  SET_LOOP: 'skeletonAnimator.setLoop',
  PLAY_ONCE: 'skeletonAnimator.playOnce',
} as const;
export const SkeletonAnimatorEvents = {
  COMPLETED: 'skeletonAnimator.completed',
} as const;
