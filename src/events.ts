/**
 * SHARED EVENT DICTIONARY — the single source of truth for every cross-component
 * EventBus name in the arcade core.
 *
 * A component that LISTENS to another does NOT import the emitter's component
 * file; both sides import the event-name constant from HERE. The EventBus is
 * meant to decouple components at runtime — routing the name through a shared
 * dictionary makes that true at COMPILE time too (no import edge just to share a
 * string). The eslint rule `no-cross-component-event-import` enforces it.
 *
 * Event NAMES are an open protocol and live here even when the emitting
 * component is a PAID marketplace component (Bullet, SkeletonAnimator, …): the
 * name is the free contract, the implementation is what's premium. So a free AI
 * component can react to a paid component's events without importing it.
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

// ── Protocol events for PREMIUM emitters (implementations ship vendored per
// game; the NAMES live here so free components can interoperate). ──
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


// ────────────────────────────────────────────────────────────────────────────
// PREMIUM-CLUSTER PROTOCOL EVENTS. The emitting components (poker, pinball,
// soccer, spaceshooter, shooter) ship as PAID marketplace downloads, but their event
// NAMES live here so any component — free or paid — can listen without importing
// the emitter. Names only; the implementations stay premium.
// ────────────────────────────────────────────────────────────────────────────

// ShooterEvents — protocol for premium Shooter
export const ShooterEvents = {
  /** A shot left the barrel. `{ entityId, position, direction, heat, heatRatio, ownerTeam, color }`. */
  FIRED: 'shooter.fired',
  /** The shot that just left tipped the weapon into overheat. `{ entityId }`. */
  OVERHEATED: 'shooter.overheated',
  /** The overheat cooldown window finished and the weapon is firing-ready. `{ entityId }`. */
  READY: 'shooter.ready',
  /**
   * Emitted every frame heat changes by at least ~10% of max. Useful for
   * HUDs that don't want per-frame updates. `{ entityId, heat, heatRatio }`.
   */
  HEAT_CHANGED: 'shooter.heatChanged',
} as const;

// ShooterInputEvents — protocol for premium Shooter
export const ShooterInputEvents = {
  /**
   * External request to fire the weapon. Payload includes the spawn
   * position, direction, and optional owner/team/color echoed back on
   * `shooter.fired` so downstream projectile systems can consume it.
   */
  FIRE_REQUEST: 'shooter.fireRequest',
} as const;

// GoalEvents — protocol for premium Goal
export const GoalEvents = {
  /** Emitted on the frame the ball first enters the goal volume. */
  SCORED: 'goal.scored',
  /** Emitted when the System teleports the ball after a score. */
  BALL_RESET: 'goal.ball.reset',
  /** Companion event carrying the delta for any downstream Score system. */
  SCORE_ADDED: 'goal.score.added',
} as const;

// GoalInputEvents — protocol for premium Goal
export const GoalInputEvents = {
  /** External reset — clears score counter and cooldown on every Goal. */
  RESET: 'goal.reset',
} as const;

// AIZoneInputEvents — protocol for premium AIZone
export const AIZoneInputEvents = {
  /** External teleport request — drops the entity at an absolute XZ position. */
  RECENTER: 'aiZone.recenter',
} as const;

// BallPossessionInputEvents — protocol for premium BallPossession
export const BallPossessionInputEvents = {
  /** External reset — clears possessor + timers on every BallPossession entity. */
  RESET: 'possession.reset',
} as const;

// BulletPoolInputEvents — protocol for premium BulletPool
export const BulletPoolInputEvents = {
  /** Ask the pool to place a bullet at a muzzle position, travelling (dx,dz). */
  FIRE: 'bulletPool.fire',
} as const



// PinballTableEvents — protocol for premium PinballTable
export const PinballTableEvents = {
  /** Fired after the component's width/depth change. */
  RESIZED: 'pinballTable.resized',
} as const



