// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { ScoreboardPanel } from './Scoreboard.panel';
import { createScoreboard } from './Scoreboard.core';

describe('ScoreboardPanel (renderer-free)', () => {
  it('mounts against a stub core and shows the title and rows', () => {
    const core = createScoreboard({ title: 'SCORE' }, [
      { entityId: 'p1', name: 'Alice', color: [1, 0, 0] },
    ]);
    core.setScores({ p1: 12 });
    const { container } = render(() => <ScoreboardPanel core={core} />);
    expect(container.textContent).toContain('SCORE');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('12');
  });

  it('clicking +1 fires onAddScore for that entity', () => {
    const core = createScoreboard({}, [
      { entityId: 'p1', name: 'Alice', color: [1, 0, 0] },
    ]);
    const onAddScore = vi.fn();
    const { getByText } = render(() => (
      <ScoreboardPanel core={core} onAddScore={onAddScore} />
    ));
    fireEvent.click(getByText('+1'));
    expect(onAddScore).toHaveBeenCalledWith('p1', 1);
  });

  it('changing the position select writes through to core.setParams', () => {
    const core = createScoreboard({}, [
      { entityId: 'p1', name: 'Alice', color: [1, 0, 0] },
    ]);
    const spy = vi.spyOn(core, 'setParams');
    const { container } = render(() => <ScoreboardPanel core={core} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'bottom-right' } });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ position: 'bottom-right' }));
  });
});
