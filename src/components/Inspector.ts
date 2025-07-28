import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

import { Component, Entity, World, System } from "~/lib/ECS";

export interface InspectorComponentInput {
  debugLayerId: string;
  triggerKey: string;
}

export class InspectorComponent extends Component {
  public debugLayerId: string;
  public triggerKey: string;

  constructor(data: InspectorComponentInput) {
    super(data);
    const { debugLayerId, triggerKey } = data;
    this.debugLayerId = debugLayerId || "debugLayer";
    this.triggerKey = triggerKey || "Backquote";
  }
}

export class InspectorSystem extends System {
  constructor(world: World, componentClasses = [InspectorComponent]) {
    super(world, componentClasses);
  }

  loadEntity(entity: Entity, deltaTime: number) {
    const inspectorComponent = entity.getComponent(InspectorComponent);
    const { triggerKey, debugLayerId } = inspectorComponent;
    window.addEventListener("keydown", (ev) => {
      const canvas = this.scene.getEngine().getRenderingCanvas();
      canvas.focus();
      if (ev.code === triggerKey) {
        if (this.scene.debugLayer?.isVisible()) {
          this.scene.debugLayer.hide();
        } else {
          this.scene.debugLayer.show({
            overlay: true,
            embedMode: true,
            globalRoot: document.getElementById(debugLayerId) as HTMLElement,
          });
        }
      }
    });
  }
}