// PinballBuilderInputEvents — protocol for premium PinballBuilder
export const PinballBuilderInputEvents = {
  /** Spawn a pop-bumper. */
  ADD_BUMPER: 'pinballBuilder.addBumper',
  /**
   * Spawn a thick perimeter-style wall (the dark purple boxes around the
   * play area). For sealing rooms / dividing zones.
   */
  ADD_WALL: 'pinballBuilder.addWall',
  /**
   * Spawn a thin elevated wire rail (a chrome wire the ball rolls along
   * the TOP of). Real machines use these for cross-playfield ball paths.
   * Distinct from a wall — a rail is suspended ABOVE the playfield.
   */
  ADD_RAIL: 'pinballBuilder.addRail',
  /**
   * Spawn an angled solid floor segment — built INTO the playfield. The
   * ball rolls up or down its surface. Combine multiple to bridge layers.
   */
  ADD_RAMP: 'pinballBuilder.addRamp',
  /** Spawn a spinner bar. */
  ADD_SPINNER: 'pinballBuilder.addSpinner',
  /** Spawn a saucer / mouse-hole. */
  ADD_MOUSEHOLE: 'pinballBuilder.addMouseHole',
  /**
   * Toggle freehand draw mode. Pinball.tsx hooks canvas pointer events
   * when enabled and emits DRAW_PATH on release with the captured XZ
   * polyline. `kind` selects which element type each segment becomes.
   */
  SET_DRAW_MODE: 'pinballBuilder.setDrawMode',
  /**
   * Drop a freehand path. The system smooths the points with a
   * Catmull-Rom spline, resamples at regular intervals, and chains
   * one rail/wall segment per interval so a curved wire follows the
   * drawn line. Payload: { points: [{x,z}, ...], kind, ...config }.
   */
  DRAW_PATH: 'pinballBuilder.drawPath',
} as const



// P2PNetworkEvents — protocol for premium P2PNetwork
export const P2PNetworkEvents = {
  /** The network finished connecting (or failed) — `{ connected, seats }`. */
  CONNECTED: 'net.connected',
  /** A peer's data channel opened — `{ seat }`. */
  PEER_JOINED: 'net.peerJoined',
  /** A peer's data channel closed — `{ seat }`. */
  PEER_LEFT: 'net.peerLeft',
  /** The live occupied-seat set changed — `{ occupiedSeats }`. */
  SEATS_CHANGED: 'net.seatsChanged',
  /** A peer message arrived off the wire — `{ fromSeat, msg }`. */
  MESSAGE: 'net.message',
} as const;

// P2PNetworkInputEvents — protocol for premium P2PNetwork
export const P2PNetworkInputEvents = {
  /** Send a message to every open peer channel — `{ msg }`. */
  BROADCAST: 'net.broadcast',
} as const;

// PokerBettingEvents — protocol for premium PokerBetting
export const PokerBettingEvents = {
  /** Fired after any chip movement — stacks + pot snapshot. */
  CHIPS: 'poker.chips',
  /** Fired when the active seat changes — `{ playerId }` (null when nobody is up). */
  CURRENT_TURN: 'poker.currentTurn',
  /** Fired when a human seat must choose — `{ playerId, actions }`. */
  ACTION_REQUIRED: 'poker.actionRequired',
  /**
   * Fired once per seat that acts — `{ playerId, action }`. A distinct name from
   * the `poker.turnAction` *input* so the System never re-hears its own
   * emissions on a shared bus.
   */
  ACTION_TAKEN: 'poker.actionTaken',
  /** Fired when the hand ends early on the last fold — `{ winnerId }`. */
  HAND_OVER: 'poker.handOver',
} as const;

// PokerBettingInputEvents — protocol for premium PokerBetting
export const PokerBettingInputEvents = {
  /** Start a hand: build chips, collect antes, open the first betting round. */
  DEAL_REQUEST: 'poker.dealRequest',
  /**
   * Open the NEXT street's betting round on the live hand — clear this round's
   * bets into the pot, rebuild the round from the still-active seats (folds
   * preserved), and step the leading NPCs. The director fires this once per
   * street after the first (preflop opens with `DEAL_REQUEST`; flop / turn /
   * river each open with this). A no-op before a deal builds the chips/round.
   * `{}`.
   */
  NEXT_ROUND_REQUEST: 'poker.nextRoundRequest',
  /** A HUD button submitted the waiting human's choice — `{ type }`. */
  ACTION_SUBMITTED: 'poker.actionSubmitted',
  /** A raw turn action for the current seat — `{ playerId?, action }`. */
  TURN_ACTION: 'poker.turnAction',
} as const;

