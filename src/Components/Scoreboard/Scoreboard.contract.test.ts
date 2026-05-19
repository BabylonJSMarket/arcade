import { runMechanicContract } from '@babylonjsmarket/ecs/testing';
import {
  ScoreboardComponent,
  ScoreboardSystem,
  ScoreboardEvents,
  ScoreboardInputEvents,
} from './Scoreboard';

runMechanicContract({
  name: 'Scoreboard',
  componentClass: ScoreboardComponent,
  systemClass: ScoreboardSystem,
  sampleInput: { fontSize: 22, position: 'bottom-right' },
  events: {
    input: [
      ScoreboardInputEvents.SCORE_CHANGED,
      ScoreboardInputEvents.SCORE_RESET,
    ],
    output: [ScoreboardEvents.UPDATED],
  },
  makeInputPayload(event) {
    if (event === ScoreboardInputEvents.SCORE_CHANGED) {
      return {
        ownerEntity: 'p1',
        score: 7,
        allScores: { p1: 7 },
      };
    }
    if (event === ScoreboardInputEvents.SCORE_RESET) {
      return { allScores: {} };
    }
    return {};
  },
});
