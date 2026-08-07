/**
 * Arcade Room — the starter scene for a multigame arcade.
 *
 * A real-world-scaled room you STAND IN and walk around with the keyboard: a
 * textured carpet floor, four walls + ceiling, warm lighting, and an arcade
 * cabinet against the back wall facing you. It is pure scene data — every entity
 * is composed from FREE @babylonjsmarket/arcade components, so it renders with
 * no extra wiring.
 *
 * Controls (FirstPersonCamera): W/S or ↑/↓ walk, A/D or ←/→ turn, Q/E strafe.
 * You spawn just inside the door at standing eye height, facing the cabinets.
 *
 * ── Assets ──────────────────────────────────────────────────────────────────
 * The carpet textures, the cabinet model and the cabinet skins are marketplace
 * assets — pull them into this project's `public/` once with the CLI:
 *
 *     bjs download arcade-carpet        # → public/arcade/Carpet013_1K-JPG/*.webp
 *     bjs download arcade-cabinet       # → public/arcade/QBERT_TEMPLATE.glb
 *     bjs download arcade-cabinet-skins # → public/arcade/cabinet-skins/*.webp
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
  // Sun + fill + five neon lights = 7. Babylon's default cap is 4, and lights
  // past the cap are silently dropped — without this the carpet simply never
  // catches the neon.
  maxSimultaneousLights: 8,
}

// Wall / ceiling material — matte dark so the neon-lit cabinets pop.
const SURFACE = {
  diffuseColor: [0.12, 0.1, 0.16] as [number, number, number],
  specularColor: [0, 0, 0] as [number, number, number],
  // See FLOOR_MATERIAL — the walls are what the neon actually washes over, so
  // they need the raised cap most of all.
  maxSimultaneousLights: 8,
}

// ── Neon ────────────────────────────────────────────────────────────────────
// A neon sign is TWO entities that have to agree, and it's worth knowing why:
//
//   1. an emissive panel — the tube itself. Emissive means "draw this bright";
//      it does NOT light anything around it.
//   2. a PointLight just in front of it — the glow actually landing on the
//      wall, the carpet and the sides of nearby cabinets.
//
// Skip the light and the sign looks like a sticker; skip the panel and you get
// unexplained colour with no source. Together they're what turns a dark box
// into an arcade.
const NEON_W = 1.8
const NEON_H = 0.34
const NEON_Y = 2.5 // above the cabinets, below the ceiling
// Just off the wall — a light AT the wall mostly lights the wall's back face.
const NEON_LIGHT_OFFSET = 0.45
const NEON_INTENSITY = 6
const NEON_RANGE = 7

/**
 * One sign on the back (-Z) wall at `x`, and one on a side wall when `side` is
 * given. `color` drives BOTH the panel's emissive and the light, which is what
 * sells it as one object.
 */
const neonPanel = (
  x: number,
  z: number,
  color: [number, number, number],
  rotY = 0,
) => ({
  components: {
    MeshPrimitive: {
      primitive: 'plane',
      width: NEON_W,
      height: NEON_H,
      position: [x, NEON_Y, z],
      rotation: [0, rotY, 0],
      material: {
        // Near-black albedo + hot emissive = a glowing tube rather than a
        // pastel panel: emissive ADDS on top of the lit base colour.
        diffuseColor: [0.02, 0.02, 0.02] as [number, number, number],
        emissiveColor: color,
        specularColor: [0, 0, 0] as [number, number, number],
      },
    },
  },
})

const neonGlow = (
  x: number,
  z: number,
  color: [number, number, number],
) => ({
  components: {
    PointLight: {
      position: [x, NEON_Y, z],
      diffuse: color,
      intensity: NEON_INTENSITY,
      range: NEON_RANGE,
    },
  },
})

// Hot pink / electric cyan / violet — the classic arcade palette. Reuse these
// or pick your own; the panel and its light must share a colour.
const NEON_PINK: [number, number, number] = [1.0, 0.15, 0.55]
const NEON_CYAN: [number, number, number] = [0.15, 0.9, 1.0]
const NEON_VIOLET: [number, number, number] = [0.75, 0.3, 1.0]

// Cabinet model. One shared template (`instanced: true`) is cloned per machine,
// so the GLB loads once no matter how many cabinets reference it. It stands
// ~1.73 m native; scale 1.1 → a real ~1.9 m cabinet, base seated on the floor.
// rotation [0, 0, 0] is the model's native facing — screen + controls toward
// +Z, i.e. toward the player spawn. (A π turn would show the cabinet's back.)
const CABINET_GLB = `${ASSET_BASE}/arcade/QBERT_TEMPLATE.glb`
const CABINET_SCALE = 1.1
const CABINET_Z = -D / 2 + 0.6 // hard against the back wall

