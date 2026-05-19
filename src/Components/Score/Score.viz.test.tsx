// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ScorePanel } from './Score.panel';
import { createScore } from './Score.core';

describe('ScorePanel (renderer-free)', () => {
  it('mounts against a stub core and shows the scoreboard section', () => {
    const core = createScore({}, { player1: 10, player2: 7 });
    const { container } = render(() => <ScorePanel core={core} />);
    expect(container.textContent).toContain('Scoreboard');
    expect(container.textContent).toContain('player1');
    expect(container.textContent).toContain('10');
  });

  it('clicking an Award button fires onAward with the current defaultPoints', () => {
    const core = createScore({ defaultPoints: 5 });
    const onAward = vi.fn();
    const { getByText } = render(() => (
      <ScorePanel core={core} onAward={onAward} players={['player1']} />
    ));
    fireEvent.click(getByText('+5 player1'));
    expect(onAward).toHaveBeenCalledWith('player1', 5);
  });

  it('clicking Reset scores fires onResetScores when supplied', () => {
    const core = createScore();
    const onResetScores = vi.fn();
    const { getByText } = render(() => <ScorePanel core={core} onResetScores={onResetScores} />);
    fireEvent.click(getByText('Reset scores'));
    expect(onResetScores).toHaveBeenCalled();
  });
});
