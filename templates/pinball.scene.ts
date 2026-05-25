/**
 * Pinball scene — regulation-ratio table with three pop bumpers, slingshot
 * diagonals, dual flippers (Shift-L / Shift-R), and a plunger (Space).
 *
 *   • Press `3` for the table-dimensions panel — drag width/depth, watch
 *     the whole table reflow (declarative layout via PinballLayout).
 *   • Press `4` for the live element builder — pick a kind (bumper, rail,
 *     spinner, saucer, ...), draw or click on the playfield to place new
 *     entities at runtime.
 *   • Press `2` for the scoreboard HUD, `` ` `` for the entities panel,
 *     `F4` for the EventBus debugger.
 *
 * Every gameplay component below ships in @babylonjsmarket/arcade. Tweak
 * the numbers, save, hot-reload.
 */
export const SCENE = {
  name: 'Pinball',
  clearColor: [0.03, 0.04, 0.07, 1],
  entities: {
    Sky: {
      tags: ['sky'],
      components: {
        Skybox: {
          followLight: 'sun',
          zenithColor: [0.02, 0.03, 0.08],
          horizonColor: [0.4, 0.18, 0.5],
          groundColor: [0.04, 0.03, 0.07],
          sunColor: [1.0, 0.8, 0.6],
          sunGlowSize: 70,
        },
        // Prefiltered IBL cubemap so the chrome pinball reflects a real
        // environment. Babylon `.env` format — ~150 KB, prefiltered, no
        // DCC tooling needed. Tied to the Sky entity since both are
        // "what surrounds the scene"; no functional coupling though.
        EnvironmentTexture: {
          url: 'https://assets.babylonjs.com/environments/environmentSpecular.env',
          level: 1.0,
        },
      },
    },
    Sun: {
      tags: ['sun'],
      components: {
        DirectionalLight: {
          direction: [-0.2, -0.9, -0.3],
          intensity: 1.5,
          diffuse: [1.0, 0.88, 0.75],
          shadowEnabled: true,
          shadowMapSize: 2048,
          shadowMinZ: 0.1,
          shadowMaxZ: 60,
        },
      },
    },
    Sky_Fill: {
      components: {
        HemisphericLight: {
          intensity: 0.5,
          diffuse: [0.55, 0.6, 0.85],
          groundColor: [0.14, 0.1, 0.18],
        },
      },
    },
    // Playfield: a slab. Box (not ground) so the physics box-shape has real
    // Y extent for Havok to wrap. Slightly recessed (-0.1 Y) so the top
    // surface sits at y=0. Low friction + modest restitution = ball slides
    // and pings, doesn't grind to a stop on the table.
    // Regulation pinball playfield is 20.25" × 42" → at 16 units = 20.25"
    // (1 unit ≈ 1.266"), depth = 42/1.266 = 33.2 units.
    Playfield: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 16, height: 0.2, depth: 33.2,
          position: [0, -0.1, 0],
          material: { diffuseColor: [0.12, 0.13, 0.2] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.2, friction: 0.05 },
        PinballLayout: { scaleWith: 'both' },
      },
    },
    // Perimeter walls. Top wall at z=-16.6 (inner edge of the playfield).
    // Side walls match the new 33.2-deep playfield.
    Wall_Top: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 16, height: 2, depth: 0.5, position: [0, 1, -16.6], color: [0.32, 0.18, 0.5] },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.6, friction: 0.05 },
        // x stays centered (xCoeff:0); z sits at the back edge (-D/2).
        PinballLayout: { zCoeff: -0.5, scaleWith: 'width' },
      },
    },
    Wall_Left: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 2, depth: 33.2, position: [-8, 1, 0], color: [0.32, 0.18, 0.5] },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.6, friction: 0.05 },
        PinballLayout: { xCoeff: -0.5, scaleWith: 'depth' },
      },
    },
    Wall_Right: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 2, depth: 33.2, position: [8, 1, 0], color: [0.32, 0.18, 0.5] },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.6, friction: 0.05 },
        PinballLayout: { xCoeff: 0.5, scaleWith: 'depth' },
      },
    },
    // Slingshot diagonals — extend all the way from the outer corner
    // (±W/2, halfD-4.6) → (±3, halfD-1.5), terminating exactly at the
    // flipper hinge. This mirrors real pinball: the slingshot's bottom
    // edge IS the lane that delivers the ball to the flipper, with no
    // separate "inlane wall" V-junction in between.
    // Length sqrt(5² + 3.1²) ≈ 5.88; angle atan2(3.1, 5) ≈ 0.555 rad.
    Wall_BottomLeft: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 5.88, height: 2, depth: 0.5,
          position: [-5.5, 1, 13.55], rotation: [0, -0.555, 0],
          color: [0.32, 0.18, 0.5],
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.6, friction: 0.05 },
        // Slingshot center sits halfway along the diagonal — z = halfD - 3.05.
        PinballLayout: { xCoeff: -0.34375, zCoeff: 0.5, zOffset: -3.05 },
      },
    },
    Wall_BottomRight: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 5.88, height: 2, depth: 0.5,
          position: [5.5, 1, 13.55], rotation: [0, 0.555, 0],
          color: [0.32, 0.18, 0.5],
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', restitution: 0.6, friction: 0.05 },
        PinballLayout: { xCoeff: 0.34375, zCoeff: 0.5, zOffset: -3.05 },
      },
    },
    // Pop bumpers. Regulation thumper-bumper is ~2.25" diameter ≈ 1.78 units
    // at our 16-units-wide scale. All three the same size for proportional
    // realism; the centre one stays worth more because it's the toughest hit.
    Bumper_Center: {
      components: {
        MeshPrimitive: {
          primitive: 'cylinder', diameter: 1.78, height: 1.5,
          position: [0, 0.75, -2],
          material: { diffuseColor: [0.95, 0.35, 0.65], emissiveColor: [0.55, 0.15, 0.35] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'capsule', motionType: 'static', restitution: 0.95, friction: 0.02 },
        Bumper: { points: 500, hitRadius: 1.25, releaseRadius: 1.7 },
        PinballLayout: { zCoeff: -0.0602 },
      },
    },
    Bumper_Left: {
      components: {
        MeshPrimitive: {
          primitive: 'cylinder', diameter: 1.78, height: 1.5,
          position: [-3, 0.75, -6],
          material: { diffuseColor: [0.35, 0.95, 0.7], emissiveColor: [0.15, 0.55, 0.4] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'capsule', motionType: 'static', restitution: 0.95, friction: 0.02 },
        Bumper: { points: 250, hitRadius: 1.25, releaseRadius: 1.7 },
        PinballLayout: { xCoeff: -0.1875, zCoeff: -0.1807 },
      },
    },
    Bumper_Right: {
      components: {
        MeshPrimitive: {
          primitive: 'cylinder', diameter: 1.78, height: 1.5,
          position: [3, 0.75, -6],
          material: { diffuseColor: [0.95, 0.85, 0.35], emissiveColor: [0.55, 0.5, 0.15] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: { shapeType: 'capsule', motionType: 'static', restitution: 0.95, friction: 0.02 },
        Bumper: { points: 250, hitRadius: 1.25, releaseRadius: 1.7 },
        PinballLayout: { xCoeff: 0.1875, zCoeff: -0.1807 },
      },
    },
    // Flippers. Regulation tip-to-pivot length on a real table is ~3 in;
    // ours is 16 units ≈ 20.25 in wide, so 3 in → 2.4 units.
    //
    // Babylon is left-handed: a Y rotation of +θ rotates a +X-pointing vector
    // toward -Z. So the LEFT flipper (+X mesh) needs restAngle NEGATIVE for
    // its tip to point down-table (+Z); flipAngle POSITIVE swings the tip up
    // (-Z). Right flipper signs are mirrored.
    //
    // taperedGeometry rebuilds the bat as a trapezoidal prism with the pivot
    // end at the mesh's local origin so rotation around mesh.position swings
    // the tip around the outer-edge hinge. autoCreate:false on Physics lets
    // FlipperSystem fit the body to the rebuilt bounding box.
    Flipper_Left: {
      tags: ['flipper', 'flipper-left'],
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 2.4, height: 0.4, depth: 0.6,
          position: [-3, 0.3, 15.1],
          material: { diffuseColor: [0.85, 0.85, 0.95], emissiveColor: [0.1, 0.1, 0.2] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: {
          shapeType: 'box', motionType: 'kinematic',
          mass: 1, restitution: 0.4, friction: 0.1,
          autoCreate: false,
        },
        // restAngle matches the slingshot's tilt (-0.555 rad) so the
        // flipper at rest is FLUSH with the slingshot wall — no V-pocket
        // for the ball to wedge into. flipAngle swings the tip up the
        // table from there, giving a ~60° total sweep.
        Flipper: {
          restAngle: -0.555, flipAngle: 0.5,
          flipSpeed: 24, returnSpeed: 12,
          triggerKey: 'ShiftLeft',
          taperedGeometry: true,
          length: 2.4,
          direction: 'left',
          // Anti-tunneling. Tip speed at 24 rad/s × 2.4 length ≈ 58 u/s,
          // so the tip moves ~0.96 u per 60Hz frame — bigger than the
          // visible bat's 0.3-half-depth tip. Inflate Z to 1.6 wide so
          // the swept face fully covers the ball (0.84 dia) between
          // Havok substeps. Y inflation is small — just enough to catch
          // a ball that's bouncing at slight altitude.
          colliderInflate: { y: 0.1, z: 0.5 },
        },
        // Hinge tracks the inlane row: x = -W*0.1875, z = halfD - 1.5.
        PinballLayout: { xCoeff: -0.1875, zCoeff: 0.5, zOffset: -1.5 },
      },
    },
    Flipper_Right: {
      tags: ['flipper', 'flipper-right'],
      components: {
        MeshPrimitive: {
          primitive: 'box', width: 2.4, height: 0.4, depth: 0.6,
          position: [3, 0.3, 15.1],
          material: { diffuseColor: [0.85, 0.85, 0.95], emissiveColor: [0.1, 0.1, 0.2] },
        },
        Shadow: { castShadow: true, receiveShadow: true },
        Physics: {
          shapeType: 'box', motionType: 'kinematic',
          mass: 1, restitution: 0.4, friction: 0.1,
          autoCreate: false,
        },
        Flipper: {
          restAngle: 0.555, flipAngle: -0.5,
          flipSpeed: 24, returnSpeed: 12,
          triggerKey: 'ShiftRight',
          taperedGeometry: true,
          length: 2.4,
          direction: 'right',
          colliderInflate: { y: 0.1, z: 0.5 },
        },
        PinballLayout: { xCoeff: 0.1875, zCoeff: 0.5, zOffset: -1.5 },
      },
    },
    // The ball. Regulation pinball is 1+1/16" diameter; at 16 units = 20.25"
    // that's 0.84 units. Friction is near-zero and restitution moderate, so
    // it slides like a chrome ball and bounces crisply off walls instead of
    // dying on first contact.
    Ball: {
      tags: ['ball'],
      components: {
        MeshPrimitive: {
          primitive: 'sphere', diameter: 0.84, segments: 24,
          position: [0, 0.5, -14],
          material: { diffuseColor: [0.95, 0.95, 1.0], emissiveColor: [0.15, 0.15, 0.2] },
        },
        Shadow: { castShadow: true, receiveShadow: false },
        Physics: { shapeType: 'sphere', motionType: 'dynamic', mass: 1, restitution: 0.55, friction: 0.02 },
      },
    },
    Camera: {
      components: {
        ArcCamera: {
          // follow=false → frames the table (restTarget). Toggle follow on (the
          // Camera panel) to track the ball. controlsEnabled:false so the
          // ArcCameraSystem owns the radius (= distance), which the panel zooms.
          target: 'Ball',
          restTarget: 'Playfield',
          follow: false,
          controlsEnabled: false,
          // distance gets re-fitted by PinballCamera the moment the
          // PinballTable system broadcasts dimensions, so the seed value
          // just has to be large enough that the camera isn't inside the
          // table on the first frame. min/maxDistance are bumped up so the
          // dynamic fit isn't clamped.
          distance: 55,
          minDistance: 10, maxDistance: 200,
          // beta matched to the shooter (0.55) for a shared tilt; alpha stays
          // per-table since it sets which side you view the playfield from.
          alpha: 1.5708, beta: 0.55,
          minBeta: 0.55, maxBeta: 0.55,
        },
        // Locks the ArcCamera into pinball's "no orbiting / fixed beta /
        // table-fitted radius" shape. Detaches pointer controls, overrides
        // FOV, and auto-fits the radius to the live PinballTable dims.
        PinballCamera: { fov: 1.15, lockControls: true, marginFactor: 1.55 },
        // On-screen camera controls (toggle with C): zoom, pan, follow ball.
        ArcCameraDebugger: { activationKey: 'KeyC', position: 'top-left' },
      },
    },
    // Single source of truth for table dimensions. PinballLayoutSystem and
    // PinballCameraSystem subscribe to its `pinballTable.resized` event:
    // changing width/depth via the viz panel restyles the whole table.
    Table: {
      components: {
        PinballTable: { width: 16, depth: 33.2 },
        PinballTableDebugger: { visible: true, position: 'top-left' },
      },
    },
    // Debug overlay: wireframe boxes showing the inflated Flipper colliders
    // (Digit5 to toggle). Lets you SEE the swept anti-tunnel volume vs the
    // slimmer visible bat. Visible by default while we dial in the inflation.
    FlipperColliderDbg: {
      components: {
        FlipperColliderDebugger: { visible: true },
      },
    },
    // Pinball world/physics panel: sim Hz, world gravity, bumper restitution,
    // and a "show colliders" wireframe toggle. Games-local panel — excluded
    // from the scaffold template.
    // Live element builder. PinballBuilder handles spawn events from the
    // viz panel; PinballBuilderInput owns the canvas pointer handling for
    // freehand draw mode (the panel toggles it via `pinballBuilder.setDrawMode`
    // and the input system emits `pinballBuilder.drawPath` on pointerup,
    // which PinballBuilder smooths + segments into rails/walls).
    Builder: {
      tags: ['builder'],
      components: {
        PinballBuilder: {},
        PinballBuilderInput: {},
        PinballBuilderDebugger: { visible: false, position: 'top-left' },
      },
    },
    // Score state — single-player pinball. Bumpers emit `score.add` with
    // ownerEntity:"Player" so this bucket is the one that accumulates.
    ScoreState: {
      components: {
        Score: { defaultPoints: 100, scores: { Player: 0 } },
      },
    },
    // On-screen HUD wired to Score via the `score.changed` event. The
    // ScoreboardDebugger panel is the visible HUD; visible:true keeps it
    // painted, Digit2 toggles.
    Scoreboard: {
      components: {
        Scoreboard: {
          title: 'PINBALL',
          fontSize: 22,
          position: 'top-right',
          players: [{ entityId: 'Player', name: 'P1', color: [0.95, 0.85, 0.35] }],
        },
        ScoreboardDebugger: { visible: true, position: 'top-right' },
      },
    },
    // Singleton "World" entity. Carries:
    //   • marker components for systems that act on RUNTIME-spawned entities
    //     (spinners + saucers placed via the builder panel) — their queries
    //     require MeshPrimitive too, so the no-mesh markers don't get
    //     processed; they exist only so SceneLoader sees the names and
    //     registers SpinnerSystem / MouseHoleSystem;
    //   • the Plunger, which owns the ball lifecycle (gravity, auto-launch
    //     on physics-ready, drain detection, Space=re-plunge, chrome material
    //     swap). It finds the ball by tag and listens to PinballTable resizes
    //     for the drain-Z threshold.
    World: {
      components: {
        Spinner: {},
        MouseHole: {},
        Plunger: {
          ballTag: 'ball',
          spawnPosition: [0, 0.42, -14.5],
          gravity: [0, -12, 14],
          launchVelocityZ: 16,
          launchJitterX: 2.5,
          drainY: -3,
          drainZMargin: 2,
          triggerKey: 'Space',
        },
      },
    },
  },
}
