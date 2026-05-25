import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { HealthBarComponent, HealthBarSystem } from './HealthBar';
import { HealthComponent } from '../Health/Health';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive';

runMechanicContract({
  name: 'HealthBar',
  componentClass: HealthBarComponent,
  systemClass: HealthBarSystem,
  sampleInput: { offsetY: 1.5 },
  // HealthBarSystem.query.required also lists Health + MeshPrimitive, so the
  // contract's test entity needs those siblings to match the query.
  companions: [HealthComponent, MeshPrimitiveComponent],
});
