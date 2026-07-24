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
  /** The model finished loading — `meshId` is now valid for animation calls. */
  LOADED: 'mesh.loaded',
  /** The renderer rejected the load. `error` has the message. */
  ERROR: 'mesh.error',
} as const;

// MeshInputEvents — from Mesh
export const MeshInputEvents = {
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