// PokerHandEvalEvents — protocol for premium PokerHandEval
export const PokerHandEvalEvents = {
  /** Fired after a showdown request is resolved. */
  RESOLVED: 'poker.showdown.resolved',
} as const;

// PokerHandEvalInputEvents — protocol for premium PokerHandEval
export const PokerHandEvalInputEvents = {
  /** Request a showdown resolution. Payload: {@link ShowdownRequest}. */
  REQUEST: 'poker.showdown.request',
} as const;

// PokerTableDirectorInputEvents — protocol for premium PokerTableDirector
export const PokerTableDirectorInputEvents = {
  /** Confirm the next hand should be dealt (e.g. a Space key). `{}`. */
  DEAL: 'pokerTable.deal',
  /** Restore every seat to the starting stack and re-arm. `{}`. */
  MATCH_RESET: 'pokerTable.matchReset',
} as const;

// DeckDealerEvents — protocol for premium DeckDealer
export const DeckDealerEvents = {
  /** Fired for each card that lands. Payload: card, target, remaining. */
  DEALT: 'deck.dealt',
  /** Fired once the deck is reshuffled and the table is cleared. */
  RESET: 'deck.reset',
} as const;

// DeckDealerInputEvents — protocol for premium DeckDealer
export const DeckDealerInputEvents = {
  /** Request to deal — `{ all?: boolean }`. Omit `all` to deal one card. */
  DEAL_REQUEST: 'deck.dealRequest',
  /** Request to reshuffle and clear every hand. `{}`. */
  RESET_REQUEST: 'deck.resetRequest',
} as const;

// CardFanInputEvents — protocol for premium CardFan
export const CardFanInputEvents = {
  /**
   * Deal a hand. Payload: `{ cards: string[] }` — one card id per slot, in
   * deal order. Extra ids past the slot count are ignored; missing ids leave a
   * slot face-down with no face.
   */
  DEAL: 'cardfan.deal',
  /**
   * Flip cards. Payload: `{ index: number }` for a single card, or
   * `{ indices: number[], startDelay?, interval? }` to auto-flip a group in
   * sequence.
   */
  FLIP: 'cardfan.flip',
  /** Clear the hand and dispose loaded textures. Payload: `{}`. */
  RESET: 'cardfan.reset',
} as const;

// WaypointEvents — protocol for premium Waypoint
export const WaypointEvents = {
  /** Player flew through the active gate. payload: { index, total, x, y, z }. */
  REACHED: 'spaceshooter.waypoint.reached',
  /** Player crossed past the active gate's plane without entering it.
   *  payload: { index, total, x, y, z }. */
  MISSED: 'spaceshooter.waypoint.missed',
  /** The final gate was reached — the track is done. payload: { total }. */
  COMPLETED: 'spaceshooter.track.completed',
} as const;

// PartsEvents — the per-part damage protocol for ships built from destructible
// parts. Emitted by the bullet-impact and kill paths; listened to by damage FX
// (which sheds the mesh) and by HUD part-damage readouts. Lives here rather than in
// Parts.core so a listener never imports the emitter's file
// (no-cross-component-event-import).
export const PartsEvents = {
  /** A part dropped to 0 HP and detached. payload: { entityId, part, x, y, z, meshSuffixes }. */
  DESTROYED: 'spaceshooter.part.destroyed',
} as const;

// MissionDirectorEvents — the run's outcome, broadcast by the mission brain. A HUD,
// an end-of-run screen, an achievement tracker and a scene-reset director are all
// legitimate listeners, so the names live here rather than in MissionDirector.core —
// none of them should have to import the brain to know the run ended.
export const MissionDirectorEvents = {
  /** The run was won. payload: MissionSnapshot (status === 'won'). */
  WON: 'mission.won',
  /** The run was lost. payload: MissionSnapshot (status === 'lost'). */
  LOST: 'mission.lost',
  /** Any tracked figure moved. payload: MissionSnapshot. */
  STATE_CHANGED: 'mission.stateChanged',
} as const;

