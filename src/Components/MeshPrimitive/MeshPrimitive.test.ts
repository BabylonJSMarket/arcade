import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  MeshPrimitiveEvents,
  MeshPrimitiveInputEvents,
  type PrimitiveType,
} from './MeshPrimitive';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('MeshPrimitiveComponent (core)', () => {
  it('defaults to box primitive with unit dimensions', () => {
    const c = new MeshPrimitiveComponent();
    expect(c.primitive).toBe('box');
    expect(c.width).toBe(1);
    expect(c.height).toBe(1);
    expect(c.depth).toBe(1);
    expect(c.autoCreate).toBe(true);
    expect(c.visible).toBe(true);
    expect(c.isCreated).toBe(false);
    expect(c.handle).toBeUndefined();
  });

  it('position defaults to [0,0,0] as a tuple', () => {
    const c = new MeshPrimitiveComponent();
    expect(c.position).toEqual([0, 0, 0]);
    expect(Array.isArray(c.position)).toBe(true);
  });

  it('accepts position as a tuple', () => {
    const c = new MeshPrimitiveComponent({ position: [1, 2, 3] });
    expect(c.position).toEqual([1, 2, 3]);
  });

  it('accepts position as a Vector3-like object (legacy callers)', () => {
    const c = new MeshPrimitiveComponent({ position: { x: 4, y: 5, z: 6 } });
    expect(c.position).toEqual([4, 5, 6]);
  });

  it('accepts color shorthand, mapping to material.diffuse', () => {
    const c = new MeshPrimitiveComponent({ color: [1, 0, 0] });
    expect(c.material?.diffuse).toEqual([1, 0, 0]);
  });

  it('accepts full material config using legacy key names', () => {
    const c = new MeshPrimitiveComponent({
      material: {
        diffuseColor: [1, 0, 0],
        specularColor: [0, 1, 0],
        emissiveColor: [0, 0, 1],
        alpha: 0.5,
      },
    });
    expect(c.material?.diffuse).toEqual([1, 0, 0]);
    expect(c.material?.specular).toEqual([0, 1, 0]);
    expect(c.material?.emissive).toEqual([0, 0, 1]);
    expect(c.material?.alpha).toBe(0.5);
  });

  it('toPrimitiveSpec returns a spec matching the component state', () => {
    const c = new MeshPrimitiveComponent({
      primitive: 'sphere',
      diameter: 2,
      segments: 48,
    });
    const spec = c.toPrimitiveSpec();
    expect(spec.kind).toBe('sphere');
    expect(spec.diameter).toBe(2);
    expect(spec.segments).toBe(48);
  });

  it('accepts every primitive type', () => {
    const types: PrimitiveType[] = [
      'box', 'sphere', 'cylinder', 'capsule', 'plane', 'ground', 'torus', 'disc',
    ];
    for (const kind of types) {
      const c = new MeshPrimitiveComponent({ primitive: kind });
      expect(c.primitive).toBe(kind);
    }
  });

  it('serialize round-trips through the constructor', () => {
    const original = new MeshPrimitiveComponent({
      primitive: 'cylinder',
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      height: 3,
      diameterTop: 1,
      diameterBottom: 2,
      tessellation: 48,
      color: [0.5, 0.5, 0.5],
      visible: false,
    });
    const copy = new MeshPrimitiveComponent(original.serialize());
    expect(copy.primitive).toBe('cylinder');
    expect(copy.position).toEqual([1, 2, 3]);
    expect(copy.rotation).toEqual([0.1, 0.2, 0.3]);
    expect(copy.height).toBe(3);
    expect(copy.diameterTop).toBe(1);
    expect(copy.tessellation).toBe(48);
    expect(copy.material?.diffuse).toEqual([0.5, 0.5, 0.5]);
    expect(copy.visible).toBe(false);
  });
});

