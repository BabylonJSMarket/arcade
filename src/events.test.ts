import { describe, it, expect } from 'vitest';
import * as events from './events';
import * as legacy from './events.legacy';
import * as input from './inputEvents';

// The dictionaries are plain data, so the test is that each one is a map of
// event names: every value a non-empty string, and no two keys in a group
// naming the same event.
describe.each([
  ['events', events],
  ['events.legacy', legacy],
  ['inputEvents', input],
])('%s', (_label, mod) => {
  const groups = Object.entries(mod as Record<string, Record<string, unknown>>);

  it('exports at least one group', () => {
    expect(groups.length).toBeGreaterThan(0);
  });

  it.each(groups)('%s maps keys to distinct event-name strings', (_name, group) => {
    const values = Object.values(group);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(typeof v === 'string' && v.length > 0).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
