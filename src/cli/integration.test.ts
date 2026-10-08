/**
 * End-to-end CLI integration: scaffold the arcade and prove the result
 * typechecks against the live @babylonjsmarket/{ecs,arcade} source.
 *
 * NO npm install, NO vite bundle. The scaffolded project's `node_modules`
 * is fabricated by symlinking the monorepo's root `node_modules` and
 * pointing `@babylonjsmarket/{ecs,arcade}` at the workspace source. We
 * then run tsc --noEmit against the scaffold — that follows imports into
 * the live arcade source, so any breaking change (renamed export, missing
 * field, accidental dead variable when `noUnusedLocals` is on) shows up
 * immediately. tsc is the test; vite would just re-bundle @babylonjs/core
 * for no extra signal.
 *
 * Per template:
 *   1. Scaffold via the CLI.
 *   2. Build node_modules from the monorepo via symlinks (vite, solid-js,
 *      @babylonjs/* etc. are already there).
 *   3. Override @babylonjsmarket/{ecs,arcade} with symlinks to the live
 *      local sources so tsc sees the latest .ts files.
 *   4. Run tsc --noEmit. Assert exit code 0.
 *   5. Spot-check the generated dist plan (presence of scene.ts /
 *      registry.ts / main.ts is already covered by the file-shape test).
 *
 * Skip with ARCADE_SKIP_INTEGRATION=1 if you need to bypass temporarily.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ARCADE_ROOT = path.resolve(__dirname, '..', '..')
const ECS_ROOT = path.resolve(ARCADE_ROOT, '..', 'ecs')
const REPO_ROOT = path.resolve(ARCADE_ROOT, '..', '..')
const ROOT_NODE_MODULES = path.join(REPO_ROOT, 'node_modules')
const TSC_BIN = path.join(ROOT_NODE_MODULES, '.bin', 'tsc')
const CLI_PATH = path.join(ARCADE_ROOT, 'dist', 'cli', 'index.js')
// The scaffold downloads the core components into src/components, and main.ts
// imports from them. Copy them from the local CodeLibrary instead of the
// network, the same way index.test.ts does.
const LIBRARY_DIR = path.join(REPO_ROOT, 'CodeLibrary')
const CORE_ENV: Record<string, string> = fs.existsSync(path.join(LIBRARY_DIR, 'Components'))
  ? { ARCADE_CORE_FROM: LIBRARY_DIR }
  : {}

// The scaffolded-project typecheck fabricates node_modules by symlinking the
// monorepo ROOT install — tsc plus the ambient types the scaffold references
// (vite/client for `import.meta.glob`, solid-js, the engine packages, …). If the
// root hasn't been `npm install`ed those can't resolve and tsc fails for reasons
// that have nothing to do with the scaffold, so SKIP the suite (with a warning)
// rather than hard-fail. Run a full root install to exercise it; force-off with
// ARCADE_SKIP_INTEGRATION=1.
const ROOT_INSTALLED =
  fs.existsSync(TSC_BIN) &&
  fs.existsSync(path.join(ROOT_NODE_MODULES, 'vite', 'client.d.ts'))
const SHOULD_RUN = process.env.ARCADE_SKIP_INTEGRATION !== '1' && ROOT_INSTALLED
if (process.env.ARCADE_SKIP_INTEGRATION !== '1' && !ROOT_INSTALLED) {
  console.warn(
    '[integration] skipping scaffold typecheck — monorepo root node_modules is not ' +
      'fully installed (need tsc + vite/client). Run `npm install` at the repo root.',
  )
}

describe.skipIf(!SHOULD_RUN)('CLI integration — scaffolded projects build', () => {
  let scaffoldRoot = ''

  beforeAll(async () => {
    // The CLI lives in dist/ — build it (and ecs, transitively) if missing.
    if (!fs.existsSync(path.join(ECS_ROOT, 'dist'))) {
      await runNpm(['run', 'build'], ECS_ROOT, 120_000)
    }
    if (!fs.existsSync(CLI_PATH)) {
      await runNpm(['run', 'build'], ARCADE_ROOT, 120_000)
    }
    expect(fs.existsSync(CLI_PATH)).toBe(true)
    expect(
      fs.existsSync(TSC_BIN),
      `expected tsc at ${TSC_BIN} — run \`npm install\` at the monorepo root first`,
    ).toBe(true)

    scaffoldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-integration-'))
  }, 240_000)

  afterAll(() => {
    if (scaffoldRoot && fs.existsSync(scaffoldRoot)) {
      fs.rmSync(scaffoldRoot, { recursive: true, force: true })
    }
  })

  it(
    'arcade — scaffolded project typechecks against live arcade source',
    async () => {
      const projectDir = path.join(scaffoldRoot, 'app-arcade')

      // Scaffold.
      const scaffold = await execCli(['app-arcade', '--overwrite'], scaffoldRoot)
      if (scaffold.code !== 0) {
        throw new Error(`scaffold failed:\n${scaffold.stderr}`)
      }

      // Fabricate node_modules from the monorepo root, overriding the two
      // local packages so tsc resolves them to the live workspace source.
      buildNodeModules(projectDir)

      // tsc resolves @babylonjsmarket/{ecs,arcade} through the fabricated
      // node_modules → live source → catches every breaking change a real
      // user would hit on the next `npm install` (including the scene's use
      // of the new textured-material fields on MeshPrimitive).
      const tsc = await runNode([TSC_BIN, '--noEmit'], projectDir, 60_000)
      if (tsc.code !== 0) {
        throw new Error(
          `tsc failed (code ${tsc.code}):\n` +
            `--- stdout ---\n${tsc.stdout}\n--- stderr ---\n${tsc.stderr}`,
        )
      }
    },
    90_000,
  )

  it(
    'arcade --demo — comparison project typechecks (all three adapters)',
    async () => {
      const projectDir = path.join(scaffoldRoot, 'app-demo')

      const scaffold = await execCli(['app-demo', '--demo', '--overwrite'], scaffoldRoot)
      if (scaffold.code !== 0) {
        throw new Error(`scaffold failed:\n${scaffold.stderr}`)
      }

      // Same fabrication: the root node_modules already carries three/@types/three,
      // @babylonjs/lite and @dimforge/rapier3d-compat (ecs's dev/optional deps),
      // so the demo's adapter imports resolve through the live ecs source.
      buildNodeModules(projectDir)

      const tsc = await runNode([TSC_BIN, '--noEmit'], projectDir, 60_000)
      if (tsc.code !== 0) {
        throw new Error(
          `tsc failed (code ${tsc.code}):\n` +
            `--- stdout ---\n${tsc.stdout}\n--- stderr ---\n${tsc.stderr}`,
        )
      }
    },
    90_000,
  )

  for (const renderer of ['three', 'babylon-lite']) {
    it(
      `arcade --renderer ${renderer} — scaffold typechecks against live source`,
      async () => {
        const projectDir = path.join(scaffoldRoot, `app-${renderer}`)
        const scaffold = await execCli(
          [`app-${renderer}`, '--renderer', renderer, '--overwrite'],
          scaffoldRoot,
        )
        if (scaffold.code !== 0) {
          throw new Error(`scaffold failed:\n${scaffold.stderr}`)
        }
        buildNodeModules(projectDir)
        const tsc = await runNode([TSC_BIN, '--noEmit'], projectDir, 60_000)
        if (tsc.code !== 0) {
          throw new Error(
            `tsc failed (code ${tsc.code}):\n` +
              `--- stdout ---\n${tsc.stdout}\n--- stderr ---\n${tsc.stderr}`,
          )
        }
      },
      90_000,
    )
  }
})

/**
 * Symlink the monorepo's root node_modules into the scaffold so tsc and
 * any other dev tool finds vite, solid-js, @babylonjs/*, etc. without an
 * install. Then override @babylonjsmarket/ecs and @babylonjsmarket/arcade
 * with pointers to the live workspace sources.
 */
