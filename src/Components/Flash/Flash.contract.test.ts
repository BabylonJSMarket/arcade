import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { FlashComponent, FlashSystem } from './Flash';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';

runMechanicContract({
  name: 'Flash',
  componentClass: FlashComponent,
  systemClass: FlashSystem,
  sampleInput: { lifetime: 0.1 },
  // A flash is a visual effect, so the system requires a MeshPrimitive sibling
  // (this also keeps it from consuming bare `Flash: {}` marker entities).
  companions: [MeshPrimitiveComponent],
  // Event-silent: Flash just ticks its lifetime down and removes the host
  // entity. No inputs, no outputs.
});
