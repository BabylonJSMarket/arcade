import { Entity } from "./Entity";
import { World } from "./World";
import { Component } from "./Component";
import { Scene } from "@babylonjs/core";

export abstract class System {
  protected entities: Entity[] = [];
  protected componentClasses: Component[];
  protected scene: Scene;
  public world: World;
  public isPauseable: boolean = false;

  constructor(world: World, componentClasses: Component[]) {
    this.world = world;
    this.scene = world.currentScene;
    this.componentClasses = componentClasses;
  }

  // Updates each entity this system is concerned with
  update(deltaTime: number): void {
    if (this.isPauseable && this.world.isPaused) return;
    const entities = this.world.entitiesWith(this.componentClasses);
    for (const entity of entities) {
      if (this.processEntity) this.processEntity(entity, deltaTime);
    }
  }

  loadEntities(): void {
    if (!this.loadEntity) return;
    const entities = this.world.entitiesWith(this.componentClasses);
    for (const entity of entities) {
      this.loadEntity(entity);
    }
  }

  public abstract load(): void;
  public abstract loadEntity(entity: Entity): void;
  public abstract processEntity(entity: Entity, deltaTime: number): void;
}
