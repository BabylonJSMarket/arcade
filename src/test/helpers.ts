// Test helpers using real Babylon.js with NullEngine
import {
  NullEngine,
  Scene,
  Vector3,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
} from "@babylonjs/core";
import { Entity, World, Component, System } from "~/lib/ECS";

// Test engine and scene creation
export const createTestEngine = (): NullEngine => {
  return new NullEngine({
    renderWidth: 800,
    renderHeight: 600,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 1,
  });
};

export const createTestScene = (engine?: NullEngine): Scene => {
  const testEngine = engine || createTestEngine();
  return new Scene(testEngine);
};

// Real Babylon.js object creators for testing
export const createTestVector3 = (x = 0, y = 0, z = 0): Vector3 => {
  return new Vector3(x, y, z);
};

export const createTestCamera = (
  name: string,
  position: Vector3,
  scene: Scene,
): UniversalCamera => {
  return new UniversalCamera(name, position, scene);
};

export const createTestHemisphericLight = (
  name: string,
  direction: Vector3,
  scene: Scene,
): HemisphericLight => {
  return new HemisphericLight(name, direction, scene);
};

export const createTestDirectionalLight = (
  name: string,
  direction: Vector3,
  scene: Scene,
): DirectionalLight => {
  return new DirectionalLight(name, direction, scene);
};

// ECS test helpers
export const createTestWorld = (canvasId = "testCanvas"): World => {
  // Create a mock world-like object instead of using real World constructor
  // to avoid Engine initialization issues in tests
  const mockWorld = {
    canvas: {
      width: 800,
      height: 600,
      getContext: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      }),
    },
    entities: new Map(),
    engine: createTestEngine(),
    currentScene: null as any,
    originalSceneData: null,
    sceneCode: null,
    isPaused: false,
    worldEntity: undefined,
    worldName: "World",
    componentCache: new Map(),

    // Methods
    createEntity: function (name: string) {
      const entity = new Entity(name);
      this.entities.set(name, entity);
      return entity;
    },
    removeEntity: function (entity: Entity) {
      this.entities.delete(entity.name);
    },
    search: function (name: string | string[]) {
      if (Array.isArray(name)) {
        return name.map((n) => this.entities.get(n)).filter((e) => !!e);
      }
      return this.entities.get(name);
    },
    entitiesWith: function (componentClasses: any) {
      const entities = Array.from(this.entities.values());
      return entities.filter((entity: Entity) =>
        Array.isArray(componentClasses)
          ? componentClasses.every((comp: any) => entity.hasComponent(comp))
          : entity.hasComponent(componentClasses),
      );
    },

    // Additional World methods for testing
    loadSceneData: async function (sceneName: string, gameName: string) {
      const scenePath = `/GameData/${gameName}/scenes/${sceneName}.json`;
      document.title = `${gameName} - ${sceneName}`;
      const response = await fetch(scenePath, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const sceneData = await response.json();
      if (!sceneData) {
        throw "Data is not in JSON Format";
      }
      if (!sceneData.entities) {
        throw "No entities property in sceneData";
      }
      this.originalSceneData = sceneData;
      this.sceneCode = await this.loadSceneCode(sceneData);
    },

    loadSceneCode: async function (data: any) {
      // Mock implementation for testing
      return {
        entities: {},
        componentTypes: new Set(),
        systems: [],
        components: new Map(),
      };
    },

    loadSystems: async function () {
      if (!this.sceneCode) return;
      return this.sceneCode.systems.forEach((system: any) => {
        system.load && system.load();
        system.loadEntities && system.loadEntities();
      });
    },

    updateSystems: function (deltaTime: number) {
      if (!this.sceneCode || !this.currentScene.isReady()) return;
      this.sceneCode.systems.forEach((system: any) => {
        if (system.update) system.update(deltaTime);
      });
    },
  } as any;

  // Set up the scene after mock world is created
  mockWorld.currentScene = createTestScene(mockWorld.engine);

  return mockWorld;
};

export const createTestEntity = (name: string, scene?: Scene): Entity => {
  const entity = new Entity(name);
  if (scene) {
    // If scene is provided, add the entity to the scene
    entity.parent = scene.getTransformNodeByName("root") || null;
  }
  return entity;
};

// Test component class for testing
export class TestComponent extends Component {
  public testValue: string;
  public testNumber: number;

  constructor(
    data: { testValue?: string; testNumber?: number; enabled?: boolean } = {},
  ) {
    super(data);
    this.testValue = data.testValue || "default";
    this.testNumber = data.testNumber || 0;
  }
}

// Test system class for testing
export class TestSystem extends System {
  public loadCalled = false;
  public loadEntityCalled = false;
  public processEntityCalled = false;

  load(): void {
    this.loadCalled = true;
  }

  loadEntity(entity: Entity): void {
    this.loadEntityCalled = true;
    const component = entity.getComponent(TestComponent);
    component.loaded = true;
  }

  processEntity(entity: Entity, deltaTime: number): void {
    this.processEntityCalled = true;
    const component = entity.getComponent(TestComponent);
    component.testNumber += deltaTime;
  }
}

// Utility functions for testing
export const expectVector3ToEqual = (
  actual: Vector3,
  expected: { x: number; y: number; z: number },
  tolerance = 0.001,
) => {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(tolerance);
};

export const createTestComponentWithData = <T extends Component>(
  ComponentClass: new (data: any) => T,
  data: any = {},
): T => {
  return new ComponentClass(data);
};

export const createTestSystemWithWorld = <T extends System>(
  SystemClass: new (world: World, componentClasses: any[]) => T,
  world?: World,
  componentClasses: any[] = [],
): T => {
  const testWorld = world || createTestWorld();
  return new SystemClass(testWorld, componentClasses);
};

// Cleanup helpers
export const cleanupBabylonObjects = (
  ...objects: (Scene | NullEngine | any)[]
) => {
  objects.forEach((obj) => {
    if (obj && typeof obj.dispose === "function") {
      obj.dispose();
    }
  });
};

// Test data factories
export const createCameraComponentData = (
  type: "Free" | "Static" | "Follow" = "Free",
  offset: [number, number, number] = [0, 0, 0],
) => ({
  type,
  offset,
  target: "World",
});

export const createLightingComponentData = (
  types: ("ambient" | "directional")[] = ["ambient"],
  shadows = false,
  offset: [number, number, number] = [0, 5, 0],
) => ({
  types,
  shadows,
  offset,
});

// Scene setup helpers for integration tests
export const setupTestSceneWithEntities = (
  entityNames: string[],
  scene: Scene,
): Entity[] => {
  return entityNames.map((name) => {
    const entity = createTestEntity(name, scene);
    return entity;
  });
};

export const addComponentToEntity = <T extends Component>(
  entity: Entity,
  ComponentClass: new (data: any) => T,
  data: any = {},
): T => {
  const component = new ComponentClass(data);
  entity.addComponent(component);
  return component;
};

// Mock fetch for World tests that need to load scene data
export const mockFetchForSceneData = (sceneData: any) => {
  global.fetch = vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue(sceneData),
  } as any);
};

// Restore fetch after tests
export const restoreFetch = () => {
  if ("fetch" in global) {
    delete (global as any).fetch;
  }
};
