/**
 * DEPRECATED — event names that moved out of arcade.
 *
 * Each of these belongs to a marketplace component and now lives beside it in
 * CodeLibrary, as `Components/<Name>/<Name>.events.ts`. They stay here for one
 * release so downloaded components that still import them from
 * `@babylonjsmarket/arcade` keep building. Import from the component's
 * `.events.ts` instead. Do not add to this file.
 */

// ShooterEvents — protocol for premium Shooter
/** @deprecated Moved to Components/Shooter/Shooter.events.ts. */
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
/** @deprecated Moved to Components/Shooter/Shooter.events.ts. */
export const ShooterInputEvents = {
  /**
   * External request to fire the weapon. Payload includes the spawn
   * position, direction, and optional owner/team/color echoed back on
   * `shooter.fired` so downstream projectile systems can consume it.
   */
  FIRE_REQUEST: 'shooter.fireRequest',
} as const;

// GoalEvents — protocol for premium Goal
/** @deprecated Moved to Components/Goal/Goal.events.ts. */
export const GoalEvents = {
  /** Emitted on the frame the ball first enters the goal volume. */
  SCORED: 'goal.scored',
  /** Emitted when the System teleports the ball after a score. */
  BALL_RESET: 'goal.ball.reset',
  /** Companion event carrying the delta for any downstream Score system. */
  SCORE_ADDED: 'goal.score.added',
} as const;

// GoalInputEvents — protocol for premium Goal
/** @deprecated Moved to Components/Goal/Goal.events.ts. */
export const GoalInputEvents = {
  /** External reset — clears score counter and cooldown on every Goal. */
  RESET: 'goal.reset',
} as const;

// AIZoneInputEvents — protocol for premium AIZone
/** @deprecated Moved to Components/AIZone/AIZone.events.ts. */
export const AIZoneInputEvents = {
  /** External teleport request — drops the entity at an absolute XZ position. */
  RECENTER: 'aiZone.recenter',
} as const;

// BallPossessionInputEvents — protocol for premium BallPossession
/** @deprecated Moved to Components/BallPossession/BallPossession.events.ts. */
export const BallPossessionInputEvents = {
  /** External reset — clears possessor + timers on every BallPossession entity. */
  RESET: 'possession.reset',
} as const;

// BulletPoolInputEvents — protocol for premium BulletPool
/** @deprecated Moved to nowhere (nothing used it). */
export const BulletPoolInputEvents = {
  /** Ask the pool to place a bullet at a muzzle position, travelling (dx,dz). */
  FIRE: 'bulletPool.fire',
} as const

// PinballTableEvents — protocol for premium PinballTable
/** @deprecated Moved to Components/PinballTable/PinballTable.events.ts. */
export const PinballTableEvents = {
  /** Fired after the component's width/depth change. */
  RESIZED: 'pinballTable.resized',
} as const

// PinballBuilderInputEvents — protocol for premium PinballBuilder
/** @deprecated Moved to Components/PinballBuilder/PinballBuilder.events.ts. */
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

/** @deprecated Moved to Components/Plunger/Plunger.events.ts. */
export const PlungerEvents = {
  /** The ball is in the shooter lane, waiting for the launch. payload: { ballId }. */
  SERVED: 'plunger.served',
  /** How far the plunger is pulled back, 0..1, while it charges. payload: { power }. */
  CHARGE: 'plunger.charge',
  /** The ball left the plunger. payload: { ballId, power, speed }. */
  LAUNCHED: 'plunger.launched',
  /** The ball fell off the bottom of the table. payload: { ballId }. */
  DRAINED: 'plunger.drained',
} as const

// PlungerInputEvents — what Plunger listens for.
/** @deprecated Moved to Components/Plunger/Plunger.events.ts. */
export const PlungerInputEvents = {
  /** Put the ball in the shooter lane. payload: {}. */
  SERVE: 'plunger.serve',
  /** Take the ball off the table and hold it there (game over). payload: {}. */
  PARK: 'plunger.park',
} as const

/** @deprecated Moved to Components/Bumper/Bumper.events.ts. */
export const BumperEvents = {
  /** The ball hit a pop bumper. payload: { bumperId, ballId, points }. */
  HIT: 'bumper.hit',
} as const

