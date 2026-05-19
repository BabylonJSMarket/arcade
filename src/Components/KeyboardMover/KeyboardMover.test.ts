import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardMoverComponent, KeyboardMoverSystem } from './KeyboardMover';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { ArcCameraComponent } from '../ArcCamera/ArcCamera';
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
    arc.initialized = true;
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
    arc.initialized = true;
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
    arc.initialized = true;
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
});
