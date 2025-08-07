import { Entity, World, System, Component } from "~/lib/ECS";
import { HemisphericLight, Vector3, DirectionalLight } from "@babylonjs/core";

export interface LightingComponentInput {
  types: ["ambient", "directional"];
  shadows: boolean;
  offset: [number, number, number];
}

export class LightingComponent extends Component {
  types = ["ambient", "directional"];
  lights = [] as any[];
  offset = [-2, -2, 0];
  shadows: boolean = false;

  constructor(data: LightingComponentInput) {
    super(data);
    this.types = data.types;
    this.offset = data.offset;
    this.shadows = data.shadows;
  }
}

export class LightingSystem extends System {
  constructor(world: World, componentClasses = [LightingComponent]) {
    super(world, componentClasses);
  }

  loadEntity(entity: Entity) {
    const lightingComponent = entity.getComponent(LightingComponent);
    lightingComponent.loading = true;
    const { lights, types, offset } = lightingComponent;
    const ov = Vector3.FromArray(offset);
    types.forEach((type, index) => {
      if (type === "ambient") {
        const light = new HemisphericLight(
          `HemisphericLight-${lights.length}`,
          ov,
          this.scene,
        );
        light.intensity = types.length > 1 ? 0.6 : 5;
        lightingComponent.lights.push(light);
      }
      if (type === "directional") {
        const light = new DirectionalLight(`DirectionalLight`, ov, this.scene);
        light.intensity = 3;
        light.autoCalcShadowZBounds = true;
        lightingComponent.lights.push(light);
      }
    });
    lightingComponent.loading = false;
    lightingComponent.loaded = true;
    console.log("Lighting initialized");
    return;
  }
}
