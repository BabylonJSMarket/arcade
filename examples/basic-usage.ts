// Basic usage example of my-arcade ECS library
import { World, Entity, CameraComponent, LightingComponent } from 'my-arcade';
import { Scene, Engine, Vector3 } from '@babylonjs/core';

// Create a BabylonJS scene and engine (required for the ECS system)
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Create the ECS World
const world = new World();
world.currentScene = scene;

// Create entities
const cameraEntity = new Entity("MainCamera");
const lightEntity = new Entity("MainLight");

// Add components to entities
cameraEntity.addComponent(new CameraComponent({
  type: "Free",
  offset: [0, 5, -10]
}));

lightEntity.addComponent(new LightingComponent({
  types: ["ambient", "directional"],
  shadows: true,
  offset: [0, 10, 5]
}));

// Add entities to the world
world.addEntity(cameraEntity);
world.addEntity(lightEntity);

// Game loop
engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime();
  world.update(deltaTime);
  scene.render();
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});
