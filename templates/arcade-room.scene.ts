/**
 * Arcade Room — the starter scene for a multigame arcade.
 *
 * A real-world-scaled room you STAND IN and walk around with the keyboard: a
 * textured carpet floor, four walls + ceiling, warm lighting, and an arcade
 * cabinet against the back wall facing you. It is pure scene data — every entity
 * is composed from FREE @babylonjsmarket/arcade components, so it renders with
 * no extra wiring.
 *
 * Controls (FirstPersonCamera): W/S walk, A/D turn, Q/E strafe. You spawn just
 * inside the door at standing eye height, facing the cabinet.
 *
 * ── Assets ──────────────────────────────────────────────────────────────────
 * The carpet textures and the cabinet model are marketplace assets — pull them
 * into this project's `public/` once with the CLI:
 *
 *     bjs download arcade-carpet     # → public/arcade/Carpet013_1K-JPG/*.webp
 *     bjs download arcade-cabinet    # → public/arcade/QBERT_TEMPLATE.glb
 *
 * They land under `public/arcade/`, exactly where the paths below expect them.
 * Until you download them the room still runs — you just get an untextured
 * floor and no cabinets. Swap in your own art by editing the paths.
 *
 * This is a STARTING POINT. The intended next step is to "fill" the room — wire
 * each cabinet to a subdirectory game (a separate scene module added to
 * `src/scenes/index.ts`). See the cabinet block below and the README.
 */

// Where the room's assets live, relative to the site root. Assets downloaded
// with `bjs download` land under `public/`, served from `/`. Point this at a
// CDN if you host your own optimized copies.
const ASSET_BASE = ''

// Room footprint (metres) — a cozy, real-world-scaled arcade. The floor spans
// [-W/2, W/2] × [-D/2, D/2]; walls are H tall. A real arcade ceiling is ~3.5 m.
const W = 12
const D = 10
const H = 3.5
const T = 0.2 // wall thickness

// Carpet PBR texture set, optimized to WebP by the asset pipeline (albedo +
// normal + roughness + AO). Any one texture URL flips the floor's MeshPrimitive
// to a PBR material. uScale/vScale tile the maps; the physical carpet swatch is
// ~0.8 m, so tiles ≈ span / 0.8 keeps the pile at life size.
const CARPET = `${ASSET_BASE}/arcade/Carpet013_1K-JPG/Carpet013_1K-JPG`
const FLOOR_MATERIAL = {
  albedoTexture: `${CARPET}_Color.webp`,
  normalTexture: `${CARPET}_NormalGL.webp`,
  roughnessTexture: `${CARPET}_Roughness.webp`,
  ambientTexture: `${CARPET}_AmbientOcclusion.webp`,
  roughness: 0.9,
  uScale: Math.round(W / 0.8), // ~15 tiles across a 12 m floor
  vScale: Math.round(D / 0.8), // ~12 tiles deep
}

// Wall / ceiling material — matte dark so the neon-lit cabinets pop.
const SURFACE = { diffuseColor: [0.12, 0.1, 0.16] as [number, number, number], specularColor: [0, 0, 0] as [number, number, number] }

// Cabinet model. One shared template (`instanced: true`) is cloned per machine,
// so the GLB loads once no matter how many cabinets reference it. It stands
// ~1.73 m native; scale 1.1 → a real ~1.9 m cabinet, base seated on the floor.
// rotation [0, 0, 0] is the model's native facing — screen + controls toward
// +Z, i.e. toward the player spawn. (A π turn would show the cabinet's back.)
const CABINET_GLB = `${ASSET_BASE}/arcade/QBERT_TEMPLATE.glb`
const CABINET_SCALE = 1.1
const CABINET_Z = -D / 2 + 0.6 // hard against the back wall
const cabinet = (x: number) => ({
  components: {
    Mesh: {
      src: CABINET_GLB,
      instanced: true,
      position: [x, 0, CABINET_Z],
      rotation: [0, 0, 0],
      scale: CABINET_SCALE,
      autoLoad: true,
    },
  },
})

export const ARCADE_ROOM = {
  name: 'ArcadeRoom',
  clearColor: [0.02, 0.02, 0.04, 1],
  entities: {
    // Warm key light raking across the room + a cool hemispheric fill so the
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
          shadowMaxZ: 40,
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
    // Four walls (thin boxes). N/S run along x at ±D/2; E/W run along z at ±W/2.
    Wall_N: {
      components: {
        MeshPrimitive: { primitive: 'box', width: W, height: H, depth: T, position: [0, H / 2, -D / 2], material: SURFACE },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_S: {
      components: {
        MeshPrimitive: { primitive: 'box', width: W, height: H, depth: T, position: [0, H / 2, D / 2], material: SURFACE },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_E: {
      components: {
        MeshPrimitive: { primitive: 'box', width: T, height: H, depth: D, position: [W / 2, H / 2, 0], material: SURFACE },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Wall_W: {
      components: {
        MeshPrimitive: { primitive: 'box', width: T, height: H, depth: D, position: [-W / 2, H / 2, 0], material: SURFACE },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },

    // One cabinet, centered against the back wall, facing the player. Add more
    // — `Cabinet_2: cabinet(1.8)`, etc. — or wire each to a subdirectory game by
    // editing these entries (see README).
    Cabinet_1: cabinet(0),

    // First-person walk camera. You spawn just inside the front wall at
    // standing eye height, facing the cabinets (-Z). Bounds keep you inside the
    // room (inset ~0.5 m from the walls). W/S walk, A/D turn, Q/E strafe.
    Player: {
      components: {
        FirstPersonCamera: {
          eyeHeight: 1.7,
          position: [0, D / 2 - 1.5],
          yaw: Math.PI, // face -Z, toward the back-wall cabinets
          moveSpeed: 3,
          turnSpeed: 1.8,
          fov: 1.1,
          bounds: {
            minX: -W / 2 + 0.5,
            maxX: W / 2 - 0.5,
            minZ: -D / 2 + 0.5,
            maxZ: D / 2 - 0.5,
          },
        },
      },
    },
  },
}