/** @deprecated Moved to Components/Slingshot/Slingshot.events.ts. */
export const SlingshotEvents = {
  /** A slingshot kicked the ball. payload: { entityId, ballId, points, speed }. */
  KICKED: 'slingshot.kicked',
} as const

/** @deprecated Moved to Components/Spinner/Spinner.events.ts. */
export const SpinnerEvents = {
  /** The spinner turned over. payload: { spinnerId, revolutions, points }. */
  SPUN: 'spinner.spun',
} as const

/** @deprecated Moved to Components/MouseHole/MouseHole.events.ts. */
export const MouseHoleEvents = {
  /** A saucer caught the ball. payload: { holeId, entityId }. */
  CAPTURED: 'mouseHole.captured',
  /** A saucer kicked the ball back out. payload: { holeId, entityId }. */
  RELEASED: 'mouseHole.released',
} as const

/** @deprecated Moved to Components/DropTarget/DropTarget.events.ts. */
export const DropTargetEvents = {
  /** A target dropped. payload: { entityId, bank, points, remaining }. */
  DOWN: 'dropTarget.down',
  /** The last target of a bank dropped. payload: { bank, count }. */
  BANK_COMPLETE: 'dropTarget.bankComplete',
  /** A bank stood back up. payload: { bank }. */
  RESET: 'dropTarget.reset',
} as const

// DropTargetInputEvents — what DropTarget listens for.
/** @deprecated Moved to Components/DropTarget/DropTarget.events.ts. */
export const DropTargetInputEvents = {
  /** Stand a bank back up now. payload: { bank? } (no bank = every bank). */
  RESET: 'dropTarget.resetRequest',
} as const

/** @deprecated Moved to Components/Rollover/Rollover.events.ts. */
export const RolloverEvents = {
  /** A lane lit, or the lit lanes moved. payload: { group, index, lit }. */
  CHANGED: 'rollover.changed',
  /** Every lane in a group is lit. payload: { group, count }. */
  COMPLETE: 'rollover.complete',
} as const

/** @deprecated Moved to Components/PinballRamp/PinballRamp.events.ts. */
export const PinballRampEvents = {
  /** The ball made it to the top of a ramp. payload: { entityId, ballId, points }. */
  MADE: 'pinballRamp.made',
} as const

/** @deprecated Moved to Components/WireRail/WireRail.events.ts. */
export const WireRailEvents = {
  /** A wire rail picked the ball up. payload: { entityId, ballId }. */
  ENTERED: 'wireRail.entered',
  /** A wire rail let the ball go at its far end. payload: { entityId, ballId }. */
  EXITED: 'wireRail.exited',
} as const

/** @deprecated Moved to Components/PinballGate/PinballGate.events.ts. */
export const PinballGateEvents = {
  /** The ball went through a one-way gate the allowed way. payload: { entityId, ballId }. */
  PASSED: 'pinballGate.passed',
} as const

/** @deprecated Moved to Components/PinballScrollCamera/PinballScrollCamera.events.ts. */
export const PinballScrollCameraEvents = {
  /** The camera moved to another screen of the table. payload: { screen, count }. */
  SCREEN_CHANGED: 'pinballScrollCamera.screenChanged',
} as const

/** @deprecated Moved to Components/PinballDirector/PinballDirector.events.ts. */
export const PinballDirectorEvents = {
  /**
   * The whole game, every time it moves: phase ('attract' | 'ready' |
   * 'playing' | 'over'), ball number, score, and what is lit.
   * payload: PinballGameState (see PinballDirector.defs).
   */
  CHANGED: 'pinball.game.changed',
  /** Something to tell the player: "BALL SAVED", "JACKPOT". payload: { text, kind }. */
  MESSAGE: 'pinball.game.message',
} as const

// PinballDirectorInputEvents — what PinballDirector listens for.
/** @deprecated Moved to Components/PinballDirector/PinballDirector.events.ts. */
export const PinballDirectorInputEvents = {
  /** Start a new game. payload: {}. */
  START: 'pinball.game.start',
} as const

