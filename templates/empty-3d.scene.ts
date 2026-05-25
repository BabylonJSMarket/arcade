/**
 * Empty 3D scene — cinematic sunset baseline. Sky tracks the sun, ground
 * receives shadows, a hero sphere casts one, a ring of accent cubes for
 * scale, two pillars for depth. Orbit the hero with the mouse.
 *
 * Every key in `entities` becomes a live ECS entity; every key under
 * `components` is a registered component the arcade package knows how to
 * instantiate. Edit values, save, hot-reload.
 */
export const SCENE = {
  name: 'Empty3D',
  clearColor: [0.08, 0.1, 0.18, 1],
  entities: {
    Sky: {
      tags: ['sky'],
      components: {
        Skybox: {
          followLight: 'sun',
          zenithColor: [0.07, 0.1, 0.28],
          horizonColor: [0.98, 0.55, 0.32],
          groundColor: [0.06, 0.05, 0.09],
          sunColor: [1.0, 0.85, 0.6],
          sunGlowSize: 70,
        },
      },
    },
    Sun: {
      tags: ['sun'],
      components: {
        DirectionalLight: {
          direction: [-0.45, -0.25, -0.35],
          intensity: 2.4,
          diffuse: [1.0, 0.85, 0.65],
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
          intensity: 0.35,
          diffuse: [0.55, 0.7, 1.0],
          groundColor: [0.18, 0.16, 0.22],
        },
      },
    },
    Ground: {
      components: {
        MeshPrimitive: {
          primitive: 'ground',
          width: 200,
          depth: 200,
          color: [0.18, 0.16, 0.22],
        },
        Shadow: { castShadow: false, receiveShadow: true },
      },
    },
    Hero: {
      components: {
        MeshPrimitive: {
          primitive: 'sphere',
          diameter: 2,
          segments: 32,
          position: [0, 1.2, 0],
          material: { diffuse: [0.25, 0.7, 0.95], emissive: [0.08, 0.22, 0.35] },
        },
        Shadow: { castShadow: true, receiveShadow: false },
      },
    },
    Accent0: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [3.5, 0.3, 0], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Accent1: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [1.75, 0.3, 3.03], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Accent2: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [-1.75, 0.3, 3.03], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Accent3: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [-3.5, 0.3, 0], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Accent4: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [-1.75, 0.3, -3.03], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Accent5: {
      components: {
        MeshPrimitive: { primitive: 'box', width: 0.5, height: 0.5, depth: 0.5, position: [1.75, 0.3, -3.03], color: [0.9, 0.35, 0.75] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Pillar_NE: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 0.8, height: 3, position: [7, 1.5, 5], color: [0.7, 0.55, 0.35] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Pillar_SW: {
      components: {
        MeshPrimitive: { primitive: 'cylinder', diameter: 0.8, height: 3, position: [-7, 1.5, -5], color: [0.7, 0.55, 0.35] },
        Shadow: { castShadow: true, receiveShadow: true },
      },
    },
    Camera: {
      components: {
        ArcCamera: { target: 'Hero', radius: 12, alpha: -1.2, beta: 1.15 },
      },
    },
  },
}
