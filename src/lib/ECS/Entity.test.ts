import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Entity } from "./Entity";
import { Component } from "./Component";
import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { createTestEngine, createTestScene, cleanupBabylonObjects } from "../../test/helpers";

// Test component implementations for testing Entity
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

class ThirdTestComponent extends Component {
  public value: number;

  constructor(data: { value?: number; enabled?: boolean } = {}) {
    super(data);
    this.value = data.value || 0;
  }
}

describe("Entity", () => {
  let engine: NullEngine;
  let scene: Scene;
  let entity: Entity;

  beforeEach(() => {
    engine = createTestEngine();
    scene = createTestScene(engine);
    entity = new Entity("TestEntity");
    // Add entity to scene so it has proper Babylon.js context
    entity.parent = null;
    entity.position = new Vector3(0, 0, 0);
  });

  afterEach(() => {
    cleanupBabylonObjects(scene, engine);
  });

  describe("Constructor and basic properties", () => {
    it("should create entity with correct name", () => {
      const entity = new Entity("MyEntity");

      expect(entity.name).toBe("MyEntity");
      expect(entity).toBeInstanceOf(Entity);
    });

    it("should initialize with empty components map", () => {
      const entity = new Entity("TestEntity");

      expect(entity.getAllComponents()).toBeInstanceOf(Map);
      expect(entity.getAllComponents().size).toBe(0);
    });

    it("should initialize meshLoaded as false", () => {
      const entity = new Entity("TestEntity");

      expect(entity.meshLoaded).toBe(false);
    });

    it("should inherit from Babylon.js Mesh", () => {
      const entity = new Entity("TestEntity");

      // Check that it has Mesh properties
      expect(entity.position).toBeDefined();
      expect(entity.rotation).toBeDefined();
      expect(entity.scaling).toBeDefined();
    });
  });

  describe("Component management", () => {
    it("should add component successfully", () => {
      const component = new TestComponent({ testValue: "test" });

      const result = entity.addComponent(component);

      expect(result).toBe(entity); // Should return entity for chaining
      expect(component.entity).toBe(entity);
      expect(entity.getAllComponents().size).toBe(1);
      expect(entity.getAllComponents().has("TestComponent")).toBe(true);
    });

    it("should add multiple different components", () => {
      const component1 = new TestComponent({ testValue: "test1" });
      const component2 = new AnotherTestComponent({ name: "test2" });

      entity.addComponent(component1);
      entity.addComponent(component2);

      expect(entity.getAllComponents().size).toBe(2);
      expect(entity.getAllComponents().has("TestComponent")).toBe(true);
      expect(entity.getAllComponents().has("AnotherTestComponent")).toBe(true);
    });

    it("should replace component if same type is added twice", () => {
      const component1 = new TestComponent({ testValue: "first" });
      const component2 = new TestComponent({ testValue: "second" });

      entity.addComponent(component1);
      entity.addComponent(component2);

      expect(entity.getAllComponents().size).toBe(1);
      expect(component2.entity).toBe(entity);
      expect(entity.getComponent(TestComponent).testValue).toBe("second");
    });

    it("should set component entity reference when adding", () => {
      const component = new TestComponent();

      expect(component.entity).toBe(null);

      entity.addComponent(component);

      expect(component.entity).toBe(entity);
    });
  });

  describe("Component retrieval", () => {
    beforeEach(() => {
      const component1 = new TestComponent({ testValue: "test1" });
      const component2 = new AnotherTestComponent({ name: "test2" });
      entity.addComponent(component1);
      entity.addComponent(component2);
    });

    it("should get component by class", () => {
      const component = entity.getComponent(TestComponent);

      expect(component).toBeInstanceOf(TestComponent);
      expect((component as TestComponent).testValue).toBe("test1");
    });

    it("should get different component types correctly", () => {
      const testComponent = entity.getComponent(TestComponent);
      const anotherComponent = entity.getComponent(AnotherTestComponent);

      expect(testComponent).toBeInstanceOf(TestComponent);
      expect(anotherComponent).toBeInstanceOf(AnotherTestComponent);
      expect(testComponent).not.toBe(anotherComponent);
    });

    it("should throw error when component not found", () => {
      expect(() => {
        entity.getComponent(ThirdTestComponent);
      }).toThrow("ThirdTestComponent Not Found for TestEntity");
    });

    it("should handle component class name correctly", () => {
      // This tests the internal mechanism using component class names
      const component = entity.getComponent(TestComponent);
      expect(component).toBeDefined();
    });
  });

  describe("Component existence checking", () => {
    it("should return false for non-existent component", () => {
      expect(entity.hasComponent(TestComponent)).toBe(false);
    });

    it("should return true for existing component", () => {
      const component = new TestComponent();
      entity.addComponent(component);

      expect(entity.hasComponent(TestComponent)).toBe(true);
    });

    it("should return false after component removal", () => {
      const component = new TestComponent();
      entity.addComponent(component);
      entity.removeComponent(component);

      expect(entity.hasComponent(TestComponent)).toBe(false);
    });

    it("should handle multiple component types correctly", () => {
      const component1 = new TestComponent();
      const component2 = new AnotherTestComponent();

      entity.addComponent(component1);
      entity.addComponent(component2);

      expect(entity.hasComponent(TestComponent)).toBe(true);
      expect(entity.hasComponent(AnotherTestComponent)).toBe(true);
      expect(entity.hasComponent(ThirdTestComponent)).toBe(false);
    });
  });

  describe("Component removal", () => {
    it("should remove component successfully", () => {
      const component = new TestComponent();
      entity.addComponent(component);

      expect(entity.hasComponent(TestComponent)).toBe(true);

      const result = entity.removeComponent(component);

      expect(result).toBe(entity); // Should return entity for chaining
      expect(entity.hasComponent(TestComponent)).toBe(false);
      expect(entity.getAllComponents().size).toBe(0);
    });

    it("should remove specific component type only", () => {
      const component1 = new TestComponent();
      const component2 = new AnotherTestComponent();

      entity.addComponent(component1);
      entity.addComponent(component2);

      entity.removeComponent(component1);

      expect(entity.hasComponent(TestComponent)).toBe(false);
      expect(entity.hasComponent(AnotherTestComponent)).toBe(true);
      expect(entity.getAllComponents().size).toBe(1);
    });

    it("should handle removal of non-existent component gracefully", () => {
      const component = new TestComponent();

      expect(() => {
        entity.removeComponent(component);
      }).not.toThrow();

      expect(entity.getAllComponents().size).toBe(0);
    });
  });

  describe("Method chaining", () => {
    it("should support method chaining for addComponent", () => {
      const component1 = new TestComponent({ testValue: "test1" });
      const component2 = new AnotherTestComponent({ name: "test2" });

      const result = entity
        .addComponent(component1)
        .addComponent(component2);

      expect(result).toBe(entity);
      expect(entity.hasComponent(TestComponent)).toBe(true);
      expect(entity.hasComponent(AnotherTestComponent)).toBe(true);
    });

    it("should support method chaining for removeComponent", () => {
      const component1 = new TestComponent();
      const component2 = new AnotherTestComponent();

      entity.addComponent(component1).addComponent(component2);

      const result = entity
        .removeComponent(component1)
        .removeComponent(component2);

      expect(result).toBe(entity);
      expect(entity.getAllComponents().size).toBe(0);
    });

    it("should support mixed chaining operations", () => {
      const component1 = new TestComponent();
      const component2 = new AnotherTestComponent();
      const component3 = new ThirdTestComponent();

      entity
        .addComponent(component1)
        .addComponent(component2)
        .removeComponent(component1)
        .addComponent(component3);

      expect(entity.hasComponent(TestComponent)).toBe(false);
      expect(entity.hasComponent(AnotherTestComponent)).toBe(true);
      expect(entity.hasComponent(ThirdTestComponent)).toBe(true);
      expect(entity.getAllComponents().size).toBe(2);
    });
  });

  describe("Babylon.js integration", () => {
    it("should have Babylon.js Mesh properties", () => {
      expect(entity.position).toBeInstanceOf(Vector3);
      expect(entity.rotation).toBeInstanceOf(Vector3);
      expect(entity.scaling).toBeInstanceOf(Vector3);
    });

    it("should allow setting mesh properties", () => {
      entity.position.x = 5;
      entity.position.y = 10;
      entity.position.z = 15;

      expect(entity.position.x).toBe(5);
      expect(entity.position.y).toBe(10);
      expect(entity.position.z).toBe(15);
    });

    it("should allow setting meshLoaded property", () => {
      expect(entity.meshLoaded).toBe(false);

      entity.meshLoaded = true;

      expect(entity.meshLoaded).toBe(true);
    });

    it("should have mesh disposal capability", () => {
      expect(typeof entity.dispose).toBe("function");
    });
  });

  describe("toJSON serialization", () => {
    it("should serialize entity to JSON", () => {
      const component1 = new TestComponent({ testValue: "serialize-test" });
      const component2 = new AnotherTestComponent({ name: "serialize-name" });

      entity.addComponent(component1);
      entity.addComponent(component2);

      const jsonString = entity.toJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe("TestEntity");
      expect(parsed.components).toBeDefined();
    });

    it("should handle entity without components", () => {
      const jsonString = entity.toJSON();

      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed.name).toBe("TestEntity");
    });

    it("should produce valid JSON string", () => {
      const component = new TestComponent({ testValue: "json-test" });
      entity.addComponent(component);

      const jsonString = entity.toJSON();

      expect(typeof jsonString).toBe("string");
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle entity with same name as existing entity", () => {
      const entity1 = new Entity("SameName");
      const entity2 = new Entity("SameName");

      expect(entity1.name).toBe("SameName");
      expect(entity2.name).toBe("SameName");
      expect(entity1).not.toBe(entity2);
    });

    it("should handle empty string name", () => {
      const entity = new Entity("");

      expect(entity.name).toBe("");
    });

    it("should handle special characters in name", () => {
      const entity = new Entity("Entity-123_$@!");

      expect(entity.name).toBe("Entity-123_$@!");
    });

    it("should handle component with null/undefined data", () => {
      const component = new TestComponent();

      expect(() => {
        entity.addComponent(component);
      }).not.toThrow();

      expect(entity.hasComponent(TestComponent)).toBe(true);
    });

    it("should maintain component state after entity operations", () => {
      const component = new TestComponent({ testValue: "persistent" });
      component.loading = true;
      component.loaded = false;

      entity.addComponent(component);

      const retrievedComponent = entity.getComponent(TestComponent);
      expect((retrievedComponent as TestComponent).testValue).toBe("persistent");
      expect(retrievedComponent.loading).toBe(true);
      expect(retrievedComponent.loaded).toBe(false);
    });
  });
});