// P2PNetworkEvents — protocol for premium P2PNetwork
/** @deprecated Moved to Components/P2PNetwork/P2PNetwork.events.ts. */
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
/** @deprecated Moved to Components/P2PNetwork/P2PNetwork.events.ts. */
export const P2PNetworkInputEvents = {
  /** Send a message to every open peer channel — `{ msg }`. */
  BROADCAST: 'net.broadcast',
} as const;

// PokerBettingEvents — protocol for premium PokerBetting
/** @deprecated Moved to Components/PokerBetting/PokerBetting.events.ts. */
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
/** @deprecated Moved to Components/PokerBetting/PokerBetting.events.ts. */
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
/** @deprecated Moved to Components/PokerHandEval/PokerHandEval.events.ts. */
export const PokerHandEvalEvents = {
  /** Fired after a showdown request is resolved. */
  RESOLVED: 'poker.showdown.resolved',
} as const;

// PokerHandEvalInputEvents — protocol for premium PokerHandEval
/** @deprecated Moved to Components/PokerHandEval/PokerHandEval.events.ts. */
export const PokerHandEvalInputEvents = {
  /** Request a showdown resolution. Payload: {@link ShowdownRequest}. */
  REQUEST: 'poker.showdown.request',
} as const;

// PokerTableDirectorInputEvents — protocol for premium PokerTableDirector
/** @deprecated Moved to Components/PokerTableDirector/PokerTableDirector.events.ts. */
export const PokerTableDirectorInputEvents = {
  /** Confirm the next hand should be dealt (e.g. a Space key). `{}`. */
  DEAL: 'pokerTable.deal',
  /** Restore every seat to the starting stack and re-arm. `{}`. */
  MATCH_RESET: 'pokerTable.matchReset',
} as const;

// DeckDealerEvents — protocol for premium DeckDealer
/** @deprecated Moved to Components/DeckDealer/DeckDealer.events.ts. */
export const DeckDealerEvents = {
  /** Fired for each card that lands. Payload: card, target, remaining. */
  DEALT: 'deck.dealt',
  /** Fired once the deck is reshuffled and the table is cleared. */
  RESET: 'deck.reset',
} as const;

// DeckDealerInputEvents — protocol for premium DeckDealer
/** @deprecated Moved to Components/DeckDealer/DeckDealer.events.ts. */
export const DeckDealerInputEvents = {
  /** Request to deal — `{ all?: boolean }`. Omit `all` to deal one card. */
  DEAL_REQUEST: 'deck.dealRequest',
  /** Request to reshuffle and clear every hand. `{}`. */
  RESET_REQUEST: 'deck.resetRequest',
} as const;

// CardFanInputEvents — protocol for premium CardFan
/** @deprecated Moved to Components/CardFan/CardFan.events.ts. */
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
/** @deprecated Moved to Components/Waypoint/Waypoint.events.ts. */
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
/** @deprecated Moved to Components/Parts/Parts.events.ts. */
export const PartsEvents = {
  /** A part dropped to 0 HP and detached. payload: { entityId, part, x, y, z, meshSuffixes }. */
  DESTROYED: 'spaceshooter.part.destroyed',
} as const;

// MissionDirectorEvents — the run's outcome, broadcast by the mission brain. A HUD,
// an end-of-run screen, an achievement tracker and a scene-reset director are all
// legitimate listeners, so the names live here rather than in MissionDirector.core —
// none of them should have to import the brain to know the run ended.
/** @deprecated Moved to Components/MissionDirector/MissionDirector.events.ts. */
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
/** @deprecated Moved to Components/FreighterHead/FreighterHead.events.ts. */
export const FreighterEvents = {
  /** The convoy reached the final gate. payload: { freighterId, waypointIndex }. */
  DELIVERED: 'spaceshooter.freighter.delivered',
} as const;

// MissileEvents — the detonation protocol for the premium Missile component,
// emitted by its guidance/impact systems. Lives here rather than in Missile.core
// so an FX or audio listener never has to import the emitter's file
// (no-cross-component-event-import), exactly like SpaceShooterHealthEvents below.
/** @deprecated Moved to Components/Missile/Missile.events.ts. */
export const MissileEvents = {
  /** A missile detonated on its target. payload: { missileId, targetId, x, y, z }. */
  EXPLODED: 'spaceshooter.missile.exploded',
  /** A missile flew past closest approach without detonating; ammo lost. payload: { missileId }. */
  WASTED: 'spaceshooter.missile.wasted',
} as const;

