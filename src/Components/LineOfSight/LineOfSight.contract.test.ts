import { runMechanicContract } from '@babylonjsmarket/ecs/testing'
import { LineOfSightComponent, LineOfSightSystem } from './LineOfSight'
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.defs';

runMechanicContract({
  name: 'LineOfSight',
  componentClass: LineOfSightComponent,
  systemClass: LineOfSightSystem,
  sampleInput: { fov: 180, interval: 1 },
  // The system reads its sibling MeshPrimitive for the viewer position.
  companions: [MeshPrimitiveComponent],
  events: {
    // Listens for the debug-rays toggle. ACQUIRED/LOST only fire once a tagged
    // target exists and visibility flips — out of scope for the bare contract.
    input: ['lineofsight.debugrays.set'],
  },
  makeInputPayload: () => ({ enabled: true }),
})
