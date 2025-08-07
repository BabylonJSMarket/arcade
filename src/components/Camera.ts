import { Vector3, UniversalCamera, FollowCamera } from "@babylonjs/core";
import { Component, Entity, World, System } from "~/lib/ECS";

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

  loadEntity(entity: Entity) {
    const cameraComponent = entity.getComponent(CameraComponent);
    let { offset, type, target, camera } = cameraComponent;
    const canvas = this.scene.getEngine().getRenderingCanvas();
    camera = new UniversalCamera(
      "UniversalCamera",
      entity.position,
      this.scene,
    );
    let t =
      this.scene.getNodeByName(target) || this.scene.getNodeByName("World");

    // This attaches the camera to the canvas
    camera.checkCollisions = true;
    camera.collisionRadius = new Vector3(0.5, 0.5, 0.5);
    camera.useFramingBehavior = true;

    cameraComponent.camera = camera;
    camera.parent = entity;
    cameraComponent.loaded = true;
    console.log("Camera component loaded");
  }

  processEntity(entity: Entity, deltaTime: number) {
    const cameraComponent = entity.getComponent(CameraComponent);
    const { camera, target } = cameraComponent;
    const t =
      this.scene.getNodeByName(target) || this.scene.getNodeByName("World");
    // gui[entity.name].addLabel("CAM", camera.getTarget());
    // gui[entity.name].addLabel("TAR", t.position);

    // Handle null camera target gracefully
    const currentTarget = camera.getTarget() || new Vector3(0, 0, 0);
    camera.setTarget(
      Vector3.Lerp(currentTarget, t?.position || new Vector3(0, 0, 0), 0.01),
    );

    var dist = Vector3.Distance(
      camera.position,
      t?.position || new Vector3(0, 0, 0),
    );
    const amount = (Math.min(dist - 2, 0) + Math.max(dist - 8, 0)) * 0.01;
    var cameraDirection = camera.getDirection(new Vector3(0, 0, 1));
    cameraDirection.y = 0;
    cameraDirection.normalize();
    cameraDirection.scaleAndAddToRef(amount, camera.position);
    // camera.position.y += (t.position.y + 2 - camera.position.y) * 0.04;
    if (camera.position.y < 0) camera.position.y = 0;
  }
}
