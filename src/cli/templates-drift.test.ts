/**
 * Templates drift test — fails if any game-local scene/registry source has
 * diverged from its companion CLI template. Recovery is one command:
 *
 *   cd packages/arcade && npm run sync-templates
 *
 * Shares its projection logic with scripts/sync-templates.js, so running
 * the script is guaranteed to make this test pass.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain-JS sibling, no .d.ts (Node ESM-compatible)
import { PAIRS, inspectPair } from '../../scripts/sync-templates.js'

interface SyncPair {
  label: string
  game: string
  template: string
  renameFrom: string
  renameTo: string
}

describe('CLI templates stay in sync with the live games', () => {
  it('exposes a PAIRS array (sync machinery is wired up)', () => {
    expect(Array.isArray(PAIRS)).toBe(true)
  })
  for (const pair of PAIRS as SyncPair[]) {
    it(`${pair.label} matches ${pair.game}`, () => {
      const r = inspectPair(pair)
      if (r.drift) {
        // Show a tight diff hint without dumping the whole file — vitest
        // already prints the first mismatching character if we use toBe.
        expect(
          r.expected,
          `Template ${pair.template} drifted from ${pair.game}. ` +
          `Run \`npm run sync-templates\` inside packages/arcade to fix.`,
        ).toBe(r.templateSrc)
      } else {
        expect(r.drift).toBe(false)
      }
    })
  }
})
