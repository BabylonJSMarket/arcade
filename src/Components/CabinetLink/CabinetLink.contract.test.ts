import { CabinetLinkEvents, FirstPersonCameraEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { CabinetLinkComponent, CabinetLinkSystem } from './CabinetLink';

runMechanicContract({
  name: 'CabinetLink',
  componentClass: CabinetLinkComponent,
  systemClass: CabinetLinkSystem,
  sampleInput: { game: 'frogger', facing: Math.PI / 2, standoff: 1.3, launchDistance: 1.5 },
  events: {
    input: [FirstPersonCameraEvents.CREATED],
    // FOCUSED / LAUNCH / OUT_OF_RANGE / GOTO need a pointer pick, which the
    // bare battery has no hand for; CabinetLink.test.ts drives every one.
  },
  makeInputPayload() {
    return { entityId: 'Player', handle: undefined };
  },
});
