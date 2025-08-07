import { Mesh } from "@babylonjs/core";
import { Component } from "./Component.js";

// Entity.ts
export class Entity extends Mesh {
  public name: string;
  private _components: Map<string, Component>;
  public meshLoaded = false;

  constructor(name: string) {
    super(name);
    this._components = new Map();
    this.name = name;
  }

  getAllComponents() {
    return this._components;
  }

  // Add a component to this entity
  addComponent(component: Component): Entity {
    component.entity = this;
    this._components.set(component.constructor.name, component);
    return this;
  }

  // Remove a component from this entity by its class
  removeComponent(componentClass: Component): Entity {
    this._components.delete(componentClass.constructor.name);
    return this;
  }

  // Get a component by its class
  getComponent<T extends Component>(
    componentClass: new (...args: any[]) => T,
  ): T {
    try {
      const t = this._components.get(componentClass.name) as T;
      if (!t) throw `${componentClass.name} Not Found for ${this.name}`;
      return t;
    } catch (e) {
      throw e;
    }
  }

  // Check if the entity has a specific component
  hasComponent(componentClass: new (...args: any[]) => Component): boolean {
    return this._components.has(componentClass.name);
  }

  toJSON(): string {
    const components: any = {};
    this._components.forEach((component, key) => {
      // Avoid circular references by not including the entity reference
      const componentData = { ...component } as any;
      delete componentData.entity;
      components[key] = componentData;
    });

    const entity = {
      name: this.name,
      components: components,
    };
    return JSON.stringify(entity);
  }
}
