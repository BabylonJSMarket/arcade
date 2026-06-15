/**
 * Top-down shooter scene — SmashTV-style arena.
 *
 *   • 40×40 ground plane fenced by 4 perimeter walls
 *   • Player capsule with TwinStickShooter: WASD moves, arrows fire
 *   • 4 EnemySpawners at the corners, each pulsing red spheres on a timer
 *   • Score + Scoreboard HUD (top-right, toggle with `2`)
 *   • Singleton `World` entity registering Bullet + Enemy as "marker"
 *     components so SceneLoader instantiates BulletSystem + EnemySystem
 *     (their runtime-spawned entities never appear in this file)
 */
export const SCENE = {
  name: 'TopDownShooter',
  clearColor: [0.04, 0.05, 0.08, 1],
  entities: {
    Sky: {
      tags: ['sky'],
      components: {
        Skybox: {
          followLight: 'sun',
          zenithColor: [0.02, 0.03, 0.08],
          horizonColor: [0.45, 0.12, 0.18],
          groundColor: [0.04, 0.03, 0.05],
          sunColor: [1.0, 0.7, 0.55],
          sunGlowSize: 90,
        },
      },
    },
    Sun: {
      tags: ['sun'],
      components: {
        DirectionalLight: {
          direction: [-0.3, -0.85, -0.4],
          // Dropped from 1.6 — combined with the hemispheric fill the floor
          // was getting bleached out. 0.9 keeps shadows crisp without nuking
          // the mid-tones.
          intensity: 0.9,
          diffuse: [1.0, 0.82, 0.65],
          shadowEnabled: true,
          shadowMapSize: 2048,
          shadowMinZ: 0.1,
          shadowMaxZ: 80,
        },
      },
    },
    Sky_Fill: {
      components: {
        HemisphericLight: {
          intensity: 0.55,
          diffuse: [0.5, 0.55, 0.85],
          groundColor: [0.15, 0.1, 0.18],
        },
      },
    },
    Ground: {
      components: {
        MeshPrimitive: {
          primitive: 'ground',
          width: 40,
          depth: 40,
          // diffuse only — leaving specularColor unset paints a default
          // white spec highlight on the floor, which (with a low-angle
          // DirectionalLight) reads as a giant blown-out hotspot in the
          // middle of the arena. Matte floor lets the bullets/enemies pop.
          material: {
            diffuseColor: [0.13, 0.12, 0.18],
            specularColor: [0, 0, 0],
          },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_N: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 40, height: 2, depth: 1, position: [0, 1, 19.5],
          material: { diffuseColor: [0.35, 0.18, 0.45], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Wall_S: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 40, height: 2, depth: 1, position: [0, 1, -19.5],
          material: { diffuseColor: [0.35, 0.18, 0.45], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Wall_E: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 1, height: 2, depth: 40, position: [19.5, 1, 0],
          material: { diffuseColor: [0.35, 0.18, 0.45], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Wall_W: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 1, height: 2, depth: 40, position: [-19.5, 1, 0],
          material: { diffuseColor: [0.35, 0.18, 0.45], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Player: {
      tags: ['player'],
      components: {
        // Invisible collision proxy: TwinStickShooter moves this capsule and
        // the Mesh below (follow:true) tracks its XZ. visible:false because the
        // Commando GLB is the visual now (mirrors the enemy's hidden proxy).
        MeshPrimitive: {
          primitive: 'capsule',
          radius: 0.5,
          height: 1.6,
          position: [0, 0.8, 0],
          material: { diffuseColor: [0.3, 0.85, 0.95], emissiveColor: [0.05, 0.2, 0.3] },
          visible: false,
        },
        // castShadow:false — an invisible capsule shouldn't drop a capsule
        // shadow under the model (matches the enemy proxy).
        Shadow: { castShadow: false, receiveShadow: false },
        TwinStickShooter: {
          speed: 7,
          fireRate: 14, bulletSpeed: 36, bulletLifetime: 1.4,
          bulletSize: 0.55, bulletRadius: 0.4,
          bulletColor: [1.0, 0.95, 0.35],
          arenaHalfWidth: 18.5, arenaHalfDepth: 18.5,
          muzzleFlash: true, muzzleFlashSize: 0.9, muzzleFlashLifetime: 0.07,
        },
        // 5 hit points, ~0.6s i-frames per hit so a swarm doesn't insta-kill.
        // On 0 HP the player teleports back to the spawn point with full HP.
        Health: {
          hp: 5,
          maxHp: 5,
          invulnSeconds: 0.6,
          respawnPosition: [0, 0.8, 0],
        },
        // Floating HP bar above the capsule. hideAtFullHp:false so the
        // player always sees their bar (it's their HUD); enemy bars hide
        // at full HP since unbroken bars are noise.
        HealthBar: {
          width: 1.4,
          height: 0.16,
          offsetY: 1.5,
          color: [0.35, 0.95, 0.5],
          hideAtFullHp: false,
        },
        // Visible player model. instanced:true so the model loads via the
        // template path (loadModelTemplate) — the ONLY path that applies
        // lockRootMotion. The plain loadMesh path (instanced:false) silently
        // drops it, which let Run_and_Shoot's baked root motion slide the player.
        // This is NOT pooling (no EntityPool) — it's a single, persistent
        // template+clone, same load path the enemy uses for its locked clips.
        // follow:true tracks the capsule proxy's XZ; faceMode:'proxy' copies the
        // proxy's yaw (TwinStickShooter points it at the aim/fire direction)
        // instead of turning toward travel; lockRootMotion plays clips in place.
        Mesh: {
          src: '/shooter/Commando-shooter.glb',
          instanced: true,
          follow: true,
          faceMode: 'proxy',
          scale: 1,
          yawOffset: 0,
          position: [0, 0, 0],
          autoLoad: true,
          lockRootMotion: true,
        },
        // Clip state machine for the model. The loop is driven by
        // PlayerWalkAnimator (gated on movement), so no defaultLoopClip here.
        SkeletonAnimator: {},
        // Plays 'Run_and_Shoot' while moving, freezes when stopped (the GLB has
        // no idle clip), and fires 'Fall_Forward' once on death. Lives in this
        // game folder — the arcade package has no PlayerSystem, so this is the
        // player's equivalent of EnemySystem.
        PlayerWalkAnimator: { walkClip: 'Run_and_Shoot', deathClip: 'Fall_Forward' },
      },
    },
    Spawner_NW: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 1.6, height: 0.4, position: [-15, 0.2, 15], material: { diffuseColor: [0.6, 0.1, 0.15], emissiveColor: [0.4, 0.05, 0.08] } },
        Shadow: { castShadow: true, receiveShadow: true },
        EnemySpawner: { interval: 1.2, maxAlive: 6 },
      },
    },
    Spawner_NE: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 1.6, height: 0.4, position: [15, 0.2, 15], material: { diffuseColor: [0.6, 0.1, 0.15], emissiveColor: [0.4, 0.05, 0.08] } },
        Shadow: { castShadow: true, receiveShadow: true },
        EnemySpawner: { interval: 1.2, maxAlive: 6 },
      },
    },
    Spawner_SW: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 1.6, height: 0.4, position: [-15, 0.2, -15], material: { diffuseColor: [0.6, 0.1, 0.15], emissiveColor: [0.4, 0.05, 0.08] } },
        Shadow: { castShadow: true, receiveShadow: true },
        EnemySpawner: { interval: 1.2, maxAlive: 6 },
      },
    },
    Spawner_SE: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 1.6, height: 0.4, position: [15, 0.2, -15], material: { diffuseColor: [0.6, 0.1, 0.15], emissiveColor: [0.4, 0.05, 0.08] } },
        Shadow: { castShadow: true, receiveShadow: true },
        EnemySpawner: { interval: 1.2, maxAlive: 6 },
      },
    },
    // Raised "isometric-lite" view — high enough that the whole 40×40
    // arena fits comfortably, beta=0.55 gives a satisfying tilt so the
    // player capsule reads as a capsule (not a circle). controlsEnabled:
    // false stops the user from accidentally orbiting the camera off the
    // field; alpha/beta limits pin every axis so even a stray pointer
    // event can't drift the framing.
    Camera: {
      components: {
        ArcCamera: {
          target: 'Player',
          follow: true,
          distance: 42, minDistance: 42, maxDistance: 42,
          alpha: -1.5708, beta: 0.55,
          minBeta: 0.55, maxBeta: 0.55,
          controlsEnabled: false,
        },
        // Companion that CONFIGURES the ArcCamera above (it doesn't create its
        // own camera): resolves the live ArcCamera, holds the top-down preset
        // (distance/beta), hands it the follow target + locks the orbit
        // controls. ArcCameraSystem (not this) owns the actual camera-target
        // write, so the two never race. TwinStickShooter + ArcCameraDebugger
        // still read ArcCameraComponent — keep ArcCamera here.
        ShooterCamera: { target: 'Player', beta: 0.55, distance: 42, lockControls: true },
        // On-screen camera controls (toggle with C): zoom, pan, follow.
        ArcCameraDebugger: { activationKey: 'KeyC', position: 'top-left' },
      },
    },
    // Score state — Player gets points; Enemy emits `score.add` on kill.
    ScoreState: {
      components: {
        Score: { defaultPoints: 100, scores: { Player: 0 } },
      },
    },
    // Singleton "World" entity. Marker components for systems that operate
    // on RUNTIME-spawned entities (bullets, enemies). The marker instances
    // don't satisfy the systems' queries (which also require MeshPrimitive),
    // so they're harmless — they exist purely so SceneLoader sees the
    // component names and instantiates BulletSystem / EnemySystem.
    World: {
      components: {
        // Pooled bullet meshes — pre-allocated once and reused, so firing
        // never churns entities/meshes. TwinStickShooter emits `bulletPool.fire`;
        // BulletSystem drives flight + collision against the parked slots.
        BulletPool: {
          poolSize: 48,
          bulletDiameter: 0.55,
          color: [1.0, 0.95, 0.35],
          // Walls sit at ±19.5 — release bullets at the wall instead of letting
          // them fly through.
          arenaHalfWidth: 19.5,
          arenaHalfDepth: 19.5,
        },
        Bullet: {},
        // Pooled enemy entities via the generic EntityPool — pre-allocated once
        // and reused, so a wave never churns entities/meshes. `components` is the
        // declarative per-enemy component set; the MeshPrimitive is the collision
        // proxy the pool positions each spawn. Spawners emit `entityPool.spawn`
        // (pool 'enemy'); EnemySystem drives chase/contact and asks the pool to
        // re-park on death. Size covers all spawners' caps (4 x maxAlive 6 = 24)
        // with headroom. The @sync-skip blocks add the shooter-bot GLB visual +
        // animator; stripping them leaves a plain visible-sphere enemy for the
        // scaffold template (when a Mesh is present the pool auto-hides the
        // sphere and routes shadows to the GLB).
        EntityPool: {
          pool: 'enemy',
          size: 32,
          tags: ['enemy'],
          components: {
            MeshPrimitive: {
              primitive: 'sphere', diameter: 1.2, segments: 16,
              material: { diffuseColor: [0.85, 0.25, 0.35], emissiveColor: [0.255, 0.075, 0.105] },
            },
            Enemy: {
              arenaHalfWidth: 19, arenaHalfDepth: 19,
              // Chase vs wander is gated by the sibling LineOfSight component
              // (below): sees the player → chase; can't → wander away from the
              // crowd at wanderSpeed, re-heading every wanderInterval seconds.
              wanderSpeed: 1.8,
              wanderInterval: 2,
            },
            // Perception: emits lineofsight.acquired/lost that Enemy turns into
            // chase/wander. Sees the player within `fov`° of its facing, up to
            // `range`, past other robots (blockRadius) and full-height walls.
            // Tune live via the LineOfSightDebugger panel (FOV/range/timing).
            LineOfSight: {
              targetTag: 'player',
              fov: 220,
              range: 32,
              rayCount: 3,
              blockRadius: 0.6,
              interval: 1.5,
            },
            Health: { hp: 2, maxHp: 2 },
            HealthBar: { width: 1.14, height: 0.12, offsetY: 0.91, color: [0.95, 0.35, 0.4] },
            Shadow: { castShadow: true, receiveShadow: false },
          },
        },
        Enemy: {},
        // Marker so SceneLoader instantiates LineOfSightSystem for the pooled
        // enemies (the perception component is declared per-enemy above).
        LineOfSight: {},
        // Scatters wall-like barriers across the field on the first frame.
        // FULL walls block movement + bullets + line of sight; LOW cover blocks
        // movement only (shoot/see over). Placement avoids the spawn centre and
        // the four corner spawner pads, and re-rolls every run (set `seed` to a
        // non-zero number to lock a layout). count + fullRatio are the dials.
        ObstacleField: {
          count: 8,
          fullRatio: 0.5,
          placementHalf: 16,
          clearCenterRadius: 5,
          avoid: [[-15, 15, 3], [15, 15, 3], [-15, -15, 3], [15, -15, 3]],
        },
        // HealthBar is on Player too (so the system would land regardless),
        // but listing it on World keeps the convention crisp: every runtime-
        // spawn target system has a marker here.
        HealthBar: {},
        // Live tuning for the robots' vision (FOV / range / ray count / timing)
        // plus a "show rays" toggle that draws each robot's sight rays
        // (green = reaches player, red = blocked). Toggle the panel with V.
        LineOfSightDebugger: { activationKey: 'KeyV', position: 'top-right' },
      },
    },
    // On-screen HUD wired to the Score system. Score emits `score.changed`
    // and Scoreboard listens to it, so the only wiring needed is the player
    // roster — names + tints. ScoreboardDebugger is the panel that paints the
    // HUD; visible:true keeps it on screen all the time, Digit2 toggles.
    Scoreboard: {
      components: {
        Scoreboard: {
          title: 'SCORE',
          fontSize: 20,
          position: 'top-right',
          players: [{ entityId: 'Player', name: 'P1', color: [0.3, 0.85, 0.95] }],
        },
        ScoreboardDebugger: { visible: true, position: 'top-right' },
      },
    },
  },
}
