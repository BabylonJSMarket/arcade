/**
 * Adapter comparison scene.
 *
 * ONE data-driven ECS scene, rendered side-by-side by every renderer adapter
 * (Babylon · Three+Rapier · Babylon Lite) — see src/main.ts. It uses only stock
 * @babylonjsmarket/arcade components, so it's the same code path a shipped game
 * takes; the only thing that varies between panes is the adapter.
 *
 * What it exercises on every adapter:
 *   - lights + shadows (DirectionalLight shadow map, Shadow cast/receive)
 *   - mesh primitives + materials (box/sphere/cylinder/capsule/ground)
 *   - rigid-body physics (Physics) — Havok on Babylon/Lite, Rapier on Three
 *   - GLB import (Mesh → renderer.loadMesh)
 *   - an orbit camera you can drag in each pane independently (ArcCamera)
 */

// Public Khronos sample GLB (CORS-enabled on raw.githubusercontent).
const DUCK_GLB =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb'

const shape = (
  primitive: string,
  position: [number, number, number],
  color: [number, number, number],
  extra: Record<string, unknown> = {},
) => ({
  components: {
    MeshPrimitive: { primitive, position, material: { diffuseColor: color }, ...extra },
    Shadow: { castShadow: true, receiveShadow: false },
  },
})

const drop = (position: [number, number, number]) => ({
  components: {
    MeshPrimitive: { primitive: 'sphere', diameter: 1, position, material: { diffuseColor: [0.95, 0.55, 0.2] } },
    Physics: { shapeType: 'sphere', motionType: 'dynamic', mass: 1, restitution: 0.6 },
    Shadow: { castShadow: true, receiveShadow: false },
  },
})

export const COMPARE_SCENE = {
  name: 'adapter-compare',
  clearColor: [0.06, 0.07, 0.1, 1],
  entities: {
    Sun: {
      components: {
        DirectionalLight: {
          direction: [-0.5, -1, -0.6],
          position: [12, 18, 10],
          intensity: 1.4,
          diffuse: [1, 0.96, 0.88],
          shadowEnabled: true,
          shadowMapSize: 2048,
          shadowMinZ: 1,
          shadowMaxZ: 80,
        },
      },
    },
    Fill: {
      components: {
        HemisphericLight: { intensity: 0.75, diffuse: [1, 1, 1], groundColor: [0.3, 0.32, 0.4] },
      },
    },
    Floor: {
      components: {
        MeshPrimitive: { primitive: 'ground', width: 24, depth: 24, material: { diffuseColor: [0.16, 0.18, 0.24] } },
        Shadow: { castShadow: false, receiveShadow: true },
        Physics: { shapeType: 'box', motionType: 'static', friction: 0.8 },
      },
    },
    Box: shape('box', [-4.5, 0.8, -5], [0.9, 0.3, 0.35], { width: 1.4, height: 1.6, depth: 1.4 }),
    Sphere: shape('sphere', [-1.5, 0.7, -5], [0.3, 0.7, 0.95], { diameter: 1.4 }),
    Cylinder: shape('cylinder', [1.5, 0.8, -5], [0.95, 0.8, 0.3], { diameter: 1.4, height: 1.6 }),
    Capsule: shape('capsule', [4.5, 0.9, -5], [0.5, 0.9, 0.5], { radius: 0.6, height: 1.8 }),
    Drop0: drop([-3, 6, 0]),
    Drop1: drop([-1, 7.5, 0]),
    Drop2: drop([1, 9, 0]),
    Drop3: drop([3, 10.5, 0]),
    // GLB import — drives renderer.loadMesh on each adapter.
    Duck: {
      components: {
        Mesh: { src: DUCK_GLB, position: [5, 0, -1], scale: 1.5, autoLoad: true },
      },
    },
    Camera: {
      components: {
        ArcCamera: {
          follow: false,
          distance: 16,
          alpha: -1.35,
          beta: 1.0,
          minBeta: 0.2,
          maxBeta: 1.45,
          targetOffset: [0, 1.2, 0],
          controlsEnabled: true,
        },
      },
    },
  },
}
