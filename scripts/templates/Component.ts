import { Vector3 } from "@babylonjs/core";
import { Component, Entity, World, System } from "~/lib/ECS";

export interface BlankComponentInput {
  // This should match what's defined in ./data/Shared/Blank.ts
}

export class BlankComponent extends Component {
  // Define properties/options, inported from data.
  // public enabled = true
  // public loaded = false
  constructor(data: BlankComponentInput) {
    super(data);
  }
}

export class BlankSystem extends System {
  constructor(world: World, componentClasses = [BlankComponent]) {
    super(world, componentClasses);
  }

  loadEntity(entity: Entity) {
    // const blankComponent = entity.getComponent(BlankComponent);
    console.log("Blank component loaded");
  }

  processEntity(entity: Entity, deltaTime: number) {
    // const blankComponent = entity.getComponent(BlankComponent);
  }
}
