import { describe, it, expect } from "vitest";
import { Component } from "./Component";
import { Entity } from "./Entity";

// Test component implementation for testing the abstract base class
class TestComponent extends Component {
  public testValue: string;
  public testNumber: number;

  constructor(data: { testValue?: string; testNumber?: number; enabled?: boolean } = {}) {
    super(data);
    this.testValue = data.testValue || "default";
    this.testNumber = data.testNumber || 0;
  }
}

// Another test component for testing different scenarios
class AnotherTestComponent extends Component {
  public name: string;
  public active: boolean;

  constructor(data: { name?: string; active?: boolean; enabled?: boolean } = {}) {
    super(data);
    this.name = data.name || "test";
    this.active = data.active || false;
  }
}

describe("Component", () => {
  describe("Constructor and initialization", () => {
    it("should create component with default properties", () => {
      const component = new TestComponent();

      expect(component.loading).toBe(false);
      expect(component.loaded).toBe(false);
      expect(component.enabled).toBe(true);
      expect(component.entity).toBe(null);
    });

    it("should create component with enabled set to false when explicitly disabled", () => {
      const component = new TestComponent({ enabled: false });

      expect(component.enabled).toBe(false);
      expect(component.loading).toBe(false);
      expect(component.loaded).toBe(false);
      expect(component.entity).toBe(null);
    });

    it("should create component with enabled set to true when explicitly enabled", () => {
      const component = new TestComponent({ enabled: true });

      expect(component.enabled).toBe(true);
    });

    it("should handle undefined enabled property by defaulting to true", () => {
      const component = new TestComponent({});

      expect(component.enabled).toBe(true);
    });

    it("should pass through custom data to subclass constructor", () => {
      const component = new TestComponent({
        testValue: "custom",
        testNumber: 42,
        enabled: false
      });

      expect(component.testValue).toBe("custom");
      expect(component.testNumber).toBe(42);
      expect(component.enabled).toBe(false);
    });
  });

  describe("State management", () => {
    it("should allow setting loading state", () => {
      const component = new TestComponent();

      component.loading = true;
      expect(component.loading).toBe(true);
    });

    it("should allow setting loaded state", () => {
      const component = new TestComponent();

      component.loaded = true;
      expect(component.loaded).toBe(true);
    });

    it("should allow setting enabled state", () => {
      const component = new TestComponent();

      component.enabled = false;
      expect(component.enabled).toBe(false);
    });

    it("should allow setting entity reference", () => {
      const component = new TestComponent();
      const mockEntity = { name: "TestEntity" } as Entity;

      component.entity = mockEntity;
      expect(component.entity).toBe(mockEntity);
    });
  });

  describe("toJSON method", () => {
    it("should serialize component to JSON string", () => {
      const component = new TestComponent({
        testValue: "serialized",
        testNumber: 123,
        enabled: false
      });
      component.loading = true;
      component.loaded = false;

      const jsonString = component.toJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.TestComponent).toBeDefined();
      expect(parsed.TestComponent.testValue).toBe("serialized");
      expect(parsed.TestComponent.testNumber).toBe(123);
      expect(parsed.TestComponent.enabled).toBe(false);
      expect(parsed.TestComponent.loading).toBe(true);
      expect(parsed.TestComponent.loaded).toBe(false);
      expect(parsed.TestComponent.entity).toBe(null);
    });

    it("should include component class name as key in JSON", () => {
      const testComponent = new TestComponent();
      const anotherComponent = new AnotherTestComponent();

      const testJson = JSON.parse(testComponent.toJSON());
      const anotherJson = JSON.parse(anotherComponent.toJSON());

      expect(testJson.TestComponent).toBeDefined();
      expect(testJson.AnotherTestComponent).toBeUndefined();

      expect(anotherJson.AnotherTestComponent).toBeDefined();
      expect(anotherJson.TestComponent).toBeUndefined();
    });

    it("should serialize all enumerable properties", () => {
      const component = new AnotherTestComponent({
        name: "test-component",
        active: true,
        enabled: false
      });

      const jsonString = component.toJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.AnotherTestComponent.name).toBe("test-component");
      expect(parsed.AnotherTestComponent.active).toBe(true);
      expect(parsed.AnotherTestComponent.enabled).toBe(false);
      expect(parsed.AnotherTestComponent.loading).toBe(false);
      expect(parsed.AnotherTestComponent.loaded).toBe(false);
      expect(parsed.AnotherTestComponent.entity).toBe(null);
    });

    it("should handle component with entity reference in JSON", () => {
      const component = new TestComponent();
      const mockEntity = { name: "TestEntity", id: 123 } as any;
      component.entity = mockEntity;

      const jsonString = component.toJSON();
      const parsed = JSON.parse(jsonString);

      // The entity should be serialized as well
      expect(parsed.TestComponent.entity).toEqual(mockEntity);
    });

    it("should produce valid JSON string", () => {
      const component = new TestComponent({
        testValue: "json-test",
        testNumber: 999
      });

      const jsonString = component.toJSON();

      expect(() => JSON.parse(jsonString)).not.toThrow();
      expect(typeof jsonString).toBe("string");
    });

    it("should handle empty component data", () => {
      const component = new TestComponent();

      const jsonString = component.toJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.TestComponent).toBeDefined();
      expect(parsed.TestComponent.testValue).toBe("default");
      expect(parsed.TestComponent.testNumber).toBe(0);
      expect(parsed.TestComponent.enabled).toBe(true);
    });
  });

  describe("Component inheritance", () => {
    it("should allow multiple component types to extend base Component", () => {
      const testComponent = new TestComponent({ testValue: "test1" });
      const anotherComponent = new AnotherTestComponent({ name: "test2" });

      expect(testComponent).toBeInstanceOf(Component);
      expect(anotherComponent).toBeInstanceOf(Component);
      expect(testComponent).toBeInstanceOf(TestComponent);
      expect(anotherComponent).toBeInstanceOf(AnotherTestComponent);
    });

    it("should maintain separate properties for different component types", () => {
      const testComponent = new TestComponent({
        testValue: "specific-value",
        enabled: false
      });
      const anotherComponent = new AnotherTestComponent({
        name: "specific-name",
        enabled: true
      });

      expect(testComponent.testValue).toBe("specific-value");
      expect(testComponent.enabled).toBe(false);
      expect(anotherComponent.name).toBe("specific-name");
      expect(anotherComponent.enabled).toBe(true);

      // TestComponent doesn't have 'name' property
      expect((testComponent as any).name).toBeUndefined();
      // AnotherTestComponent doesn't have 'testValue' property
      expect((anotherComponent as any).testValue).toBeUndefined();
    });

    it("should allow component state changes independently", () => {
      const component1 = new TestComponent();
      const component2 = new TestComponent();

      component1.loading = true;
      component1.loaded = false;
      component2.loading = false;
      component2.loaded = true;

      expect(component1.loading).toBe(true);
      expect(component1.loaded).toBe(false);
      expect(component2.loading).toBe(false);
      expect(component2.loaded).toBe(true);
    });
  });
});
