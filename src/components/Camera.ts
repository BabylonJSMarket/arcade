import { Vector3, UniversalCamera } from "@babylonjs/core";
import { Component, Entity, World, System } from "../lib/ECS/index.js";

export interface CameraComponentInput {
  type: "Free" | "Static" | "Follow";
  offset: [number, number, number];
  target?: string;
}

export class CameraComponent extends Component {
  public type: "Free" | "Static" | "Follow";
  public offset: Vector3;
  public target: string;
  public camera: UniversalCamera | null = null;

  constructor(data: CameraComponentInput) {
    super(data);
    this.type = data.type;
    this.offset = Vector3.FromArray(data.offset);
    this.target = data.target || "World";
  }
}

export class CameraSystem extends System {
  constructor(world: World, componentClasses = [CameraComponent]) {
    super(world, componentClasses);
  }

  load(): void {
    // Initialize the camera system
  }

  loadEntity(entity: Entity) {
    const cameraComponent = entity.getComponent(CameraComponent);
    // Get camera component properties
    let camera = new UniversalCamera(
      "UniversalCamera",
      entity.position,
      this.scene,
    );

    // This attaches the camera to the canvas
    camera.checkCollisions = true;
    camera.ellipsoid = new Vector3(0.5, 0.5, 0.5);

    cameraComponent.camera = camera;
    camera.parent = entity;
    cameraComponent.loaded = true;
    console.log("Camera component loaded");
  }

  processEntity(entity: Entity, _deltaTime: number) {
    const cameraComponent = entity.getComponent(CameraComponent);
    const { camera, target } = cameraComponent;
    const t =
      this.scene.getNodeByName(target) || this.scene.getNodeByName("World");

    if (!camera) return;

    // Handle null camera target gracefully
    const currentTarget = camera.getTarget() || new Vector3(0, 0, 0);
    const targetPosition = (t as any)?.position || new Vector3(0, 0, 0);
    camera.setTarget(Vector3.Lerp(currentTarget, targetPosition, 0.01));

    var dist = Vector3.Distance(camera.position, targetPosition);
    const amount = (Math.min(dist - 2, 0) + Math.max(dist - 8, 0)) * 0.01;
    var cameraDirection = camera.getDirection(new Vector3(0, 0, 1));
    cameraDirection.y = 0;
    cameraDirection.normalize();
    cameraDirection.scaleAndAddToRef(amount, camera.position);
    if (camera.position.y < 0) camera.position.y = 0;
  }
}
