import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { System } from "./System";
import { World } from "./World";
import { Component } from "./Component";
import { Entity } from "./Entity";
import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { createTestEngine, createTestScene, createTestWorld, cleanupBabylonObjects } from "../../test/helpers";

// Test component implementations for testing System
class TestComponent extends Component {
  public testValue: string;
  public processCount: number = 0;

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

// Test system implementation for testing the abstract base class
class TestSystem extends System {
  public loadCalled = false;
  public loadEntityCalled = false;
  public processEntityCallCount = 0;
  public lastDeltaTime = 0;
  public lastProcessedEntity: Entity | null = null;

  load(): void {
    this.loadCalled = true;
  }

  loadEntity(entity: Entity): void {
    this.loadEntityCalled = true;
    const component = entity.getComponent(TestComponent);
    component.loaded = true;
  }

  processEntity(entity: Entity, deltaTime: number): void {
    this.processEntityCallCount++;
    this.lastDeltaTime = deltaTime;
    this.lastProcessedEntity = entity;

    const component = entity.getComponent(TestComponent);
    (component as TestComponent).processCount++;
  }
}

// System that works with multiple component types
class MultiComponentSystem extends System {
  public processEntityCallCount = 0;

  load(): void {}

  loadEntity(entity: Entity): void {
    const testComp = entity.getComponent(TestComponent);
    const anotherComp = entity.getComponent(AnotherTestComponent);
    testComp.loaded = true;
    anotherComp.loaded = true;
  }

