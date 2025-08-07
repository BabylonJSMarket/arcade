import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { World } from "./World";
import { Entity } from "./Entity";
import { Component } from "./Component";
import { System } from "./System";
import { NullEngine, Scene, Engine } from "@babylonjs/core";
import {
  createTestEngine,
  createTestScene,
  createTestWorld,
  cleanupBabylonObjects,
  mockFetchForSceneData,
  restoreFetch,
} from "../../test/helpers";

// Test component implementations for testing World
class TestComponent extends Component {
  public testValue: string;

  constructor(data: { testValue?: string; enabled?: boolean } = {}) {
    super(data);
    this.testValue = data.testValue || "default";
  }
}

class AnotherTestComponent extends Component {
  public name: string;

  constructor(data: { name?: string; enabled?: boolean } = {}) {
    super(data);
    this.name = data.name || "test";
  }
}

// Test system implementations
class TestSystem extends System {
  public loadCalled = false;
  public loadEntitiesCalled = false;
  public updateCalled = false;
  public lastDeltaTime = 0;

  load(): void {
    this.loadCalled = true;
  }

  loadEntity(entity: Entity): void {
    const component = entity.getComponent(TestComponent);
    component.loaded = true;
  }

  processEntity(entity: Entity, deltaTime: number): void {
    this.lastDeltaTime = deltaTime;
  }

  loadEntities(): void {
    this.loadEntitiesCalled = true;
    super.loadEntities();
  }

  update(deltaTime: number): void {
    this.updateCalled = true;
    this.lastDeltaTime = deltaTime;
    super.update(deltaTime);
  }
}

