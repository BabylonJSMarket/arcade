import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { KeyboardMoverComponent, KeyboardMoverSystem } from './KeyboardMover';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

runMechanicContract({
  name: 'KeyboardMover',
  componentClass: KeyboardMoverComponent,
  systemClass: KeyboardMoverSystem,
  sampleInput: { speed: 6 },
  // KeyboardMover's query requires both its own component and a
  // MeshPrimitive on the same entity — the mover moves the mesh.
  companions: [MeshPrimitiveComponent],
  // Event-silent — it subscribes to keyboard events on `window`, not the
  // EventBus, and doesn't emit anything. Contract battery just validates
  // lifecycle + defaults + serialization.
});