describe('MeshPrimitive event name constants', () => {
  it('output event names', () => {
    expect(MeshPrimitiveEvents.CREATED).toBe('meshprimitive.created');
    expect(MeshPrimitiveEvents.MATERIAL_APPLIED).toBe('meshprimitive.material.applied');
    expect(MeshPrimitiveEvents.DISPOSED).toBe('meshprimitive.disposed');
  });

  it('input event names', () => {
    expect(MeshPrimitiveInputEvents.CREATE).toBe('meshprimitive.create');
    expect(MeshPrimitiveInputEvents.SET_POSITION).toBe('meshprimitive.position.set');
    expect(MeshPrimitiveInputEvents.SET_SCALE).toBe('meshprimitive.scale.set');
    expect(MeshPrimitiveInputEvents.SET_COLOR).toBe('meshprimitive.color.set');
    expect(MeshPrimitiveInputEvents.SET_VISIBLE).toBe('meshprimitive.visible.set');
    expect(MeshPrimitiveInputEvents.DISPOSE).toBe('meshprimitive.dispose');
  });
});

describe('MeshPrimitiveSystem — adapter integration', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;
  let system: MeshPrimitiveSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    system = new MeshPrimitiveSystem(eventBus);
    world.addSystem(system);
    world.initialize();
  });

  it('query requires MeshPrimitiveComponent', () => {
    expect((system as unknown as { query: unknown }).query).toEqual({
      required: [MeshPrimitiveComponent],
    });
  });

  it('auto-creates a mesh on entity add, storing handle and marking created', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent({ primitive: 'sphere', diameter: 2 });
    entity.add(comp);
    expect(comp.isCreated).toBe(true);
    expect(comp.handle).toBeDefined();
    const createCall = renderer.calls.find((c) => c.method === 'createMesh');
    expect(createCall).toBeDefined();
    expect((createCall?.args[1] as { kind: string }).kind).toBe('sphere');
  });

  it('does not create when autoCreate is false', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent({ autoCreate: false });
    entity.add(comp);
    expect(comp.isCreated).toBe(false);
    expect(renderer.calls.find((c) => c.method === 'createMesh')).toBeUndefined();
  });

  it('emits CREATED event with entityId, primitive, and handle', () => {
    const spy = vi.fn();
    eventBus.on(MeshPrimitiveEvents.CREATED, spy);
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent({ primitive: 'box' }));
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: entity.id,
        primitive: 'box',
        handle: expect.anything(),
      }),
    );
  });

  it('emits MATERIAL_APPLIED when a material is provided', () => {
    const spy = vi.fn();
    eventBus.on(MeshPrimitiveEvents.MATERIAL_APPLIED, spy);
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent({ color: [1, 0, 0] }));
    expect(spy).toHaveBeenCalledWith({ entityId: entity.id });
  });

  it('applies initial position through the adapter', () => {
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent({ position: [5, 10, 15] }));
    const posCall = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(posCall).toBeDefined();
    expect(posCall?.args.slice(1)).toEqual([5, 10, 15]);
  });

  it('applies initial rotation through the adapter', () => {
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent({ rotation: [0.1, 0.2, 0.3] }));
    const rotCall = renderer.calls.find((c) => c.method === 'setMeshRotation');
    expect(rotCall).toBeDefined();
    expect(rotCall?.args.slice(1)).toEqual([0.1, 0.2, 0.3]);
  });

  it('applies initial visibility through the adapter', () => {
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent({ visible: false }));
    const visCall = renderer.calls.find((c) => c.method === 'setMeshVisible');
    expect(visCall?.args[1]).toBe(false);
  });

  it('SET_POSITION event updates the component and forwards to the adapter', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent();
    entity.add(comp);
    renderer.calls.length = 0;
    eventBus.emit(MeshPrimitiveInputEvents.SET_POSITION, {
      entityId: entity.id,
      x: 20,
      y: 30,
      z: 40,
    });
    expect(comp.position).toEqual([20, 30, 40]);
    const posCall = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(posCall?.args.slice(1)).toEqual([20, 30, 40]);
  });

  it('SET_COLOR event updates material.diffuse and forwards to the adapter', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent({ color: [1, 1, 1] });
    entity.add(comp);
    renderer.calls.length = 0;
    eventBus.emit(MeshPrimitiveInputEvents.SET_COLOR, {
      entityId: entity.id,
      r: 1,
      g: 0,
      b: 0,
    });
    expect(comp.material?.diffuse).toEqual([1, 0, 0]);
    const colorCall = renderer.calls.find((c) => c.method === 'setMeshColor');
    expect(colorCall?.args.slice(1)).toEqual([1, 0, 0]);
  });

  it('SET_VISIBLE event forwards to the adapter', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent();
    entity.add(comp);
    renderer.calls.length = 0;
    eventBus.emit(MeshPrimitiveInputEvents.SET_VISIBLE, {
      entityId: entity.id,
      visible: false,
    });
    expect(comp.visible).toBe(false);
    const visCall = renderer.calls.find((c) => c.method === 'setMeshVisible');
    expect(visCall?.args[1]).toBe(false);
  });

  it('CREATE event re-creates the mesh with updated params', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent({ primitive: 'box', autoCreate: false });
    entity.add(comp);
    renderer.calls.length = 0;
    eventBus.emit(MeshPrimitiveInputEvents.CREATE, {
      entityId: entity.id,
      primitive: 'sphere',
      diameter: 10,
      color: [1, 0, 0],
    });
    expect(comp.primitive).toBe('sphere');
    expect(comp.diameter).toBe(10);
    expect(comp.material?.diffuse).toEqual([1, 0, 0]);
    expect(renderer.calls.find((c) => c.method === 'createMesh')).toBeDefined();
  });

  it('DISPOSE event asks the adapter to dispose the mesh', () => {
    const entity = world.createEntity();
    const comp = new MeshPrimitiveComponent();
    entity.add(comp);
    const disposedSpy = vi.fn();
    eventBus.on(MeshPrimitiveEvents.DISPOSED, disposedSpy);
    renderer.calls.length = 0;
    eventBus.emit(MeshPrimitiveInputEvents.DISPOSE, { entityId: entity.id });
    expect(renderer.calls.some((c) => c.method === 'disposeMesh')).toBe(true);
    expect(comp.handle).toBeUndefined();
    expect(comp.isCreated).toBe(false);
    expect(disposedSpy).toHaveBeenCalledWith({ entityId: entity.id });
  });

  it('entity removal disposes the underlying mesh', () => {
    const entity = world.createEntity();
    entity.add(new MeshPrimitiveComponent());
    renderer.calls.length = 0;
    world.removeEntity(entity);
    expect(renderer.calls.some((c) => c.method === 'disposeMesh')).toBe(true);
  });

  it('ignores events for unknown entity IDs without throwing', () => {
    expect(() => {
      eventBus.emit(MeshPrimitiveInputEvents.SET_POSITION, {
        entityId: 'ghost',
        x: 1,
        y: 2,
        z: 3,
      });
    }).not.toThrow();
  });

  it('onUpdate is a no-op', () => {
    expect(() => world.update(16)).not.toThrow();
  });

  it('creates pending primitives for entities that existed before system initialization', () => {
    const eb = new EventBus();
    const r = new MockRendererAdapter();
    const w = new World({ eventBus: eb, renderer: r });
    const entity = w.createEntity();
    const comp = new MeshPrimitiveComponent({ autoCreate: true });
    entity.add(comp);
    // No system yet — no handle
    expect(comp.handle).toBeUndefined();
    const s = new MeshPrimitiveSystem(eb);
    w.addSystem(s);
    w.initialize();
    expect(comp.handle).toBeDefined();
    expect(comp.isCreated).toBe(true);
  });
});
