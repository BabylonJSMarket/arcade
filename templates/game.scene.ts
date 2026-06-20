/**
 * Game — the starter scene for a single game.
 *
 * A minimal, self-contained scene: a lit ground, one hero mesh, and an orbit
 * camera. Everything is pure scene data, composed entirely from components the
 * @babylonjsmarket/arcade package already knows how to instantiate — and it uses
 * no external assets, so a fresh scaffold runs offline.
 *
 * This is a STARTING POINT. Grow your game by adding entities + components here,
 * or split it into more scenes under `src/scenes/` (registered in
 * `src/scenes/index.ts`). Custom components go under `src/components/` and are
 * wired up via `src/registry.ts`.
 *
 * An "arcade" is just this same idea at scale: many game scenes sharing one code
 * library, fronted by a walk-up "arcade room" home scene whose cabinets launch
 * each game. Scaffold one with:
 *
 *   npm create @babylonjsmarket/arcade -- --kind arcade
 */
export const GAME = {
  name: 'Game',
  clearColor: [0.02, 0.02, 0.04, 1],
  entities: {
    // Warm key light + a cool ambient fill so meshes read without the scene
    // going pitch black.
    Sun: {
      tags: ['sun'],
      components: {
        DirectionalLight: {
          direction: [-0.3, -0.85, -0.4],
          intensity: 1.1,
          diffuse: [1.0, 0.92, 0.84],
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
          intensity: 0.5,
          diffuse: [0.6, 0.66, 0.85],
          groundColor: [0.16, 0.14, 0.2],
        },
      },
    },

    // Flat ground — your playfield.
    Floor: {
      components: {
        MeshPrimitive: {
          primitive: 'ground',
          width: 20,
          depth: 20,
          material: { diffuseColor: [0.16, 0.17, 0.22], specularColor: [0.02, 0.02, 0.02] },
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },

    // Hero — the one thing on screen to start. Swap the primitive, drop on a
    // `Mesh` (a GLB), or add your own components to turn it into a player.
    Hero: {
      tags: ['player'],
      components: {
        MeshPrimitive: {
          primitive: 'capsule',
          height: 2,
          radius: 0.5,
          position: [0, 1, 0],
          material: { diffuseColor: [0.9, 0.5, 0.2] },
        },
        Shadow: { castShadow: true, receiveShadow: false },
      },
    },

    // Free-orbit camera framing the hero. Drag to look around; wheel to dolly.
    Camera: {
      components: {
        ArcCamera: {
          follow: false,
          distance: 8,
          alpha: -1.1,
          beta: 1.15,
          minBeta: 0.2,
          maxBeta: 1.45,
          targetOffset: [0, 1, 0],
        },
      },
    },
  },
}
