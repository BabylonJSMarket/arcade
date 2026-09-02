import { SoundInputEvents } from '../../events';
import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import { SoundComponent, SoundSystem } from './Sound';

runMechanicContract({
  name: 'Sound',
  componentClass: SoundComponent,
  systemClass: SoundSystem,
  sampleInput: { src: '/arcade/sounds/pacman.mp3', loop: true, spatial: true, rolloff: 3 },
  events: {
    input: [SoundInputEvents.PLAY, SoundInputEvents.STOP, SoundInputEvents.SET_VOLUME],
    // Outputs (READY / BLOCKED / ERROR) all follow an awaited adapter call, so
    // none lands inside the battery's synchronous update ticks; Sound.test.ts
    // covers them with real awaits.
  },
  makeInputPayload: () => ({ entityId: 'nobody', volume: 0.5 }),
});