// MissileLauncherEvents — the launch protocol, emitted on every shot for the
// HUD, the launch-flash FX and audio. Here for the same reason as MissileEvents.
/** @deprecated Moved to Components/MissileLauncher/MissileLauncher.events.ts. */
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
/** @deprecated Moved to Components/RoundReset/RoundReset.events.ts. */
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
/** @deprecated Moved to Components/RoundReset/RoundReset.events.ts. */
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
/** @deprecated Moved to Components/CameraShake/CameraShake.events.ts. */
export const CameraShakeInputEvents = {
  /** Add trauma, clamped into [0, 1] after the add. payload: { impulse }. */
  IMPULSE: 'cameraShake.impulse',
} as const;

/** @deprecated Moved to Components/CameraShake/CameraShake.events.ts. */
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
/** @deprecated Moved to Components/SpaceShooterHealth/SpaceShooterHealth.events.ts. */
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

// GravityEvents — from GravityBody (the n-body integrator).
/** @deprecated Moved to Components/GravityBody/GravityBody.events.ts. */
export const GravityEvents = {
  /**
   * A GravityBody touched the surface of a GravityMass. `swallowed` is true when
   * that mass `absorbs` (an event horizon) and false for a solid crash. With the
   * body's `releaseOnContact` on (the default) it has already been taken out of
   * play when this fires.
   * payload: { bodyId, massId, swallowed, x, y, z, vx, vy, vz }.
   */
  CONTACT: 'gravity.body.contact',
  /**
   * A GravityBody went into one Wormhole mouth and came out of the other, with
   * the velocity it went in with. The point is where it came out.
   * payload: { bodyId, fromId, toId, x, y, z, vx, vy, vz }.
   */
  JUMPED: 'gravity.body.jumped',
} as const;

// MassDriverEvents — from MassDriver (the pooled-body launcher).
/** @deprecated Moved to Components/MassDriver/MassDriver.events.ts. */
export const MassDriverEvents = {
  /** A body left the muzzle. payload: { driverId, entityId, x, y, z, vx, vy, vz }. */
  LAUNCHED: 'massdriver.launched',
  /**
   * The driver has no pool to fire from: none by that name, or one of size 0.
   * (A pool with every slot in flight recycles its oldest body instead.)
   * payload: { driverId, pool }.
   */
  JAMMED: 'massdriver.jammed',
} as const;

// MassDriverInputEvents — what MassDriver listens for.
/** @deprecated Moved to Components/MassDriver/MassDriver.events.ts. */
export const MassDriverInputEvents = {
  /** Fire one body now. Omit `driverId` to fire every driver. payload: { driverId? }. */
  FIRE: 'massdriver.fire',
  /** Start or stop the automatic cadence. payload: { driverId?, active }. */
  SET_ACTIVE: 'massdriver.active.set',
} as const;

/** @deprecated Moved to Components/CaptureZone/CaptureZone.events.ts. */
export const CaptureZoneEvents = {
  /** An entity entered the zone and was taken. payload: { zoneId, entityId, points, x, y, z }. */
  CAPTURED: 'capturezone.captured',
} as const;

/** @deprecated Moved to Components/TrajectoryPreview/TrajectoryPreview.events.ts. */
export const TrajectoryPreviewEvents = {
  /**
   * The predicted path now ends differently. `outcome` is one of `capture`,
   * `crash`, `swallow`, `escape`, `open` (still flying when the preview ran out).
   * payload: { entityId, outcome, targetId }.
   */
  OUTCOME_CHANGED: 'trajectory.outcome.changed',
} as const;