// FreighterEvents — mission progress for a snake-style escort convoy. The LOSS side
// already lives on SpaceShooterHealthEvents (FREIGHTER_KILLED / FREIGHTER_CAR_LOST,
// emitted by the kill path); this is the WIN side, emitted when the convoy actually
// arrives. Here rather than in FreighterChain.core so the mission brain can name it
// without importing the component (no-cross-component-event-import).
export const FreighterEvents = {
  /** The convoy reached the final gate. payload: { freighterId, waypointIndex }. */
  DELIVERED: 'spaceshooter.freighter.delivered',
} as const;

// MissileEvents — the detonation protocol for the premium Missile component,
// emitted by its guidance/impact systems. Lives here rather than in Missile.core
// so an FX or audio listener never has to import the emitter's file
// (no-cross-component-event-import), exactly like SpaceShooterHealthEvents below.
export const MissileEvents = {
  /** A missile detonated on its target. payload: { missileId, targetId, x, y, z }. */
  EXPLODED: 'spaceshooter.missile.exploded',
  /** A missile flew past closest approach without detonating; ammo lost. payload: { missileId }. */
  WASTED: 'spaceshooter.missile.wasted',
} as const;

// MissileLauncherEvents — the launch protocol, emitted on every shot for the
// HUD, the launch-flash FX and audio. Here for the same reason as MissileEvents.
export const MissileLauncherEvents = {
  /** A missile left the rail. payload: { missileId, targetId, ammoRemaining, x, y, z }. */
  FIRED: 'spaceshooter.missile.fired',
} as const;

// RoundResetEvents — the round-lifecycle protocol. Emitted by RoundReset, the
// generic "you died, start over" component every game needs. The interesting one
// is REQUEST: reloading a scene is a HOST capability (only whoever built the game
// owns the canvas, the adapter and the registry), so a component cannot do it
// itself. RoundReset asks; the host answers. Kept here rather than in
// RoundReset.core so a listener never imports the emitter's file
// (no-cross-component-event-import).
export const RoundResetEvents = {
  /**
   * The round is over and the linger has started — the window where the wreck is
   * still on screen and nothing has been torn down yet. The HUD draws its death
   * overlay off this. payload: { lingerSeconds }.
   */
  PENDING: 'round.reset.pending',
  /**
   * The linger elapsed: rebuild the scene NOW. Imperative, because the host is
   * being told to act, not informed that something happened. payload: {}.
   */
  REQUEST: 'round.reset.request',
} as const;

// RoundResetInputEvents — what RoundReset listens for. The canonical
// cross-game death signal is `game.player.died`; a subgenre with its own name
// for the same fact (the space shooter emits `spaceshooter.player.killed`) points
// RoundReset at it with the component's `on` list rather than emitting a second,
// duplicate event for one fact.
export const RoundResetInputEvents = {
  /** The player died and the round should end. payload: ignored. */
  PLAYER_DIED: 'game.player.died',
} as const;

// CameraShakeEvents — trauma-based camera shake. The IMPULSE input is what any
// component with something worth feeling (an explosion, a hit, a hard landing)
// emits; CameraShake adds it to its trauma and decays it. The name lives here so
// an emitter never imports CameraShake's file to shake the camera
// (no-cross-component-event-import) — the whole point of the component is that
// anything can drive it.
export const CameraShakeInputEvents = {
  /** Add trauma, clamped into [0, 1] after the add. payload: { impulse }. */
  IMPULSE: 'cameraShake.impulse',
} as const;

export const CameraShakeEvents = {
  /** Trauma moved. payload: { entityId, trauma }. */
  TRAUMA_CHANGED: 'cameraShake.traumaChanged',
} as const;

