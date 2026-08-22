/**
 * MeshPrimitive — definitions.
 *
 * Holds the `MeshPrimitiveComponent` class and the shapes its data and
 * events travel in. No System lives here, which is the point: another
 * component can name MeshPrimitive in a query, or type an event it listens
 * for, without pulling MeshPrimitive's behaviour into its own bundle. Import
 * from here, not from MeshPrimitive.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { MaterialSpec, MeshHandle, PrimitiveSpec, Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export type PrimitiveType = PrimitiveSpec['kind'];

/**
 * Runtime (non-serializable) state for a MeshPrimitive. The renderer handle is
 * a live engine reference and must NOT live on the pure-data Component (it can't
 * survive a serialize → JSON → deserialize round-trip). It is keyed by the
 * Component instance in a module-level WeakMap; because pooled entities reuse
 * the SAME Component instance across release/acquire, the handle is preserved
 * across parking exactly as if it were a field.
 */
export interface MeshPrimitiveRuntime {
  handle?: MeshHandle;
}

export const runtimeByComponent = new WeakMap<MeshPrimitiveComponent, MeshPrimitiveRuntime>();

/** Lazily create + return the runtime slot for a component. */
export function getMeshPrimitiveRuntime(comp: MeshPrimitiveComponent): MeshPrimitiveRuntime {
  let rt = runtimeByComponent.get(comp);
  if (!rt) {
    rt = {};
    runtimeByComponent.set(comp, rt);
  }
  return rt;
}

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
    /**
     * Texture-map URLs. Any one of these flips the renderer to a PBR material
     * (e.g. a tiled carpet floor). `uScale`/`vScale` tile the maps across the
     * surface; `metallic`/`roughness` are PBR scalars.
     */
    albedoTexture?: string;
    normalTexture?: string;
    roughnessTexture?: string;
    ambientTexture?: string;
    metallic?: number;
    roughness?: number;
    uScale?: number;
    vScale?: number;
    /**
     * How many lights may light this surface at once. Renderers cap this
     * (Babylon: 4) and silently DROP the extras, so a room lit by several
     * small lights needs it raised on the big surfaces they fall on.
     */
    maxSimultaneousLights?: number;
  };

  visible?: boolean;
}

export function toVec3(input: unknown, fallback: Vec3): Vec3 {
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

  /** True after the system has called renderer.createMesh. */
  isCreated = false;

  /**
   * Opaque handle returned by the renderer once the mesh is created. This is
   * runtime-only state: it is stored in a System-side WeakMap (see
   * {@link getMeshPrimitiveRuntime}) rather than as a serializable field. The
   * getter/setter keep the historical `comp.handle` access shape working for
   * the many consumers (Movement, Physics, Shadow, pools, …) that read it.
   */
  get handle(): MeshHandle | undefined {
    return getMeshPrimitiveRuntime(this).handle;
  }
  set handle(value: MeshHandle | undefined) {
    getMeshPrimitiveRuntime(this).handle = value;
  }

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
        albedoTexture: m.albedoTexture,
        normalTexture: m.normalTexture,
        roughnessTexture: m.roughnessTexture,
        ambientTexture: m.ambientTexture,
        metallic: m.metallic,
        roughness: m.roughness,
        uScale: m.uScale,
        vScale: m.vScale,
        maxSimultaneousLights: m.maxSimultaneousLights,
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
          albedoTexture: this.material.albedoTexture,
          normalTexture: this.material.normalTexture,
          roughnessTexture: this.material.roughnessTexture,
          ambientTexture: this.material.ambientTexture,
          metallic: this.material.metallic,
          roughness: this.material.roughness,
          uScale: this.material.uScale,
          vScale: this.material.vScale,
          maxSimultaneousLights: this.material.maxSimultaneousLights,
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