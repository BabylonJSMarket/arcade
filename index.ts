// ECS Core Library
export * from "./src/lib/ECS/index.js";

// Components
export * from "./src/components/index.js";

// Re-export specific classes for convenience
export { Entity, World, Component, System } from "./src/lib/ECS/index.js";
export {
  CameraComponent,
  CameraSystem,
  LightingComponent,
  LightingSystem,
} from "./src/components/index.js";