// SpaceShooterHealthEvents — the ship-death protocol for the space-shooter
// subgenre (6-DOF dogfighters like the Spaceshooter set). Emitted by the shared
// `destroyShip` kill path in the premium SpaceShooterHealth component; listened
// to by MissionDirector (win/loss), WaveDirector (wave progression) and
// SpaceShooterScore (kill tally). Lives here — not in SpaceShooterHealth — so a
// listener never imports the emitter's file (no-cross-component-event-import),
// exactly like WaypointEvents above.
export const SpaceShooterHealthEvents = {
  /** A world-space explosion burst. payload: { x, y, z, vx, vy, vz }. */
  EXPLOSION: 'spaceshooter.explosion',
  /** The player ship died. payload: { id }. */
  PLAYER_KILLED: 'spaceshooter.player.killed',
  /** The player's primitives should blow apart at the death site.
   *  payload: { x, y, z, vx, vy, vz }. */
  PLAYER_BLOWNAPART: 'spaceshooter.player.blownapart',
  /** An enemy ship died. payload: { targetId }. */
  ENEMY_KILLED: 'spaceshooter.enemy.killed',
  /** The freighter head (escort target) died. payload: { id }. */
  FREIGHTER_KILLED: 'spaceshooter.freighter.killed',
  /** A freighter cargo car was lost. payload: { id }. */
  FREIGHTER_CAR_LOST: 'spaceshooter.freighter.car.lost',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Gravity golf — the n-body set (GravityMass / GravityBody / MassDriver /
// CaptureZone / TrajectoryPreview), the two-view camera and pointer drag it is
// steered with, and the SpaceGolf director + HUD that make a game of it. Names
// live here for the usual reason: the HUD listens to six emitters and imports
// none of them.
// ─────────────────────────────────────────────────────────────────────────────

// GravityEvents — from GravityBody (the n-body integrator).
export const GravityEvents = {
  /**
   * A GravityBody touched the surface of a GravityMass. `swallowed` is true when
   * that mass `absorbs` (an event horizon) and false for a solid crash. The body
   * has already been released when this fires.
   * payload: { bodyId, massId, swallowed, x, y, z, vx, vy, vz }.
   */
  CONTACT: 'gravity.body.contact',
} as const;

// MassDriverEvents — from MassDriver (the pooled-body launcher).
export const MassDriverEvents = {
  /** A body left the muzzle. payload: { driverId, entityId, x, y, z, vx, vy, vz }. */
  LAUNCHED: 'massdriver.launched',
  /** The driver's pool had no slot to give. payload: { driverId, pool }. */
  JAMMED: 'massdriver.jammed',
} as const;

// MassDriverInputEvents — what MassDriver listens for.
export const MassDriverInputEvents = {
  /** Fire one body now. Omit `driverId` to fire every driver. payload: { driverId? }. */
  FIRE: 'massdriver.fire',
  /** Start or stop the automatic cadence. payload: { driverId?, active }. */
  SET_ACTIVE: 'massdriver.active.set',
} as const;

// CaptureZoneEvents — from CaptureZone.
export const CaptureZoneEvents = {
  /** An entity entered the zone and was taken. payload: { zoneId, entityId, points, x, y, z }. */
  CAPTURED: 'capturezone.captured',
} as const;

// TrajectoryPreviewEvents — from TrajectoryPreview.
export const TrajectoryPreviewEvents = {
  /**
   * The predicted path now ends differently. `outcome` is one of `capture`,
   * `crash`, `swallow`, `escape`, `open` (still flying when the preview ran out).
   * payload: { entityId, outcome, targetId }.
   */
  OUTCOME_CHANGED: 'trajectory.outcome.changed',
} as const;

// ActiveCameraEvents — any camera component that makes itself THE camera.
// A pointer tool needs the handle to build a ray, and should not care which
// camera component produced it. payload: { entityId, handle }.
export const ActiveCameraEvents = {
  CHANGED: 'camera.active.changed',
} as const;

// AxisViewCameraEvents — from AxisViewCamera (the top/side view switcher).
export const AxisViewCameraEvents = {
  /** A switch began. payload: { entityId, view, previous }. */
  VIEW_CHANGED: 'axisview.view.changed',
} as const;

// AxisViewCameraInputEvents — what AxisViewCamera listens for.
export const AxisViewCameraInputEvents = {
  /** Go to a named view. payload: { view }. */
  SET_VIEW: 'axisview.view.set',
  /** Go to the other view. payload: {}. */
  TOGGLE: 'axisview.view.toggle',
} as const;

// PointerDragEvents — from PointerDrag.
export const PointerDragEvents = {
  /** The draggable under the pointer changed. payload: { entityId } (null when none). */
  HOVER_CHANGED: 'pointerdrag.hover.changed',
  /** A drag began. payload: { entityId, x, y, z }. */
  STARTED: 'pointerdrag.started',
  /** A dragged entity moved. payload: { entityId, x, y, z }. */
  MOVED: 'pointerdrag.moved',
  /** A drag finished. payload: { entityId, x, y, z }. */
  ENDED: 'pointerdrag.ended',
  /** Wheel turned over a draggable. payload: { entityId, delta } (+1 = away from you). */
  WHEEL: 'pointerdrag.wheel',
  /** Right-click on a draggable. payload: { entityId }. */
  CONTEXT: 'pointerdrag.context',
  /**
   * A click on empty space: a press and release with the pointer kept still.
   * The point is where the pointer ray crosses the plane through the world
   * origin facing the camera. payload: { x, y, z }.
   */
  EMPTY_CLICKED: 'pointerdrag.empty.clicked',
} as const;

// BlackHoleEvents — from BlackHole.
export const BlackHoleEvents = {
  /** A black hole's mass changed. payload: { entityId, mass, min, max }. */
  MASS_CHANGED: 'blackhole.mass.changed',
} as const;

// BlackHoleInputEvents — what BlackHole listens for (besides pointer wheel).
export const BlackHoleInputEvents = {
  /** Nudge one black hole's mass by `steps` of its `massStep`. payload: { entityId, steps }. */
  ADJUST_MASS: 'blackhole.mass.adjust',
} as const;

// SpaceGolfEvents — from SpaceGolfDirector.
export const SpaceGolfEvents = {
  /** A level is laid out. payload: { index, total, name, quota, maxMisses, maxBlackHoles, hint }. */
  LEVEL_STARTED: 'spacegolf.level.started',
  /** The tally moved. payload: { delivered, quota, missed, maxMisses, blackHoles, maxBlackHoles }. */
  PROGRESS_CHANGED: 'spacegolf.progress.changed',
  /** Quota met. payload: { index, name, bonus }. */
  LEVEL_CLEARED: 'spacegolf.level.cleared',
  /** Too many misses; the level restarts. payload: { index, name }. */
  LEVEL_FAILED: 'spacegolf.level.failed',
  /** The last level was cleared; the next start resets the score. payload: {}. */
  GAME_COMPLETED: 'spacegolf.game.completed',
  /** A rock reached the plant. payload: { entityId, points, x, y, z }. */
  ROCK_DELIVERED: 'spacegolf.rock.delivered',
  /**
   * A rock was lost. `reason` is `crashed`, `swallowed`, `escaped` (left the
   * field) or `expired` (flew too long). payload: { entityId, reason, x, y, z }.
   */
  ROCK_LOST: 'spacegolf.rock.lost',
  /**
   * The count before the chute opens: 3, 2, 1, then 0 the moment it opens
   * (GO). payload: { seconds }.
   */
  COUNTDOWN_CHANGED: 'spacegolf.countdown.changed',
  /** An add was turned down: the level's black holes are all out. payload: { max }. */
  BLACK_HOLE_REFUSED: 'spacegolf.blackhole.refused',
} as const;

// SpaceGolfInputEvents — what SpaceGolfDirector listens for (HUD buttons, keys).
export const SpaceGolfInputEvents = {
  /** Start the current level again. payload: {}. */
  RESTART_LEVEL: 'spacegolf.level.restart',
  /** Add a black hole at a point (or at the field centre). payload: { x?, y?, z? }. */
  ADD_BLACK_HOLE: 'spacegolf.blackhole.add',
  /** Remove one black hole. payload: { entityId }. */
  REMOVE_BLACK_HOLE: 'spacegolf.blackhole.remove',
} as const;
