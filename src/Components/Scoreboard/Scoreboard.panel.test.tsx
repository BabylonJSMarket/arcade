// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ScoreboardPanel } from './Scoreboard.panel';
import { createScoreboard } from './Scoreboard.core';

const PLAYERS = [
  { entityId: 'p1', name: 'Alice', color: [1, 0, 0] as [number, number, number] },
  { entityId: 'p2', name: 'Bob', color: [0, 1, 0] as [number, number, number] },
];

describe('ScoreboardPanel', () => {
  it('mounts without a renderer and shows the live overlay with player names', () => {
    const core = createScoreboard({}, PLAYERS);
    core.setScores({ p1: 4, p2: 7 });
    const { container } = render(() => <ScoreboardPanel core={core} />);
    expect(container.textContent).toContain('SCORE');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
    expect(container.textContent).toContain('Appearance');
    expect(container.textContent).toContain('fontSize');
  });

  it('moving the fontSize slider calls core.setParams with the new value', () => {
    const core = createScoreboard({}, PLAYERS);
    const spy = vi.spyOn(core, 'setParams');
    const { getAllByRole } = render(() => <ScoreboardPanel core={core} />);
    const firstSlider = (getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.input(firstSlider, { target: { value: '26' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 26 }));
  });

  it('clicking a +1 row button fires onAddScore with that entity id', () => {
    const core = createScoreboard({}, PLAYERS);
    const onAddScore = vi.fn();
    const { getAllByText } = render(() => (
      <ScoreboardPanel core={core} onAddScore={onAddScore} />
    ));
    const buttons = getAllByText('+1');
    fireEvent.click(buttons[0]);
    expect(onAddScore).toHaveBeenCalledWith('p1', 1);
  });

  it('the Reset button clears core params back to defaults', () => {
    const core = createScoreboard({ fontSize: 30 }, PLAYERS);
    const spy = vi.spyOn(core, 'setParams');
    const { getByText } = render(() => <ScoreboardPanel core={core} />);
    fireEvent.click(getByText(/reset/i));
    expect(spy).toHaveBeenCalled();
  });
});