describe("World", () => {
  let world: any; // Use mock world to avoid Engine creation issues
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // Use the mock world from test helpers to avoid Engine initialization
    world = createTestWorld("testCanvas");

    mockCanvas = {
      width: 800,
      height: 600,
      getContext: vi.fn(() => ({})),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      })),
    } as any;
  });

  afterEach(() => {
    if (world?.engine) {
      cleanupBabylonObjects(world.currentScene, world.engine);
    }
    restoreFetch();
  });

  describe("Constructor and initialization", () => {
    it("should create world with canvas", () => {
      expect(world).toBeDefined();
      expect(world.canvas).toBeDefined();
    });

    it("should initialize with test engine", () => {
      expect(world.engine).toBeInstanceOf(NullEngine);
    });

    it("should initialize with empty entities map", () => {
      expect(world.entities).toBeInstanceOf(Map);
      expect(world.entities.size).toBe(0);
    });

    it("should initialize with test scene", () => {
      expect(world.currentScene).toBeInstanceOf(Scene);
      expect(world.currentScene.getEngine()).toBe(world.engine);
    });

    it("should initialize as not paused", () => {
      expect(world.isPaused).toBe(false);
    });

    it("should initialize with default world name", () => {
      expect(world.worldName).toBe("World");
    });

    it("should initialize without world entity", () => {
      expect(world.worldEntity).toBeUndefined();
    });

    it("should initialize with empty component cache", () => {
      expect(world.componentCache).toBeDefined();
    });
  });

  describe("Entity management", () => {
    it("should create entity with given name", () => {
      const entity = world.createEntity("TestEntity");

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.name).toBe("TestEntity");
      expect(world.entities.has("TestEntity")).toBe(true);
      expect(world.entities.get("TestEntity")).toBe(entity);
    });

    it("should create multiple entities with different names", () => {
      const entity1 = world.createEntity("Entity1");
      const entity2 = world.createEntity("Entity2");

      expect(world.entities.size).toBe(2);
      expect(world.entities.get("Entity1")).toBe(entity1);
      expect(world.entities.get("Entity2")).toBe(entity2);
    });

    it("should remove entity from world", () => {
      const entity = world.createEntity("RemoveMe");
      expect(world.entities.has("RemoveMe")).toBe(true);

      world.removeEntity(entity);

      expect(world.entities.has("RemoveMe")).toBe(false);
      expect(world.entities.size).toBe(0);
    });

    it("should handle removing non-existent entity", () => {
      const entity = new Entity("NotInWorld");

      expect(() => {
        world.removeEntity(entity);
      }).not.toThrow();

      expect(world.entities.size).toBe(0);
    });
  });

  describe("Entity searching", () => {
    beforeEach(() => {
      world.createEntity("Entity1");
      world.createEntity("Entity2");
      world.createEntity("Entity3");
    });

    it("should find single entity by name", () => {
      const entity = world.search("Entity1");

      expect(entity).toBeInstanceOf(Entity);
      expect((entity as Entity).name).toBe("Entity1");
    });

    it("should return undefined for non-existent entity", () => {
      const entity = world.search("NonExistent");

      expect(entity).toBeUndefined();
    });

    it("should find multiple entities by array of names", () => {
      const entities = world.search(["Entity1", "Entity3"]) as Entity[];

      expect(Array.isArray(entities)).toBe(true);
      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe("Entity1");
      expect(entities[1].name).toBe("Entity3");
    });

    it("should filter out non-existent entities from array search", () => {
      const entities = world.search([
        "Entity1",
        "NonExistent",
        "Entity2",
      ]) as Entity[];

      expect(Array.isArray(entities)).toBe(true);
      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe("Entity1");
      expect(entities[1].name).toBe("Entity2");
    });

    it("should return empty array when no entities found in array search", () => {
      const entities = world.search([
        "NonExistent1",
        "NonExistent2",
      ]) as Entity[];

      expect(Array.isArray(entities)).toBe(true);
      expect(entities).toHaveLength(0);
    });
  });

  describe("Component filtering", () => {
    let entity1: Entity;
    let entity2: Entity;
    let entity3: Entity;

    beforeEach(() => {
      entity1 = world.createEntity("Entity1");
      entity2 = world.createEntity("Entity2");
      entity3 = world.createEntity("Entity3");

      // Entity1: TestComponent only
      entity1.addComponent(new TestComponent({ testValue: "test1" }));

      // Entity2: AnotherTestComponent only
      entity2.addComponent(new AnotherTestComponent({ name: "test2" }));

      // Entity3: Both components
      entity3.addComponent(new TestComponent({ testValue: "test3" }));
      entity3.addComponent(new AnotherTestComponent({ name: "test3" }));
    });

    it("should find entities with single component type", () => {
      const entities = world.entitiesWith(TestComponent);

      expect(entities).toHaveLength(2);
      expect(entities.map((e) => e.name)).toContain("Entity1");
      expect(entities.map((e) => e.name)).toContain("Entity3");
      expect(entities.map((e) => e.name)).not.toContain("Entity2");
    });

    it("should find entities with multiple component types", () => {
      const entities = world.entitiesWith([
        TestComponent,
        AnotherTestComponent,
      ]);

      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe("Entity3");
    });

    it("should return empty array when no entities match component requirements", () => {
      // Remove all components to test empty result
      entity1.removeComponent(entity1.getComponent(TestComponent));
      entity2.removeComponent(entity2.getComponent(AnotherTestComponent));
      entity3.removeComponent(entity3.getComponent(TestComponent));
      entity3.removeComponent(entity3.getComponent(AnotherTestComponent));

      const entities = world.entitiesWith(TestComponent);

      expect(entities).toHaveLength(0);
    });

    it("should handle empty world", () => {
      // Create new empty world using mock
      const emptyWorld = createTestWorld("emptyCanvas");

      const entities = emptyWorld.entitiesWith(TestComponent);

      expect(entities).toHaveLength(0);

      cleanupBabylonObjects(emptyWorld.currentScene, emptyWorld.engine);
    });
  });

  describe("Scene data loading", () => {
    const mockSceneData = {
      entities: {
        Player: {
          components: {
            TestComponent: {
              testValue: "player-test",
              enabled: true,
            },
          },
        },
        Enemy: {
          components: {
            AnotherTestComponent: {
              name: "enemy-test",
              enabled: true,
            },
          },
        },
      },
      worldEntity: "Player",
    };

    beforeEach(() => {
      mockFetchForSceneData(mockSceneData);
    });

    it("should load scene data from JSON file", async () => {
      await world.loadSceneData("TestScene", "TestGame");

      expect(world.originalSceneData).toEqual(mockSceneData);
      expect(document.title).toBe("TestGame - TestScene");
    });

    it("should handle fetch failure gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(
        world.loadSceneData("TestScene", "TestGame"),
      ).rejects.toThrow();
    });

    it("should handle invalid JSON data", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(null),
      } as any);

      await expect(
        world.loadSceneData("TestScene", "TestGame"),
      ).rejects.toEqual("Data is not in JSON Format");
    });

    it("should handle missing entities property", async () => {
      const invalidData = { someOtherProperty: "value" };
      mockFetchForSceneData(invalidData);

      await expect(
        world.loadSceneData("TestScene", "TestGame"),
      ).rejects.toEqual("No entities property in sceneData");
    });
  });

  describe("System management", () => {
    let mockSceneCode: any;

    beforeEach(() => {
      const testSystem = new TestSystem(world, [TestComponent]);
      mockSceneCode = {
        systems: [testSystem],
        entities: {},
        componentTypes: new Set(),
        components: new Map(),
      };
      world.sceneCode = mockSceneCode;
    });

    it("should load systems", async () => {
      await world.loadSystems();

      expect(mockSceneCode.systems[0].loadCalled).toBe(true);
      expect(mockSceneCode.systems[0].loadEntitiesCalled).toBe(true);
    });

    it("should update systems with delta time", () => {
      const deltaTime = 16.67;

      world.updateSystems(deltaTime);

      expect(mockSceneCode.systems[0].updateCalled).toBe(true);
      expect(mockSceneCode.systems[0].lastDeltaTime).toBe(deltaTime);
    });

    it("should not update systems when scene not ready", () => {
      world.currentScene.isReady = vi.fn(() => false);

      world.updateSystems(16.67);

      expect(mockSceneCode.systems[0].updateCalled).toBe(false);
    });

    it("should not update systems when sceneCode not loaded", () => {
      world.sceneCode = null;

      world.updateSystems(16.67);
      // Should not throw error
    });
  });

  describe("Pause functionality", () => {
    it("should allow pausing and unpausing", () => {
      expect(world.isPaused).toBe(false);

      world.isPaused = true;
      expect(world.isPaused).toBe(true);

      world.isPaused = false;
      expect(world.isPaused).toBe(false);
    });
  });

  describe("Component caching", () => {
    it("should initialize with empty component cache", () => {
      expect(world.componentCache).toBeInstanceOf(Map);
      expect(world.componentCache.size).toBe(0);
    });

    it("should allow accessing component cache", () => {
      // This tests the private componentCache is accessible through the public interface
      // In real usage, this would be managed internally
      const cache = world.componentCache;
      expect(cache).toBeDefined();
    });
  });

  describe("World entity management", () => {
    it("should allow setting world entity", () => {
      const worldEntity = world.createEntity("WorldEntity");
      world.worldEntity = worldEntity;

      expect(world.worldEntity).toBe(worldEntity);
    });

    it("should handle undefined world entity", () => {
      expect(world.worldEntity).toBeUndefined();
    });
  });

  describe("Engine integration", () => {
    it("should have proper engine-scene relationship", () => {
      expect(world.currentScene.getEngine()).toBe(world.engine);
    });

    it("should handle engine disposal", () => {
      const engine = world.engine;
      const scene = world.currentScene;

      expect(typeof engine.dispose).toBe("function");
      expect(typeof scene.dispose).toBe("function");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle creating entities with same name", () => {
      const entity1 = world.createEntity("SameName");
      const entity2 = world.createEntity("SameName");

      // Second entity should replace the first
      expect(world.entities.size).toBe(1);
      expect(world.entities.get("SameName")).toBe(entity2);
    });

    it("should handle empty entity names", () => {
      const entity = world.createEntity("");

      expect(entity.name).toBe("");
      expect(world.entities.has("")).toBe(true);
    });

    it("should handle special characters in entity names", () => {
      const specialName = "Entity-123_$@!";
      const entity = world.createEntity(specialName);

      expect(entity.name).toBe(specialName);
      expect(world.entities.has(specialName)).toBe(true);
    });

    it("should handle rapid entity creation and removal", () => {
      // Create many entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push(world.createEntity(`Entity${i}`));
      }

      expect(world.entities.size).toBe(100);

      // Remove half of them
      for (let i = 0; i < 50; i++) {
        world.removeEntity(entities[i]);
      }

      expect(world.entities.size).toBe(50);
    });
  });

  describe("Canvas integration", () => {
    it("should store canvas reference", () => {
      expect(world.canvas).toBeDefined();
      expect(world.canvas.width).toBe(800);
      expect(world.canvas.height).toBe(600);
    });

    it("should handle canvas properties", () => {
      expect(world.canvas.width).toBe(800);
      expect(world.canvas.height).toBe(600);
    });
  });

  describe("Scene management", () => {
    it("should allow scene replacement", () => {
      const newEngine = createTestEngine();
      const newScene = createTestScene(newEngine);

      world.currentScene = newScene;

      expect(world.currentScene).toBe(newScene);

      cleanupBabylonObjects(newScene, newEngine);
    });

    it("should maintain scene state", () => {
      expect(world.currentScene.isReady()).toBe(true);
    });
  });
});
