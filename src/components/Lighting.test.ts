import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LightingComponent, LightingSystem } from "./Lighting";
import {
  Vector3,
  Scene,
  NullEngine,
  HemisphericLight,
  DirectionalLight,
} from "@babylonjs/core";
import {
  createTestEngine,
  createTestScene,
  createTestWorld,
  createTestEntity,
  createTestComponentWithData,
  createTestSystemWithWorld,
  cleanupBabylonObjects,
  expectVector3ToEqual,
  createLightingComponentData,
} from "../test/helpers";

describe("LightingComponent", () => {
  it("should create a lighting component with correct types", () => {
    const data = createLightingComponentData(
      ["ambient", "directional"],
      true,
      [0, 5, 0],
    );

    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      data,
    );

    expect(lightingComponent.types).toEqual(["ambient", "directional"]);
    expect(lightingComponent.shadows).toBe(true);
    expect(lightingComponent.offset).toEqual([0, 5, 0]);
  });

  it("should initialize with empty lights array", () => {
    const data = createLightingComponentData(["ambient"], false, [1, 1, 1]);

    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      data,
    );

    expect(lightingComponent.lights).toEqual([]);
    expect(Array.isArray(lightingComponent.lights)).toBe(true);
  });

  it("should handle different light type combinations", () => {
    const ambientOnlyData = createLightingComponentData(
      ["ambient"],
      false,
      [0, 0, 0],
    );
    const directionalOnlyData = createLightingComponentData(
      ["directional"],
      true,
      [1, 2, 3],
    );

    const ambientOnly = createTestComponentWithData(
      LightingComponent,
      ambientOnlyData,
    );
    const directionalOnly = createTestComponentWithData(
      LightingComponent,
      directionalOnlyData,
    );

    expect(ambientOnly.types).toEqual(["ambient"]);
    expect(directionalOnly.types).toEqual(["directional"]);
    expect(ambientOnly.shadows).toBe(false);
    expect(directionalOnly.shadows).toBe(true);
  });

  it("should inherit from Component base class", () => {
    const data = createLightingComponentData(["ambient"], false, [0, 0, 0]);

    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      data,
    );

    expect(lightingComponent.enabled).toBe(true);
    expect(lightingComponent.loaded).toBe(false);
    expect(lightingComponent.loading).toBe(false);
  });

  it("should handle custom offset values", () => {
    const customOffset: [number, number, number] = [-2, 10, 5];
    const data = createLightingComponentData(["ambient"], false, customOffset);

    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      data,
    );

    expect(lightingComponent.offset).toEqual(customOffset);
  });
});

describe("LightingSystem", () => {
  let lightingSystem: LightingSystem;
  let world: any;
  let entity: any;
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = createTestEngine();
    scene = createTestScene(engine);
    world = createTestWorld();
    world.currentScene = scene;

    lightingSystem = createTestSystemWithWorld(LightingSystem, world, [
      LightingComponent,
    ]);
    entity = createTestEntity("TestLightingEntity", scene);

    // Add entity to world
    world.entities.set(entity.name, entity);
  });

  afterEach(() => {
    cleanupBabylonObjects(scene, engine);
  });

  it("should create a lighting system with real scene", () => {
    expect(lightingSystem).toBeDefined();
    expect(lightingSystem.scene).toBeInstanceOf(Scene);
    expect(lightingSystem.world).toBe(world);
  });

  it("should have scene with real Babylon.js engine", () => {
    expect(lightingSystem.scene.getEngine()).toBeInstanceOf(NullEngine);
    expect(typeof lightingSystem.scene.getNodeByName).toBe("function");
  });

  it("should load entity with ambient light and create real HemisphericLight", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    expect(component.loaded).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.lights).toHaveLength(1);
    expect(component.lights[0]).toBeInstanceOf(HemisphericLight);
  });

  it("should load entity with directional light and create real DirectionalLight", () => {
    const lightingComponentData = createLightingComponentData(
      ["directional"],
      true,
      [1, 1, 1],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    expect(component.loaded).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.lights).toHaveLength(1);
    expect(component.lights[0]).toBeInstanceOf(DirectionalLight);
  });

  it("should create multiple lights for multiple types", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient", "directional"],
      true,
      [0, 5, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    expect(component.lights).toHaveLength(2);
    expect(component.lights[0]).toBeInstanceOf(HemisphericLight);
    expect(component.lights[1]).toBeInstanceOf(DirectionalLight);
  });

  it("should set correct intensity for single ambient light", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    const ambientLight = component.lights[0] as HemisphericLight;
    expect(ambientLight.intensity).toBe(5); // Single light gets intensity 5
  });

  it("should set correct intensity for ambient light when multiple lights exist", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient", "directional"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    const ambientLight = component.lights[0] as HemisphericLight;
    expect(ambientLight.intensity).toBe(0.6); // Multiple lights get intensity 0.6
  });

  it("should set correct properties for directional light", () => {
    const lightingComponentData = createLightingComponentData(
      ["directional"],
      true,
      [1, -1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    const directionalLight = component.lights[0] as DirectionalLight;
    expect(directionalLight.intensity).toBe(3);
    expect(directionalLight.autoCalcShadowZBounds).toBe(true);
  });

  it("should use real Vector3.FromArray for light direction", () => {
    const customOffset: [number, number, number] = [-2, -3, -1];
    const lightingComponentData = createLightingComponentData(
      ["ambient"],
      false,
      customOffset,
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    const ambientLight = component.lights[0] as HemisphericLight;

    // The direction should be a real Vector3 created from the offset array
    expect(ambientLight.direction).toBeInstanceOf(Vector3);
    expectVector3ToEqual(ambientLight.direction, { x: -2, y: -3, z: -1 });
  });

  it("should set loading state correctly during initialization", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    // Check initial state
    expect(lightingComponent.loading).toBe(false);
    expect(lightingComponent.loaded).toBe(false);

    lightingSystem.loadEntity(entity);

    // After loading
    const component = entity.getComponent(LightingComponent);
    expect(component.loading).toBe(false);
    expect(component.loaded).toBe(true);
  });

  it("should handle empty types array gracefully", () => {
    const lightingComponentData = {
      types: [],
      shadows: false,
      offset: [0, 0, 0],
    };
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    expect(() => {
      lightingSystem.loadEntity(entity);
    }).not.toThrow();

    const component = entity.getComponent(LightingComponent);
    expect(component.lights).toHaveLength(0);
    expect(component.loaded).toBe(true);
  });

  it("should create lights with proper scene reference", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient", "directional"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    component.lights.forEach((light) => {
      expect(light.getScene()).toBe(scene);
    });
  });

  it("should dispose lights properly", () => {
    const lightingComponentData = createLightingComponentData(
      ["ambient"],
      false,
      [0, 1, 0],
    );
    const lightingComponent = createTestComponentWithData(
      LightingComponent,
      lightingComponentData,
    );
    entity.addComponent(lightingComponent);

    lightingSystem.loadEntity(entity);

    const component = entity.getComponent(LightingComponent);
    const light = component.lights[0];

    // Verify light can be disposed (has dispose method)
    expect(typeof light.dispose).toBe("function");

    // Actually dispose it
    light.dispose();
    expect(light.isDisposed()).toBe(true);
  });
});