// ConicPathEvents — from ConicPath (the exact two-body orbit drawn from the equations).
/** @deprecated Moved to Components/ConicPath/ConicPath.events.ts. */
export const ConicPathEvents = {
  /**
   * The drawn orbit changed shape: a launcher's speed or direction moved, or the
   * central mass did. Fires on the first frame and whenever a number changes in
   * its 4th decimal, not every frame. `kind` is `circle`, `ellipse`,
   * `parabola`, `hyperbola` or `radial` (a launch straight up or down);
   * `period` and `apoapsis` are 0 for an orbit that never comes back.
   * `landAngle` (degrees round the mass), `landX` and `galileoX` say where the
   * shot comes down: `landX` for the true orbit and `galileoX` for Galileo's
   * flat-ground parabola, both measured sideways from the muzzle, so a
   * difference of a few pixels on screen still reads as a number. They are 0
   * when the shot never comes down (and `galileoX` when the overlay is off).
   * payload: { entityId, aroundId, kind, eccentricity, semiLatusRectum, energy,
   *   period, periapsis, apoapsis, landAngle, landX, galileoX }.
   */
  CHANGED: 'conicpath.changed',
} as const;

// ActiveCameraEvents — any camera component that makes itself THE camera.
// A pointer tool needs the handle to build a ray, and should not care which
// camera component produced it. payload: { entityId, handle }.
/** @deprecated Moved to Components/_shared/cameraEvents.ts. */
export const ActiveCameraEvents = {
  CHANGED: 'camera.active.changed',
} as const;

// AxisViewCameraEvents — from AxisViewCamera (the top/side view switcher).
/** @deprecated Moved to Components/AxisViewCamera/AxisViewCamera.events.ts. */
export const AxisViewCameraEvents = {
  /** A switch began. payload: { entityId, view, previous }. */
  VIEW_CHANGED: 'axisview.view.changed',
} as const;

// AxisViewCameraInputEvents — what AxisViewCamera listens for.
/** @deprecated Moved to Components/AxisViewCamera/AxisViewCamera.events.ts. */
export const AxisViewCameraInputEvents = {
  /** Go to a named view. payload: { view }. */
  SET_VIEW: 'axisview.view.set',
  /** Go to the other view. payload: {}. */
  TOGGLE: 'axisview.view.toggle',
  /**
   * Zoom in about a world point, which stays put on screen while the camera
   * eases in or out. `zoom` 1 is the whole volume; 2 is twice as close.
   * payload: { zoom, anchor?: [x, y, z] }.
   */
  ZOOM: 'axisview.zoom.set',
} as const;

/** @deprecated Moved to Components/PointerDrag/PointerDrag.events.ts. */
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

/** @deprecated Moved to Components/BlackHole/BlackHole.events.ts. */
export const BlackHoleEvents = {
  /** A black hole's mass changed. payload: { entityId, mass, min, max }. */
  MASS_CHANGED: 'blackhole.mass.changed',
} as const;

// BlackHoleInputEvents — what BlackHole listens for (besides pointer wheel).
/** @deprecated Moved to Components/BlackHole/BlackHole.events.ts. */
export const BlackHoleInputEvents = {
  /** Nudge one black hole's mass by `steps` of its `massStep`. payload: { entityId, steps }. */
  ADJUST_MASS: 'blackhole.mass.adjust',
} as const;

/** @deprecated Moved to Components/SpaceGolfDirector/SpaceGolfDirector.events.ts. */
export const SpaceGolfEvents = {
  /**
   * A level is laid out. `solvable` says whether it carries a solution.
   * payload: { index, total, name, quota, maxMisses, maxBlackHoles, hint, solvable }.
   */
  LEVEL_STARTED: 'spacegolf.level.started',
  /** The tally moved. payload: { delivered, quota, missed, maxMisses, blackHoles, maxBlackHoles }. */
  PROGRESS_CHANGED: 'spacegolf.progress.changed',
  /**
   * Quota met. `assisted` is true when the level's solution was placed for the
   * player, which pays no level bonus. payload: { index, name, bonus, assisted }.
   */
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
  /**
   * A black hole went back to its pool: removed by the player, or cleared off
   * the field by a new layout or SOLVE. payload: { entityId }.
   */
  BLACK_HOLE_REMOVED: 'spacegolf.blackhole.removed',
  /**
   * The time between rocks changed (or was first set). `scale` multiplies each
   * level's own interval; `interval` is the seconds that gives this level.
   * payload: { scale, interval, slowest, fastest }.
   */
  CADENCE_CHANGED: 'spacegolf.cadence.changed',
  /** The level's solution was placed for the player. payload: { index, holes }. */
  SOLVED: 'spacegolf.level.solved',
} as const;

