import { Entity } from "./Entity";

export abstract class Component {
  loading: boolean = false;
  loaded: boolean = false;
  enabled: boolean = true;
  entity: Entity | null = null;

  constructor(data: any = {}) {
    this.enabled = typeof data.enabled == "undefined" ? true : data.enabled;
  }

  toJSON(): string {
    const output = Object.keys(this).reduce((acc, key) => {
      acc[key] = this[key as keyof this];
      return acc;
    }, {} as any);
    const component = {
      [this.constructor.name]: {
        ...output,
      },
    };
    return JSON.stringify(component);
  }
}
