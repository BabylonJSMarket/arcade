#!/usr/bin/env node
/**
 * sync-templates — copy game-local scene + registry source into the CLI
 * template directory, preserving each template's hand-written header.
 *
 * Usage:
 *   node scripts/sync-templates.js          # apply, write changes to disk
 *   node scripts/sync-templates.js --check  # report-only, exit 1 on drift
 *
 * The companion vitest drift test (src/cli/templates-drift.test.ts) imports
 * `projected` + `PAIRS` from here, so a forgotten sync turns into a failing
 * test before it reaches main.
 *
 * NOTE: the current scaffold (the multigame "arcade room") is authored
 * directly in `packages/arcade/templates/` — there is no game-side source to
 * mirror, so `PAIRS` is empty and this script is a no-op. The machinery is
 * kept for any future template that DOES want to track a live game under
 * `games/src/games/arcade/<game>/{scene,registry}.ts`: add a pair below and
 * the transform projects the game source into the template.
 *
 * When a pair is configured, the live game is the playground (runs in the
 * browser, hot-reload, viz panels) and the template is what the CLI scaffolds
 * into a fresh user project — clean code, prosier comments. The transform is
 * intentionally narrow:
 *
 *   1. drop the first JSDoc block of the game file (the games-side
 *      "loaded by X.tsx" comment isn't useful in a scaffolded project);
 *   2. preserve the template's own JSDoc header (the user-facing prose
 *      with key hints like "Press `4` for the builder");
 *   3. rename the game-specific export ({GAME}_SCENE / {GAME}_REGISTRY)
 *      to the generic SCENE / REGISTRY the scaffolded project expects.
 *
 * Nothing else is touched, so any change to the body — entity layout,
 * component params, scoring — flows verbatim.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.resolve(HERE, '..')
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..')

export const PAIRS = []

// Match a /** ... */ at the very start of the file, plus any trailing blank
// lines. Lazy so we only strip the FIRST block — later JSDoc on entities
// stays intact.
const LEADING_JSDOC_RE = /^\/\*\*[\s\S]*?\*\/\s*\n+/

export function leadingJsdoc(src) {
  const m = src.match(LEADING_JSDOC_RE)
  return m ? m[0] : ''
}

export function bodyAfterJsdoc(src) {
  return src.replace(LEADING_JSDOC_RE, '')
}

// Optional strip markers — let game-only blocks (e.g. game-local viz panels
// that don't exist in the scaffolded template) live in the source file
// without leaking into the template. Two flavors:
//
//   1. `// @sync-skip` at end of a line → drop that line.
//   2. `// @sync-skip-begin` ... `// @sync-skip-end` → drop the block
//      (markers included). Useful for multi-line entries like imports or
//      a single-line object property.
//
// We strip BEFORE the rename + body splicing so the markers don't escape
// into the template.
const SKIP_BLOCK_RE = /^[ \t]*\/\/[ \t]*@sync-skip-begin[\s\S]*?\/\/[ \t]*@sync-skip-end[ \t]*\n?/gm
const SKIP_LINE_RE = /^.*\/\/[ \t]*@sync-skip[ \t]*$\n?/gm

export function stripSyncMarkers(src) {
  return src.replace(SKIP_BLOCK_RE, '').replace(SKIP_LINE_RE, '')
}

/**
 * Produce what the template file SHOULD contain, given the live game file
 * and the template's current contents (we keep the template's header).
 */
export function projected(gameSrc, templateSrc, renameFrom, renameTo) {
  const header = leadingJsdoc(templateSrc)
  const stripped = stripSyncMarkers(gameSrc)
  const body = bodyAfterJsdoc(stripped).replace(
    new RegExp(`\\bexport const ${renameFrom}\\b`),
    `export const ${renameTo}`,
  )
  return header + body
}

/**
 * Read a pair, return { gameSrc, templateSrc, expected, drift }. Throws if
 * either file is missing — that's a configuration bug, not drift.
 */
export function inspectPair(pair, repoRoot = REPO_ROOT) {
  const gamePath = path.join(repoRoot, pair.game)
  const templatePath = path.join(repoRoot, pair.template)
  const gameSrc = fs.readFileSync(gamePath, 'utf8')
  const templateSrc = fs.readFileSync(templatePath, 'utf8')
  const expected = projected(gameSrc, templateSrc, pair.renameFrom, pair.renameTo)
  return {
    gamePath,
    templatePath,
    gameSrc,
    templateSrc,
    expected,
    drift: expected !== templateSrc,
  }
}

function main() {
  const check = process.argv.includes('--check')
  const drifted = []
  const synced = []

  for (const pair of PAIRS) {
    const r = inspectPair(pair)
    if (!r.drift) {
      console.log(`  ✓  ${pair.label} (in sync)`)
      continue
    }
    if (check) {
      drifted.push(pair.label)
      console.log(`  ✗  ${pair.label} — template differs from game source`)
    } else {
      fs.writeFileSync(r.templatePath, r.expected)
      synced.push(pair.label)
      console.log(`  →  ${pair.label} (wrote ${path.relative(REPO_ROOT, r.templatePath)})`)
    }
  }

  if (check && drifted.length) {
    console.error(
      `\n${drifted.length} template(s) drifted from their game source. ` +
      `Run \`npm run sync-templates\` inside packages/arcade to fix.`,
    )
    process.exit(1)
  }
  if (!check) {
    console.log(`\n${synced.length} updated, ${PAIRS.length - synced.length} already in sync.`)
  }
}

// Only run when invoked directly (not when imported by the drift test).
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  main()
}