// SpaceGolfInputEvents — what SpaceGolfDirector listens for (HUD buttons, keys).
/** @deprecated Moved to Components/SpaceGolfDirector/SpaceGolfDirector.events.ts. */
export const SpaceGolfInputEvents = {
  /** Start the current level again. payload: {}. */
  RESTART_LEVEL: 'spacegolf.level.restart',
  /** Add a black hole at a point (or at the world origin). payload: { x?, y?, z? }. */
  ADD_BLACK_HOLE: 'spacegolf.blackhole.add',
  /** Remove one black hole. payload: { entityId }. */
  REMOVE_BLACK_HOLE: 'spacegolf.blackhole.remove',
  /**
   * Go to a level: `index` (0-based) or `step` levels on from this one, wrapping.
   * payload: { index? , step? }.
   */
  GOTO_LEVEL: 'spacegolf.level.goto',
  /** Change the time between rocks by `steps` notches; +1 is slower. payload: { steps }. */
  ADJUST_CADENCE: 'spacegolf.cadence.adjust',
  /** Place this level's solution in place of the player's black holes. payload: {}. */
  SOLVE: 'spacegolf.level.solve',
} as const;

// BilliardTableEvents — from BilliardTable (the fixed-step table).
/** @deprecated Moved to Components/BilliardTable/BilliardTable.events.ts. */
export const BilliardTableEvents = {
  /** Two balls hit. payload: { aId, bId, speed, x, z }. `speed` is the closing speed, m/s. */
  COLLIDED: 'billiards.ball.collided',
  /** A ball bounced off a cushion. payload: { entityId, rail, speed, x, z }. */
  CUSHIONED: 'billiards.ball.cushioned',
  /** An object ball dropped into a pocket. payload: { entityId, number, pocketId, x, z }. */
  POTTED: 'billiards.ball.potted',
  /** The cue ball dropped into a pocket and was put back on its spot. payload: { entityId, pocketId }. */
  SCRATCHED: 'billiards.cue.scratched',
  /** Every ball on the table has stopped. payload: { moving: 0 }. */
  SETTLED: 'billiards.table.settled',
} as const;

/** @deprecated Moved to Components/BilliardCue/BilliardCue.events.ts. */
export const BilliardCueEvents = {
  /**
   * The cue struck the cue ball. `tipOffset` is where the tip landed, as a
   * fraction of the radius above (+) or below (−) the centre.
   * payload: { entityId, speed, tipOffset, dirX, dirZ }.
   */
  STRUCK: 'billiards.cue.struck',
  /**
   * What the cue is doing, and how hard it is pulled back: `state` is
   * 'aiming' (still balls, no press), 'pulling' (pressed and dragging) or
   * 'waiting' (balls still moving). `power` is 0..1 of a full pull, `speed`
   * the m/s a release now would give. Sent when either changes.
   * payload: { state, power, speed }.
   */
  POWER_CHANGED: 'billiards.cue.power.changed',
} as const;

/** @deprecated Moved to Components/BilliardTurns/BilliardTurns.events.ts. */
export const BilliardTurnsEvents = {
  /**
   * Whose shot it is, and every ball each player has potted. `reason` is
   * 'start' (a new rack), 'potted' (a ball just dropped, same shot), 'again'
   * (potted and shoots again), 'miss', 'scratch' (cue ball potted) or 'over'
   * (the table is clear; `winner` is a player index, or null on a tie).
   * payload: { current, players: [{ name, potted }], reason, shot, over, winner }.
   */
  CHANGED: 'billiards.turns.changed',
} as const;

/** @deprecated Moved to Components/BilliardRack/BilliardRack.events.ts. */
export const BilliardRackEvents = {
  /** Fifteen balls are racked and the cue ball is on its spot. payload: { count }. */
  RACKED: 'billiards.rack.racked',
} as const;

// BilliardRackInputEvents — what BilliardRack listens for.
/** @deprecated Moved to Components/BilliardRack/BilliardRack.events.ts. */
export const BilliardRackInputEvents = {
  /** Rack the balls again. payload: {}. */
  RERACK: 'billiards.rack.request',
} as const;
