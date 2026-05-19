// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ScorePanel } from './Score.panel';
import { createScore } from './Score.core';

describe('ScorePanel', () => {
  it('mounts without a renderer and shows the scoreboard + tuning sections', () => {
    const core = createScore();
    const { container } = render(() => <ScorePanel core={core} />);
    expect(container.textContent).toContain('Scoreboard');
    expect(container.textContent).toContain('Award points');
    expect(container.textContent).toContain('defaultPoints');
  });

  it('moving a slider calls core.setParams with the new value', () => {
    const core = createScore();
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <ScorePanel core={core} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    // First slider is defaultPoints.
    fireEvent.input(sliders[0], { target: { value: '5' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ defaultPoints: 5 }));
  });

  it('the Award button fires onAward when the callback is supplied', () => {
    const core = createScore({ defaultPoints: 3 });
    const onAward = vi.fn();
    const { getByText } = render(() => (
      <ScorePanel core={core} onAward={onAward} players={['player1']} />
    ));
    fireEvent.click(getByText('+3 player1'));
    expect(onAward).toHaveBeenCalledWith('player1', 3);
  });

  it('the Reset scores button fires onResetScores when supplied', () => {
    const core = createScore();
    const onResetScores = vi.fn();
    const { getByText } = render(() => <ScorePanel core={core} onResetScores={onResetScores} />);
    fireEvent.click(getByText('Reset scores'));
    expect(onResetScores).toHaveBeenCalled();
  });

  it('the Reset (params) button clears core params back to defaults', () => {
    const core = createScore({ defaultPoints: 50 });
    const spy = vi.spyOn(core, 'reset');
    const { getByText } = render(() => <ScorePanel core={core} />);
    fireEvent.click(getByText(/reset to defaults/i));
    expect(spy).toHaveBeenCalled();
  });
});
