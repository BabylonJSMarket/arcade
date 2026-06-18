import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardMoverComponent, KeyboardMoverSystem } from './KeyboardMover';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';
import { getArcCameraRuntime } from '../ArcCamera/ArcCamera.core';
import { EventBus, World } from '@babylonjsmarket/ecs';
import { MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('KeyboardMover', () => {
  let eventBus: EventBus;
  let world: World;
  let renderer: MockRendererAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    renderer = new MockRendererAdapter();
    world = new World({ eventBus, renderer });
    world.addSystem(new KeyboardMoverSystem(eventBus));
    world.initialize();
  });

  it('applies defaults', () => {
    const c = new KeyboardMoverComponent();
    expect(c.speed).toBe(4);
    expect(c.faceMotion).toBe(true);
  });

  it('moves the mesh along camera-forward when W is held', () => {
    // Camera at alpha=0: forward (camera→target) is -X.
    const camEntity = world.createEntity('Camera');
    const arc = new ArcCameraComponent({ alpha: 0 });
    arc.handle = renderer.createArcCamera(camEntity.id, arc.toSpec());
    getArcCameraRuntime(arc).initialized = true;
    camEntity.add(arc);

    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });

    renderer.calls.length = 0;
    world.update(0.1);

    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    // 1 second * 10 speed * 0.1 dt = 1 unit; direction -X.
    expect(move!.args[1]).toBeCloseTo(-1, 3);
    expect(move!.args[3]).toBeCloseTo(0, 3);
  });

  it('uses the adapter-reported right vector so A/D stay correct under any handedness', () => {
    const camEntity = world.createEntity('Camera');
    const arc = new ArcCameraComponent({ alpha: 0 });
    arc.handle = renderer.createArcCamera(camEntity.id, arc.toSpec());
    getArcCameraRuntime(arc).initialized = true;
    camEntity.add(arc);

    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    // Mock uses RH convention: at alpha=0, right = (0, 0, -1). Pressing D
    // (input +right) should therefore move the character in -Z.
    eventBus.emit('keyboard.keydown', { code: 'KeyD' });
    renderer.calls.length = 0;
    world.update(0.1);

    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    expect(move!.args[1]).toBeCloseTo(0, 3);
    expect(move!.args[3]).toBeCloseTo(-1, 3);
  });

  it('stops moving once the key is released', () => {
    const camEntity = world.createEntity('Camera');
    const arc = new ArcCameraComponent({ alpha: 0 });
    arc.handle = renderer.createArcCamera(camEntity.id, arc.toSpec());
    getArcCameraRuntime(arc).initialized = true;
    camEntity.add(arc);

    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    world.update(0.1);
    eventBus.emit('keyboard.keyup', { code: 'KeyW' });

    renderer.calls.length = 0;
    world.update(0.1);
    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeUndefined();
  });

  it('bridges DOM keydown/keyup events to the bus and moves', () => {
    // onInitialize installs window listeners in jsdom; a real DOM event should
    // emit the bus event and drive the mover.
    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    renderer.calls.length = 0;
    world.update(0.1);
    // No camera → fallback forward = -X.
    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    expect(move!.args[1]).toBeCloseTo(-1, 3);

    // A real keyup stops it.
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    renderer.calls.length = 0;
    world.update(0.1);
    expect(renderer.calls.find((c) => c.method === 'setMeshPosition')).toBeUndefined();
  });

  it('moves along the fallback forward (-X) when there is no camera', () => {
    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    renderer.calls.length = 0;
    world.update(0.1);

    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    expect(move!.args[1]).toBeCloseTo(-1, 3);
    expect(move!.args[3]).toBeCloseTo(0, 3);
  });

  it('moves back (+X) on S and left (+Z) on A', () => {
    const camEntity = world.createEntity('Camera');
    const arc = new ArcCameraComponent({ alpha: 0 });
    arc.handle = renderer.createArcCamera(camEntity.id, arc.toSpec());
    getArcCameraRuntime(arc).initialized = true;
    camEntity.add(arc);

    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    // S = back: forward is -X, so back is +X.
    eventBus.emit('keyboard.keydown', { code: 'KeyS' });
    renderer.calls.length = 0;
    world.update(0.1);
    let move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    expect(move!.args[1]).toBeCloseTo(1, 3);
    eventBus.emit('keyboard.keyup', { code: 'KeyS' });

    // A = left: right is (0,0,-1), so left is +Z.
    mesh.position[0] = 0; mesh.position[2] = 0;
    eventBus.emit('keyboard.keydown', { code: 'KeyA' });
    renderer.calls.length = 0;
    world.update(0.1);
    move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    expect(move!.args[3]).toBeCloseTo(1, 3);
  });

  it('normalizes diagonal input so combined speed is not exaggerated', () => {
    const camEntity = world.createEntity('Camera');
    const arc = new ArcCameraComponent({ alpha: 0 });
    arc.handle = renderer.createArcCamera(camEntity.id, arc.toSpec());
    getArcCameraRuntime(arc).initialized = true;
    camEntity.add(arc);

    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: false }));

    // W + D: raw velocity (-1,-1) has length sqrt(2) > 1, so it normalizes.
    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    eventBus.emit('keyboard.keydown', { code: 'KeyD' });
    renderer.calls.length = 0;
    world.update(0.1);

    const move = renderer.calls.find((c) => c.method === 'setMeshPosition');
    expect(move).toBeDefined();
    const dx = move!.args[1] as number;
    const dz = move!.args[3] as number;
    // Per-axis ≈ speed*dt/sqrt(2); combined magnitude ≈ speed*dt (1 unit), not sqrt(2).
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 3);
    expect(Math.abs(dx)).toBeCloseTo(Math.SQRT1_2, 3);
    expect(Math.abs(dz)).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('yaws the mesh to face motion when faceMotion is on', () => {
    const playerEntity = world.createEntity('Player');
    const mesh = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] });
    mesh.handle = renderer.createMesh(playerEntity.id, { kind: 'capsule' });
    playerEntity.add(mesh);
    playerEntity.add(new KeyboardMoverComponent({ speed: 10, faceMotion: true }));

    eventBus.emit('keyboard.keydown', { code: 'KeyW' });
    renderer.calls.length = 0;
    world.update(0.1);

    const rot = renderer.calls.find((c) => c.method === 'setMeshRotation');
    expect(rot).toBeDefined();
    // Fallback forward is -X (vx=-1, vz=0) → yaw = atan2(-1, 0) = -PI/2.
    expect(mesh.rotation[1]).toBeCloseTo(Math.atan2(-1, 0), 3);
    expect(rot!.args[2]).toBeCloseTo(Math.atan2(-1, 0), 3);
  });
});
