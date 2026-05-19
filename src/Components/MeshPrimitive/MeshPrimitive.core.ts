/**
 * MeshPrimitive.core.ts — pure data Component for primitive meshes.
 *
 * Zero imports from @babylonjs, three, or the DOM. Fields are plain tuples.
 * The MeshPrimitiveSystem reads this and calls into the active RendererAdapter
 * to create the actual 3D object.
 */

import { Component } from '@babylonjsmarket/ecs';
import type {
  MaterialSpec,
  MeshHandle,
  PrimitiveSpec,
  Vec3,
} from '@babylonjsmarket/ecs/renderer-types';

export type PrimitiveType = PrimitiveSpec['kind'];

/** Input shape accepted by the component constructor (and the scene JSON). */
export interface MeshPrimitiveInput {
  primitive?: PrimitiveType;
  autoCreate?: boolean;

  /** [x, y, z]. Vector3-like objects are also accepted for legacy callers. */
  position?: Vec3 | { x: number; y: number; z: number };
  rotation?: Vec3 | { x: number; y: number; z: number };

  width?: number;
  height?: number;
  depth?: number;

  diameter?: number;
  segments?: number;

  diameterTop?: number;
  diameterBottom?: number;
  tessellation?: number;

  radius?: number;
  pivotAtBottom?: boolean;

  size?: number;
  subdivisions?: number;

  thickness?: number;

  /** Shorthand for diffuse color [r, g, b]. */
  color?: [number, number, number];
  /** Full material configuration. Legacy key names are mapped to the new spec. */
  material?: {
    diffuseColor?: [number, number, number];
    specularColor?: [number, number, number];
    emissiveColor?: [number, number, number];
    ambientColor?: [number, number, number];
    alpha?: number;
  };

  visible?: boolean;
}

function toVec3(input: unknown, fallback: Vec3): Vec3 {
  if (!input) return [...fallback] as Vec3;
  if (Array.isArray(input) && input.length === 3) {
    return [Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0];
  }
  const o = input as { x?: number; y?: number; z?: number };
  if (typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number') {
    return [o.x, o.y, o.z];
  }
  return [...fallback] as Vec3;
}

export class MeshPrimitiveComponent extends Component {
  primitive: PrimitiveType;
  autoCreate: boolean;

  position: Vec3;
  rotation: Vec3;

  width: number;
  height: number;
  depth: number;

  diameter: number;
  segments: number;

  diameterTop?: number;
  diameterBottom?: number;
  tessellation: number;

  radius: number;
  pivotAtBottom: boolean;

  size: number;
  subdivisions: number;

  thickness: number;

  material?: MaterialSpec;

  visible: boolean;

  /** Opaque handle returned by the renderer once the mesh is created. */
  handle?: MeshHandle;
  /** True after the system has called renderer.createMesh. */
  isCreated = false;

  constructor(data: MeshPrimitiveInput = {}) {
    super();

    this.primitive = data.primitive ?? 'box';
    this.autoCreate = data.autoCreate ?? true;

    this.position = toVec3(data.position, [0, 0, 0]);
    this.rotation = toVec3(data.rotation, [0, 0, 0]);

    this.width = data.width ?? 1;
    this.height = data.height ?? 1;
    this.depth = data.depth ?? 1;

    this.diameter = data.diameter ?? 1;
    this.segments = data.segments ?? 32;

    this.diameterTop = data.diameterTop;
    this.diameterBottom = data.diameterBottom;
    this.tessellation = data.tessellation ?? 24;

    this.radius = data.radius ?? 0.5;
    this.pivotAtBottom = data.pivotAtBottom ?? false;

    this.size = data.size ?? 10;
    this.subdivisions = data.subdivisions ?? 1;

    this.thickness = data.thickness ?? 0.3;

    if (data.color) {
      this.material = { diffuse: data.color };
    } else if (data.material) {
      const m = data.material;
      this.material = {
        diffuse: m.diffuseColor,
        specular: m.specularColor,
        emissive: m.emissiveColor,
        alpha: m.alpha,
      };
      void m.ambientColor; // legacy key ignored; ambient is driven by scene lights now
    }

    this.visible = data.visible ?? true;
  }

  toPrimitiveSpec(): PrimitiveSpec {
    return {
      kind: this.primitive,
      width: this.width,
      height: this.height,
      depth: this.depth,
      diameter: this.diameter,
      diameterTop: this.diameterTop,
      diameterBottom: this.diameterBottom,
      segments: this.segments,
      tessellation: this.tessellation,
      radius: this.radius,
      thickness: this.thickness,
      subdivisions: this.subdivisions,
      pivotAtBottom: this.pivotAtBottom,
    };
  }

  serialize(): MeshPrimitiveInput {
    const material = this.material
      ? {
          diffuseColor: this.material.diffuse,
          specularColor: this.material.specular,
          emissiveColor: this.material.emissive,
          alpha: this.material.alpha,
        }
      : undefined;
    return {
      primitive: this.primitive,
      autoCreate: this.autoCreate,
      position: [...this.position] as Vec3,
      rotation: [...this.rotation] as Vec3,
      width: this.width,
      height: this.height,
      depth: this.depth,
      diameter: this.diameter,
      segments: this.segments,
      diameterTop: this.diameterTop,
      diameterBottom: this.diameterBottom,
      tessellation: this.tessellation,
      radius: this.radius,
      pivotAtBottom: this.pivotAtBottom,
      size: this.size,
      subdivisions: this.subdivisions,
      thickness: this.thickness,
      material,
      visible: this.visible,
    };
  }
}
