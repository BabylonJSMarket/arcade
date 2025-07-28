import { AbstractEngine, Engine, Scene } from "@babylonjs/core";
import { System } from "./System";
import { Entity } from "./Entity";
import { Component } from "./Component";

const BASE_COMPONENT_DIR = "../../Components/";

export class World {
  canvas: HTMLCanvasElement;
  entities: Map<String, Entity>;
  engine: AbstractEngine;
  currentScene: Scene;
  originalSceneData: any;
  sceneCode: any | undefined;
  isPaused: boolean = false;
  worldEntity: Entity | undefined;
  worldName: string = "World";

  private componentCache: Map<string, { component: Component; system: any }> =
    new Map();

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.entities = new Map();
    this.currentScene = new Scene(this.engine);
  }

  async loadSystems() {
    return this.sceneCode.systems.forEach((system: System) => {
      system.load && system.load();
      system.loadEntities && system.loadEntities();
    });
  }

  async start() {
    // 5. Render Loop and Game Update
    await this.loadSystems();

    this.engine.runRenderLoop(() => {
      const scene = this.currentScene;
      if (!scene || !scene.isReady()) return;
      const deltaTime = this.engine.getDeltaTime();
      this.updateSystems(deltaTime);
      if (scene.activeCamera) scene.render();
    });

    // 6. Resize the game when the window resizes.
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  updateSystems(deltaTime: number) {
    if (!this.sceneCode || !this.currentScene.isReady()) return;
    this.sceneCode.systems.forEach((system: System) => {
      if (system.update) system.update(deltaTime);
    });
  }

  async loadSceneData(sceneName: string, gameName: string) {
    // 1.
    const scenePath = `/GameData/${gameName}/scenes/${sceneName}.json`;
    const response = await fetch(scenePath, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const sceneData = await response.json();
    if (!sceneData) {
      throw "Data is not in JSON Format";
      return;
    }
    if (!sceneData.entities) {
      throw "No entities property in sceneData";
      return;
    }
    this.originalSceneData = sceneData;
    this.sceneCode = await this.loadSceneCode(sceneData);
  }

  async loadSceneCode(data: any) {
    // Process entities and components
    const entities: any = {};
    const componentTypes = new Set();
    const systems: System[] = [];
    const components: Map<string, Component> = new Map();

    const uniqueComponents = new Set(
      Object.keys(data.entities).flatMap((entityName) =>
        Object.keys(data.entities[entityName].components),
      ),
    );

    for (let componentType of uniqueComponents) {
      try {
        const { component, system } =
          await this.importComponentAndSystem(componentType);
        if (component && system) {
          this.componentCache.set(componentType, {
            component,
            system,
          });
        }
      } catch (error) {
        console.error(
          `Failed to import component/system: ${componentType}`,
          error,
        );
      }
    }

    //Process each entity and component
    for (const entityName in data.entities) {
      const entityData = data.entities[entityName];
      if (entityData) {
        entities[entityName] = this.createEntity(entityName);
        if (entityName == data.worldEntity)
          this.worldEntity = entities[entityName];
      }
      for (const componentType in entityData.components) {
        const componentData = entityData.components[componentType];

        // Use cached component and create new instance.
        const cachedComponent = this.componentCache.get(componentType);
        // debugger;
        if (cachedComponent && cachedComponent.component) {
          components.set(componentType, cachedComponent.component);
          const c = new cachedComponent.component(componentData);
          entities[entityName].addComponent(c);
          componentTypes.add(componentType);
        } else {
          console.error(`Failed to load component: ${componentType}`);
        }
      }
    }

    // 3. Instantiate Systems - AFTER all components are loaded
    for (const systemName of this.componentCache) {
      const cachedComponent = this.componentCache.get(systemName[0]);
      if (cachedComponent && cachedComponent.system) {
        // debugger;
        const system = new cachedComponent.system(this, [
          cachedComponent.component,
        ]); //Pass in the component class to the system.
        systems.push(system);
      } else {
        console.warn(`System not found in cache for: ${systemName}`); //Handle missing system appropriately
      }
    }

    return { entities, componentTypes, systems, components }; // Return processed scene data
  }

  async importComponentAndSystem(componentType: string): any {
    try {
      const module = await import(
        /* @vite-ignore */ `${BASE_COMPONENT_DIR}${componentType}.ts`
      );
      const component = module[`${componentType}Component`] as Component;
      const system = module[`${`${componentType}System`}`] as System;
      return { component, system };
    } catch (error) {
      console.error(
        `Failed to import component/system: ${componentType}`,
        error,
      );
      return { component: null, system: null };
    }
  }

  search(name: string[] | string): Entity | Entity[] | undefined {
    if (Array.isArray(name)) {
      return name
        .map((n) => {
          return this.entities.get(n);
        })
        .filter((e) => !!e);
    }
    return this.entities.get(name);
  }

  // Refreshes the entities this system is concerned with
  entitiesWith(componentClasses: Component | Component[]): Entity[] {
    const entities = this.entities.values();
    const e = Array.from(entities).filter((entity: Entity) =>
      Array.isArray(componentClasses)
        ? componentClasses.every((comp) => entity.hasComponent(comp))
        : entity.hasComponent(componentClasses),
    );
    const m = new Map();
    e.forEach((entity) => m.set(entity.name, entity));
    return e;
  }

  createEntity(name: string) {
    const entity = new Entity(name);
    this.entities.set(entity.name, entity);
    return entity;
  }

  removeEntity(entity: Entity) {
    this.entities.delete(entity.name);
  }
}
