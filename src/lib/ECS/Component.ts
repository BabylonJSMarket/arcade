import { Entity } from "./Entity";

// Type Definitions - can be in a separate file if desired
export interface ComponentClass<T = any> {
  new (data: any): Component;
}

export abstract class Component {
  loading: boolean = false;
  loaded: boolean = false;
  enabled: boolean = true;
  entity: Entity | null = null;

  constructor(data: any = {}) {
    Object.assign(this, data);
    this.enabled = typeof data.enabled == "undefined" ? true : data.enabled;
  }

  serialize() {
    let data = {};
    // Iterate over the component's own properties (excluding prototype properties)
    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        data[key] = this[key];
      }
    }
    return data;
  }
}
