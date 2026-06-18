#!/usr/bin/env node
/**
 * try-scaffold — the live companion to `src/cli/integration.test.ts`.
 *
 * The integration test scaffolds the arcade and proves it TYPECHECKS against
 * the live workspace source. This script goes one step further: it scaffolds,
 * wires the project to the local workspace packages, and starts the Vite dev
 * server with `--open` so a browser pops up on the running arcade room — the
 * end-to-end visual check.
 *
 * Why the wiring matters: a fresh scaffold pins the PUBLISHED
 * @babylonjsmarket/{ecs,arcade}. To see local changes (e.g. the new textured
 * floor), the scaffold must resolve those two packages to this checkout. In
 * this monorepo the root `node_modules/@babylonjsmarket/{ecs,arcade}` are
 * already workspace symlinks, so pointing the scaffold's `node_modules` at the
 * repo root resolves every dep — including the local ecs/arcade — with no
 * network install.
 *
 * Usage:
 *   node scripts/try-scaffold.mjs               # scaffold to a temp dir, open browser
 *   node scripts/try-scaffold.mjs --demo        # the 3-adapter comparison demo
 *   node scripts/try-scaffold.mjs --port 5180   # pick the dev-server port
 *   node scripts/try-scaffold.mjs --out <dir>   # scaffold to a specific dir
 *   node scripts/try-scaffold.mjs --no-open     # don't auto-open the browser
 *   node scripts/try-scaffold.mjs --keep        # keep the scaffold dir on exit
 *
 * Ctrl+C stops the server (and removes the temp scaffold unless --keep / --out).
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ARCADE_ROOT = path.resolve(HERE, '..')
const ECS_ROOT = path.resolve(ARCADE_ROOT, '..', 'ecs')
const REPO_ROOT = path.resolve(ARCADE_ROOT, '..', '..')
const ROOT_NODE_MODULES = path.join(REPO_ROOT, 'node_modules')
const CLI_PATH = path.join(ARCADE_ROOT, 'dist', 'cli', 'index.js')

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const opt = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const port = opt('--port', '5180')
const openBrowser = !flag('--no-open')
const explicitOut = opt('--out', null)
const keep = flag('--keep') || !!explicitOut
// --demo scaffolds the multi-adapter comparison instead of the arcade room.
const demo = flag('--demo')

// The CLI derives the package name from the project dir's basename and prompts
// (and, non-interactively, cancels) if it isn't a valid npm name — so the
// project dir MUST be a lowercase token. mkdtemp suffixes are mixed-case, so we
// scaffold into `<tmpParent>/arcade-live` rather than into the temp dir itself.
const tmpParent = explicitOut ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-live-'))
const outDir = explicitOut ? path.resolve(explicitOut) : path.join(tmpParent, 'arcade-live')
// What to remove on exit (the whole temp parent for the default; nothing for --out).
const cleanupDir = explicitOut ? null : tmpParent

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } })
  if (r.status !== 0) {
    console.error(`\n✗ \`${cmd} ${args.join(' ')}\` failed (exit ${r.status}).`)
    process.exit(r.status ?? 1)
  }
}

// ── 1. ensure the CLI + workspace dists exist ────────────────────────────────
if (!fs.existsSync(path.join(ECS_ROOT, 'dist'))) run('npm', ['run', 'build'], ECS_ROOT)
if (!fs.existsSync(CLI_PATH)) run('npm', ['run', 'build'], ARCADE_ROOT)
if (!fs.existsSync(ROOT_NODE_MODULES)) {
  console.error(`✗ ${ROOT_NODE_MODULES} not found — run \`npm install\` at the repo root first.`)
  process.exit(1)
}

// ── 2. scaffold ──────────────────────────────────────────────────────────────
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
console.log(`\n▸ Scaffolding arcade into ${outDir}`)
run(
  process.execPath,
  [CLI_PATH, path.basename(outDir), '--overwrite', ...(demo ? ['--demo'] : [])],
  path.dirname(outDir),
)

// ── 3. wire node_modules to the workspace (resolves local ecs/arcade) ────────
// The root node_modules already symlinks @babylonjsmarket/{ecs,arcade} to this
// checkout, so a single symlink gives the scaffold every dep + our local code.
const scaffoldNm = path.join(outDir, 'node_modules')
fs.rmSync(scaffoldNm, { recursive: true, force: true })
fs.symlinkSync(ROOT_NODE_MODULES, scaffoldNm, 'dir')
console.log('▸ Linked node_modules → repo root (local @babylonjsmarket/{ecs,arcade})')

// ── 4. serve + open the browser ──────────────────────────────────────────────
const viteBin = path.join(ROOT_NODE_MODULES, '.bin', 'vite')
const viteArgs = ['--port', port, '--strictPort']
if (openBrowser) viteArgs.push('--open')
console.log(`▸ Starting Vite on http://localhost:${port}${openBrowser ? ' (opening browser…)' : ''}\n`)

const vite = spawn(viteBin, viteArgs, { cwd: outDir, stdio: 'inherit' })

function cleanup() {
  if (!vite.killed) vite.kill('SIGTERM')
  if (!keep && cleanupDir) fs.rmSync(cleanupDir, { recursive: true, force: true })
}
process.on('SIGINT', () => {
  console.log('\n▸ Stopping…')
  cleanup()
  process.exit(0)
})
vite.on('exit', (code) => {
  cleanup()
  process.exit(code ?? 0)
})
