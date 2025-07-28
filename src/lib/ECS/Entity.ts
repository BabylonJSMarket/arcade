import { Mesh, TransformNode } from "@babylonjs/core";
import { Component } from "./Component";

export class Entity extends Mesh {
  public name: string;
  private _components: Map<Component, any>;
  public meshLoaded = false;

  constructor(name: string) {
    super(name);
    this._components = new Map();
    this.name = name;
  }

  getAllComponents() {
    return this._components;
  }

  isReady() {
    const c = this.getAllComponents();
    for (let i in c) {
      if (!c[i].ready()) {
        return false;
      }
    }
    return true;
  }

  peep(label, obj) {
    window.gui[this.name].addLabel(label, obj);
  }

  // Add a component to this entity
  addComponent(component: any): Entity {
    component.entity = this;
    this._components.set(component.constructor.name, component);
    return this;
  }

  // Remove a component from this entity by its class
  removeComponent(componentClass: any): Entity {
    this._components.delete(componentClass.name);
    return this;
  }

  // Get a component by its class
  getComponent<T>(componentClass: new (...args: any[]) => T): T {
    try {
      const t = this._components.get(componentClass.name) as T;
      if (!t) throw `${componentClass.name} Not Found for ${this.name}`;
      return t;
    } catch (e) {
      throw e;
    }
  }

  // Check if the entity has a specific component
  hasComponent(componentClass: any): boolean {
    return this._components.has(componentClass.name);
  }

  getComponentByName(name: string) {
    return this._components.get(name + "Component");
  }

  getComponentTypes(): string[] {
    return Array.from(this._components.keys());
  }

  isPrimitive(value: any) {
    return (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    );
  }

  serialize(): any {
    const data = {
      id: this.id,
      name: this.name,
      components: new Map(),
    };

    for (const [key, value] of this._components) {
      if (this.isPrimitive(value)) data.components.set(key, value);
    }
    return data;
  }
}