function buildNodeModules(projectDir: string): void {
  const nm = path.join(projectDir, 'node_modules')
  fs.mkdirSync(nm, { recursive: true })

  // Top-level (non-scoped) deps.
  for (const entry of fs.readdirSync(ROOT_NODE_MODULES)) {
    if (entry.startsWith('@')) continue
    if (entry === '.bin' || entry === '.package-lock.json') continue
    symlinkInto(path.join(ROOT_NODE_MODULES, entry), path.join(nm, entry))
  }
  // .bin
  const rootBin = path.join(ROOT_NODE_MODULES, '.bin')
  if (fs.existsSync(rootBin)) {
    const targetBin = path.join(nm, '.bin')
    fs.mkdirSync(targetBin, { recursive: true })
    for (const entry of fs.readdirSync(rootBin)) {
      symlinkInto(path.join(rootBin, entry), path.join(targetBin, entry))
    }
  }
  // Scoped packages — link each scope dir's children individually so the
  // @babylonjsmarket overrides below can replace specific entries.
  for (const scope of fs.readdirSync(ROOT_NODE_MODULES)) {
    if (!scope.startsWith('@')) continue
    const scopeDir = path.join(nm, scope)
    fs.mkdirSync(scopeDir, { recursive: true })
    for (const pkg of fs.readdirSync(path.join(ROOT_NODE_MODULES, scope))) {
      symlinkInto(path.join(ROOT_NODE_MODULES, scope, pkg), path.join(scopeDir, pkg))
    }
  }
  // Live workspace overrides.
  const marketScope = path.join(nm, '@babylonjsmarket')
  fs.mkdirSync(marketScope, { recursive: true })
  for (const name of ['ecs', 'arcade']) {
    const target = path.join(marketScope, name)
    if (fs.lstatSync(target, { throwIfNoEntry: false })) {
      fs.rmSync(target, { recursive: true, force: true })
    }
  }
  fs.symlinkSync(ECS_ROOT, path.join(marketScope, 'ecs'), 'dir')
  fs.symlinkSync(ARCADE_ROOT, path.join(marketScope, 'arcade'), 'dir')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RunResult {
  stdout: string
  stderr: string
  code: number
}

async function execCli(args: string[], cwd: string): Promise<RunResult> {
  return runNode([CLI_PATH, ...args], cwd, 60_000, CORE_ENV)
}

async function runNode(
  args: string[],
  cwd: string,
  timeoutMs: number,
  extraEnv: Record<string, string> = {},
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd,
      env: { ...process.env, CI: 'true', ...extraEnv },
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs,
    })
    return { stdout, stderr, code: 0 }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: number
    }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: typeof e.code === 'number' ? e.code : 1,
    }
  }
}

async function runNpm(args: string[], cwd: string, timeoutMs: number): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync('npm', args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs,
    })
    return { stdout, stderr, code: 0 }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: number
    }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: typeof e.code === 'number' ? e.code : 1,
    }
  }
}

/** Symlink src → dest, skipping if dest already exists. */
function symlinkInto(src: string, dest: string): void {
  if (fs.existsSync(dest)) return
  const stat = fs.lstatSync(src)
  fs.symlinkSync(src, dest, stat.isDirectory() ? 'dir' : 'file')
}
