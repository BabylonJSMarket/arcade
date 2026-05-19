import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  ScoreComponent,
  ScoreSystem,
  ScoreEvents,
  ScoreInputEvents,
} from './Score';

runMechanicContract({
  name: 'Score',
  componentClass: ScoreComponent,
  systemClass: ScoreSystem,
  sampleInput: { defaultPoints: 3 },
  events: {
    input: [
      ScoreInputEvents.ADD,
      ScoreInputEvents.RESET,
      ScoreInputEvents.GOAL_SCORED,
    ],
    output: [ScoreEvents.CHANGED, ScoreEvents.RESET],
  },
  makeInputPayload(event) {
    if (event === ScoreInputEvents.ADD) return { ownerEntity: 'contract-player', points: 7 };
    if (event === ScoreInputEvents.GOAL_SCORED) return { ownerEntity: 'contract-player', points: 1 };
    return {};
  },
});
