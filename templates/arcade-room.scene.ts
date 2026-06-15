/**
 * Arcade Room — the starter scene for a multigame arcade.
 *
 * A simple, walk-up-able room (carpet floor, four walls + ceiling, warm
 * neon-ish lighting) with a row of cabinet machines along the back wall. It is
 * the ECS counterpart of the hand-built `ArcadeScene` demo: pure scene data,
 * composed entirely from components the @babylonjsmarket/arcade package already
 * knows how to instantiate.
 *
 * This is a STARTING POINT. The intended next step is to "fill" the room — each
 * cabinet points a player at a subdirectory game (a separate scene module added
 * to `src/scenes/index.ts`). See the cabinet block below and the README.
 *
 * Assets are streamed from the public BabylonJS Games asset host so a fresh
 * scaffold runs with zero local files. Drop your own optimized copies under
 * `public/arcade/` and flip `ASSET_BASE` to '' to serve them locally.
 */

// Public asset host. The carpet PBR set + cabinet GLB live under `/arcade/`.
const ASSET_BASE = 'https://babylonjsgames.com'

// Room footprint (metres). Floor spans [-W/2, W/2] × [-D/2, D/2]; walls are H tall.
const W = 16
const D = 12
const H = 4
const T = 0.2 // wall thickness

// Carpet PBR texture set (albedo + normal + roughness + AO), tiled across the
// floor. This is the capability the arcade package adds on top of flat colors:
// a MeshPrimitive whose `material` carries texture URLs renders as PBR.
const CARPET = `${ASSET_BASE}/arcade/Carpet013_1K-JPG/Carpet013_1K-JPG`
const FLOOR_MATERIAL = {
  albedoTexture: `${CARPET}_Color.jpg`,
  normalTexture: `${CARPET}_NormalGL.jpg`,
  roughnessTexture: `${CARPET}_Roughness.jpg`,
  ambientTexture: `${CARPET}_AmbientOcclusion.jpg`,
  roughness: 0.9,
  // ~1.25 tiles / metre, matching the hand-built room's carpet density.
  uScale: 20,
  vScale: 15,
}

// Cabinet model. One shared template (`instanced: true`) cloned per machine —
// loads the GLB once no matter how many cabinets reference it. scale/rotation
// are starting values; tune them to your own cabinet art.
const CABINET_GLB = `${ASSET_BASE}/arcade/QBERT_TEMPLATE.glb`
const CABINET_Z = -D / 2 + 0.7 // hard against the back wall, facing into the room
const cabinet = (x: number) => ({
  components: {
    Mesh: {
      src: CABINET_GLB,
      instanced: true,
      position: [x, 0, CABINET_Z],
      rotation: [0, 0, 0],
      scale: 1,
      autoLoad: true,
    },
  },
})

export const ARCADE_ROOM = {
  name: 'ArcadeRoom',
  clearColor: [0.02, 0.02, 0.04, 1],
  entities: {
    // Warm key light raking across the room, plus a cool ambient fill so the
    // carpet's normal map reads without the room going pitch black.
    Sun: {
      tags: ['sun'],
      components: {
        DirectionalLight: {
          direction: [-0.3, -0.85, -0.4],
          intensity: 1.1,
          diffuse: [1.0, 0.86, 0.72],
          shadowEnabled: true,
          shadowMapSize: 2048,
          shadowMinZ: 0.1,
          shadowMaxZ: 60,
        },
      },
    },
    Fill: {
      components: {
        HemisphericLight: {
          intensity: 0.45,
          diffuse: [0.55, 0.6, 0.85],
          groundColor: [0.14, 0.12, 0.18],
        },
      },
    },

    // Carpet floor — the textured PBR ground.
    Floor: {
      components: {
        MeshPrimitive: { primitive: 'ground', width: W, depth: D, material: FLOOR_MATERIAL },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Ceiling: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: W, height: T, depth: D, position: [0, H, 0],
          material: { diffuseColor: [0.05, 0.05, 0.07], specularColor: [0, 0, 0] },
        },
      },
    },
    Wall_N: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: W, height: H, depth: T, position: [0, H / 2, -D / 2],
          material: { diffuseColor: [0.12, 0.1, 0.16], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_S: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: W, height: H, depth: T, position: [0, H / 2, D / 2],
          material: { diffuseColor: [0.12, 0.1, 0.16], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_E: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: T, height: H, depth: D, position: [W / 2, H / 2, 0],
          material: { diffuseColor: [0.12, 0.1, 0.16], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_W: {
      components: {
        MeshPrimitive: {
          primitive: 'box', width: T, height: H, depth: D, position: [-W / 2, H / 2, 0],
          material: { diffuseColor: [0.12, 0.1, 0.16], specularColor: [0, 0, 0] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },

    // A row of cabinets along the back wall. Add more, or wire each one to a
    // subdirectory game, by editing these entries (see README).
    Cabinet_1: cabinet(-4.5),
    Cabinet_2: cabinet(-1.5),
    Cabinet_3: cabinet(1.5),
    Cabinet_4: cabinet(4.5),

    // Free-orbit camera framing the room. Drag to look around; wheel to dolly.
    Camera: {
      components: {
        ArcCamera: {
          follow: false,
          distance: 15,
          alpha: -1.1,
          beta: 1.15,
          minBeta: 0.2,
          maxBeta: 1.45,
          targetOffset: [0, 1.2, 0],
        },
      },
    },
  },
}