  processEntity(entity: Entity, deltaTime: number): void {
    this.processEntityCallCount++;
  }
}

// Pauseable system for testing pause functionality
class PauseableTestSystem extends TestSystem {
  constructor(world: World, componentClasses: Component[]) {
    super(world, componentClasses);
    this.isPauseable = true;
  }
}

describe("System", () => {
  let engine: NullEngine;
  let scene: Scene;
  let world: World;
  let system: TestSystem;

  beforeEach(() => {
    engine = createTestEngine();
    scene = createTestScene(engine);
    world = createTestWorld();
    world.currentScene = scene;
    system = new TestSystem(world, [TestComponent]);
  });

  afterEach(() => {
    cleanupBabylonObjects(scene, engine);
  });

  describe("Constructor and initialization", () => {
    it("should create system with world and component classes", () => {
      const system = new TestSystem(world, [TestComponent]);

      expect(system.world).toBe(world);
      expect(system.scene).toBe(world.currentScene);
      expect(system.componentClasses).toEqual([TestComponent]);
    });

    it("should initialize with empty entities array", () => {
      expect(system.entities).toEqual([]);
    });

    it("should initialize as not pauseable by default", () => {
      expect(system.isPauseable).toBe(false);
    });

    it("should allow setting isPauseable", () => {
      const pauseableSystem = new PauseableTestSystem(world, [TestComponent]);
      expect(pauseableSystem.isPauseable).toBe(true);
    });

    it("should handle multiple component classes", () => {
      const multiSystem = new MultiComponentSystem(world, [TestComponent, AnotherTestComponent]);

      expect(multiSystem.componentClasses).toHaveLength(2);
      expect(multiSystem.componentClasses).toContain(TestComponent);
      expect(multiSystem.componentClasses).toContain(AnotherTestComponent);
    });
  });

  describe("Abstract method implementation", () => {
    it("should require load method implementation", () => {
      expect(typeof system.load).toBe("function");
      system.load();
      expect(system.loadCalled).toBe(true);
    });

    it("should require loadEntity method implementation", () => {
      const entity = new Entity("TestEntity");
      const component = new TestComponent();
      entity.addComponent(component);

      expect(typeof system.loadEntity).toBe("function");
      system.loadEntity(entity);
      expect(system.loadEntityCalled).toBe(true);
    });

    it("should require processEntity method implementation", () => {
      const entity = new Entity("TestEntity");
      const component = new TestComponent();
      entity.addComponent(component);

      expect(typeof system.processEntity).toBe("function");
      system.processEntity(entity, 16.67);

      expect(system.processEntityCallCount).toBe(1);
      expect(system.lastDeltaTime).toBe(16.67);
      expect(system.lastProcessedEntity).toBe(entity);
    });
  });

  describe("Entity processing", () => {
    let entity: Entity;
    let component: TestComponent;

    beforeEach(() => {
      entity = new Entity("TestEntity");
      component = new TestComponent({ testValue: "test" });
      entity.addComponent(component);
      world.entities.set(entity.name, entity);
    });

    it("should update entities with required components", () => {
      // Mock world.entitiesWith to return our test entity
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      system.update(16.67);

      expect(world.entitiesWith).toHaveBeenCalledWith([TestComponent]);
      expect(system.processEntityCallCount).toBe(1);
      expect(system.lastProcessedEntity).toBe(entity);
      expect(system.lastDeltaTime).toBe(16.67);
    });

    it("should process multiple entities", () => {
      const entity2 = new Entity("TestEntity2");
      const component2 = new TestComponent({ testValue: "test2" });
      entity2.addComponent(component2);
      world.entities.set(entity2.name, entity2);

      // Mock world.entitiesWith to return both entities
      world.entitiesWith = vi.fn().mockReturnValue([entity, entity2]);

      system.update(16.67);

      expect(system.processEntityCallCount).toBe(2);
    });

    it("should not process entities when paused if system is pauseable", () => {
      const pauseableSystem = new PauseableTestSystem(world, [TestComponent]);
      world.isPaused = true;
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      pauseableSystem.update(16.67);

      expect(pauseableSystem.processEntityCallCount).toBe(0);
    });

    it("should process entities when not paused even if system is pauseable", () => {
      const pauseableSystem = new PauseableTestSystem(world, [TestComponent]);
      world.isPaused = false;
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      pauseableSystem.update(16.67);

      expect(pauseableSystem.processEntityCallCount).toBe(1);
    });

    it("should process entities when paused if system is not pauseable", () => {
      world.isPaused = true;
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      system.update(16.67);

      expect(system.processEntityCallCount).toBe(1);
    });

    it("should handle empty entity list", () => {
      world.entitiesWith = vi.fn().mockReturnValue([]);

      expect(() => {
        system.update(16.67);
      }).not.toThrow();

      expect(system.processEntityCallCount).toBe(0);
    });
  });

  describe("Entity loading", () => {
    let entity: Entity;
    let component: TestComponent;

    beforeEach(() => {
      entity = new Entity("TestEntity");
      component = new TestComponent({ testValue: "test" });
      entity.addComponent(component);
      world.entities.set(entity.name, entity);
    });

    it("should load entities with required components", () => {
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      system.loadEntities();

      expect(world.entitiesWith).toHaveBeenCalledWith([TestComponent]);
      expect(system.loadEntityCalled).toBe(true);
      expect(component.loaded).toBe(true);
    });

    it("should load multiple entities", () => {
      const entity2 = new Entity("TestEntity2");
      const component2 = new TestComponent({ testValue: "test2" });
      entity2.addComponent(component2);
      world.entities.set(entity2.name, entity2);

      world.entitiesWith = vi.fn().mockReturnValue([entity, entity2]);

      system.loadEntities();

      expect(component.loaded).toBe(true);
      expect(component2.loaded).toBe(true);
    });

    it("should handle systems without loadEntity method", () => {
      // Create a system that doesn't implement loadEntity
      class NoLoadEntitySystem extends System {
        load(): void {}
        loadEntity(entity: Entity): void {}
        processEntity(entity: Entity, deltaTime: number): void {}
      }

      const noLoadSystem = new NoLoadEntitySystem(world, [TestComponent]);
      // Remove the loadEntity method to simulate a system that doesn't implement it
      delete (noLoadSystem as any).loadEntity;

      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      expect(() => {
        noLoadSystem.loadEntities();
      }).not.toThrow();
    });
  });

  describe("Multi-component systems", () => {
    let entity: Entity;
    let testComponent: TestComponent;
    let anotherComponent: AnotherTestComponent;

    beforeEach(() => {
      entity = new Entity("MultiTestEntity");
      testComponent = new TestComponent({ testValue: "test" });
      anotherComponent = new AnotherTestComponent({ name: "another" });
      entity.addComponent(testComponent);
      entity.addComponent(anotherComponent);
      world.entities.set(entity.name, entity);
    });

    it("should work with multiple component types", () => {
      const multiSystem = new MultiComponentSystem(world, [TestComponent, AnotherTestComponent]);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      multiSystem.update(16.67);

      expect(world.entitiesWith).toHaveBeenCalledWith([TestComponent, AnotherTestComponent]);
      expect(multiSystem.processEntityCallCount).toBe(1);
    });

    it("should load entities with multiple component types", () => {
      const multiSystem = new MultiComponentSystem(world, [TestComponent, AnotherTestComponent]);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      multiSystem.loadEntities();

      expect(testComponent.loaded).toBe(true);
      expect(anotherComponent.loaded).toBe(true);
    });

    it("should not process entities missing required components", () => {
      // Entity with only one of the required components
      const incompleteEntity = new Entity("IncompleteEntity");
      incompleteEntity.addComponent(new TestComponent());
      // Missing AnotherTestComponent

      const multiSystem = new MultiComponentSystem(world, [TestComponent, AnotherTestComponent]);
      world.entitiesWith = vi.fn().mockReturnValue([]); // No entities have both components

      multiSystem.update(16.67);

      expect(multiSystem.processEntityCallCount).toBe(0);
    });
  });

  describe("Scene integration", () => {
    it("should have access to Babylon.js scene", () => {
      expect(system.scene).toBe(world.currentScene);
      expect(system.scene).toBeInstanceOf(Scene);
    });

    it("should have access to scene engine", () => {
      expect(system.scene.getEngine()).toBeInstanceOf(NullEngine);
    });

    it("should update scene reference if world scene changes", () => {
      const newEngine = createTestEngine();
      const newScene = createTestScene(newEngine);

      world.currentScene = newScene;
      const newSystem = new TestSystem(world, [TestComponent]);

      expect(newSystem.scene).toBe(newScene);

      cleanupBabylonObjects(newScene, newEngine);
    });
  });

  describe("Performance and edge cases", () => {
    it("should handle rapid updates", () => {
      const entity = new Entity("RapidEntity");
      entity.addComponent(new TestComponent());
      world.entities.set(entity.name, entity);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        system.update(16.67);
      }

      expect(system.processEntityCallCount).toBe(100);
    });

    it("should handle zero delta time", () => {
      const entity = new Entity("ZeroEntity");
      entity.addComponent(new TestComponent());
      world.entities.set(entity.name, entity);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      expect(() => {
        system.update(0);
      }).not.toThrow();

      expect(system.lastDeltaTime).toBe(0);
    });

    it("should handle negative delta time", () => {
      const entity = new Entity("NegativeEntity");
      entity.addComponent(new TestComponent());
      world.entities.set(entity.name, entity);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      expect(() => {
        system.update(-16.67);
      }).not.toThrow();

      expect(system.lastDeltaTime).toBe(-16.67);
    });

    it("should handle entity with disabled components", () => {
      const entity = new Entity("DisabledEntity");
      const component = new TestComponent();
      component.enabled = false;
      entity.addComponent(component);
      world.entities.set(entity.name, entity);
      world.entitiesWith = vi.fn().mockReturnValue([entity]);

      system.update(16.67);

      // System should still process the entity (component filtering is typically done by World)
      expect(system.processEntityCallCount).toBe(1);
    });
  });

  describe("System state management", () => {
    it("should maintain component class references", () => {
      expect(system.componentClasses).toEqual([TestComponent]);
    });

    it("should maintain world reference", () => {
      expect(system.world).toBe(world);
    });

    it("should allow accessing protected properties in subclass", () => {
      // Test that protected properties are accessible in subclass
      class AccessTestSystem extends TestSystem {
        getProtectedEntities() {
          return this.entities;
        }

        getProtectedComponentClasses() {
          return this.componentClasses;
        }

        getProtectedScene() {
          return this.scene;
        }
      }

      const accessSystem = new AccessTestSystem(world, [TestComponent]);

      expect(accessSystem.getProtectedEntities()).toEqual([]);
      expect(accessSystem.getProtectedComponentClasses()).toEqual([TestComponent]);
      expect(accessSystem.getProtectedScene()).toBe(scene);
    });
  });
});