// Skins shipped by `bjs download arcade-cabinet-skins`. Use any of these names
// with `cabinet()` below.
//
// A skin is a whole cabinet's worth of art on ONE 2048² sheet — marquee, screen,
// control panel, side art and bezel all live in it, and the model's materials
// each index their own region of it. That is why a row of machines can look
// completely different while still being one downloaded GLB rendered from one
// shared template: only the sheet changes.
export const CABINET_SKINS = [
  'asteroids', 'centipede', 'dig-dug', 'donkey-kong', 'frogger',
  'galaga', 'missile-command', 'mortal-kombat', 'pacman', 'roboball',
  'spaceshooter', 'spy-hunter', 'street-fighter', 'terminator-2', 'tmnt',
] as const

/**
 * One machine at `x` along the back wall, running `skin`.
 *
 * `extrasFlag: 'cabinetAtlas'` is the important bit: the cabinet's asset tags
 * exactly those materials that read from the atlas, so the swap re-dresses the
 * artwork and leaves the chrome, black plastic and joystick alone. Pass no skin
 * to get the model's own Q*bert art.
 */
const cabinet = (
  x: number,
  skin?: (typeof CABINET_SKINS)[number],
  game?: string,
) => ({
  components: {
    Mesh: {
      src: CABINET_GLB,
      instanced: true,
      position: [x, 0, CABINET_Z],
      rotation: [0, 0, 0],
      scale: CABINET_SCALE,
      autoLoad: true,
      ...(skin
        ? {
            skin: {
              albedoTexture: `${ASSET_BASE}/arcade/cabinet-skins/${skin}.webp`,
              extrasFlag: 'cabinetAtlas',
            },
          }
        : {}),
    },
    // Makes the machine clickable: one click walks you over, two starts the
    // game. `facing: 0` matches the Mesh rotation above (screen toward +Z), so
    // CabinetLink knows which side to stand you on. Point `game` at a folder
    // under src/games/ — `npm create @babylonjsmarket/arcade <name>` run inside
    // this project creates one and wires it up.
    CabinetLink: {
      game: game ?? '',
      title: game ?? skin ?? 'Cabinet',
      facing: 0,
      standoff: 1.3,
      interactive: !!game,
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
          // Low: an arcade is a dark room. This only keeps the geometry
          // readable so the neon has something to fall on.
          intensity: 0.35,
          diffuse: [1.0, 0.86, 0.72],
          shadowEnabled: true,
          shadowMapSize: 2048,
          shadowMinZ: 0.1,
          shadowMaxZ: 40,
        },
      },
    },
    // Deliberately dim. The neon below is the room's real light source, and a
    // bright ambient fill would wash its colour straight off the walls — turn
    // this up only if you remove the signs.
    Fill: {
      components: {
        HemisphericLight: {
          intensity: 0.18,
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

    // A row of five machines against the back wall, facing the player, each
    // running a different game. Spacing is ~1.9 m — enough that you can walk
    // up to any one of them. Add more, change the line-up to any name from
    // CABINET_SKINS, or wire each cabinet to a subdirectory game by editing
    // these entries (see README).
    Cabinet_1: cabinet(-3.8, 'galaga'),
    Cabinet_2: cabinet(-1.9, 'frogger'),
    Cabinet_3: cabinet(0, 'donkey-kong'),
    Cabinet_4: cabinet(1.9, 'pacman'),
    Cabinet_5: cabinet(3.8, 'asteroids'),

    // Neon: three signs on the back wall and one on each side wall, each a
    // panel + a matching light (see the neon block above). The side signs face
    // inward, so their planes are turned ±90°.
    Neon_Back_L: neonPanel(-3.6, -D / 2 + T, NEON_PINK),
    Neon_Back_L_Glow: neonGlow(-3.6, -D / 2 + NEON_LIGHT_OFFSET, NEON_PINK),
    Neon_Back_C: neonPanel(0, -D / 2 + T, NEON_CYAN),
    Neon_Back_C_Glow: neonGlow(0, -D / 2 + NEON_LIGHT_OFFSET, NEON_CYAN),
    Neon_Back_R: neonPanel(3.6, -D / 2 + T, NEON_VIOLET),
    Neon_Back_R_Glow: neonGlow(3.6, -D / 2 + NEON_LIGHT_OFFSET, NEON_VIOLET),

    Neon_Left: neonPanel(-W / 2 + T, -1, NEON_CYAN, Math.PI / 2),
    Neon_Left_Glow: neonGlow(-W / 2 + NEON_LIGHT_OFFSET, -1, NEON_CYAN),
    Neon_Right: neonPanel(W / 2 - T, -1, NEON_PINK, -Math.PI / 2),
    Neon_Right_Glow: neonGlow(W / 2 - NEON_LIGHT_OFFSET, -1, NEON_PINK),

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
