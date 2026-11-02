#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mri from "mri";
import * as prompts from "@clack/prompts";
import { coreApiUrl, installCore, type InstallCoreResult } from "./core.js";


// Templates live as real .ts files under packages/arcade/templates/. We
// resolve to them via import.meta.url so the CLI works whether it's run
// from a built tarball (dist/cli/index.js) or in-tree dev mode.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(HERE, "..", "..", "templates");
const SKILL_PAYLOAD_DIR = path.resolve(
  HERE,
  "..",
  "..",
  ".claude-payload",
  "skills",
  "babylonjsmarket",
);

function readTemplate(file: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf8");
}

// ── Dependency versions for the scaffold ────────────────────────────────────
// Never hardcode these — pinned literals silently drift out of sync with what's
// actually published every release. Instead resolve them live: arcade from our
// OWN package.json (this CLI ships inside @babylonjsmarket/arcade), and ecs /
// eslint-plugin from whatever is installed alongside us. So a fresh scaffold
// always pins the matching published set, with zero manual upkeep.
/**
 * Find `<name>`'s installed version by walking `node_modules` up from HERE.
 * A filesystem lookup (not `require.resolve`) so it works regardless of the
 * package's `exports` conditions — ecs/arcade ship import-only `exports`, which
 * makes CJS `require.resolve` throw. Returns `fallback` if not installed (e.g.
 * eslint-plugin is arcade's devDep, absent when arcade is consumed via npx).
 */
function installedVersion(name: string, fallback: string): string {
  const segs = name.split("/");
  let dir = HERE;
  for (;;) {
    const pj = path.join(dir, "node_modules", ...segs, "package.json");
    if (fs.existsSync(pj)) {
      try {
        const v = (JSON.parse(fs.readFileSync(pj, "utf8")) as { version?: string }).version;
        if (v) return v;
      } catch {
        /* malformed — keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return fallback;
    dir = parent;
  }
}

/** `^x.y.z` for a concrete version; pass `latest` through verbatim. */
const range = (v: string): string => (v === "latest" ? "latest" : `^${v}`);

const ARCADE_VERSION = (
  JSON.parse(
    fs.readFileSync(path.resolve(HERE, "..", "..", "package.json"), "utf8"),
  ) as { version: string }
).version;
const ECS_VERSION = installedVersion("@babylonjsmarket/ecs", "latest");
const ESLINT_PLUGIN_VERSION = installedVersion("@babylonjsmarket/eslint-plugin", "latest");
// The scaffold's main.ts boots `@babylonjsmarket/arcade/viz`, which re-exports
// @babylonjsmarket/viz and every component .viz panel — so viz must be a real
// dependency, not just arcade's optional peer (otherwise Vite stubs it and the
// panel imports, e.g. `ResetButton`, fail at load).
const VIZ_VERSION = installedVersion("@babylonjsmarket/viz", "latest");

// ── Renderer / physics pairings ─────────────────────────────────────────────
// The scaffold targets ONE engine for the whole arcade — every game (scene)
// runs on the same adapter, the renderer-agnostic point of the framework. The
// chosen adapter is wired into src/main.ts; its engine packages go in
// package.json + vite.config. (Three loads from a CDN import map because its
// adapter dynamic-imports `three` past Vite, so only its types are installed.)
interface RendererConfig {
  label: string;
  adapter: string; // exported adapter class
  import: string; // @babylonjsmarket/ecs subpath the adapter is exported from
  deps: Record<string, string>;
  devDeps?: Record<string, string>;
  /** Extra packages to dedupe + exclude from Vite optimize (WASM / WebGPU). */
  viteExtras?: string[];
  /** Three's adapter loads `three` via a CDN import map (it bypasses Vite). */
  needsThreeImportmap?: boolean;
}
const RENDERERS: Record<string, RendererConfig> = {
  babylon: {
    label: "Babylon.js (Classic) + Havok physics",
    adapter: "BabylonAdapter",
    import: "@babylonjsmarket/ecs/babylon",
    deps: { "@babylonjs/core": "^9.33.1", "@babylonjs/loaders": "^9.33.1", "@babylonjs/havok": "^1.3.14" },
  },
  "babylon-lite": {
    label: "Babylon Lite + Havok physics (WebGPU)",
    adapter: "BabylonLiteAdapter",
    import: "@babylonjsmarket/ecs/babylon-lite",
    deps: { "@babylonjs/lite": "^1.37.2", "@babylonjs/havok": "^1.3.14" },
    viteExtras: ["@babylonjs/lite"],
  },
  three: {
    label: "Three.js + Rapier physics",
    adapter: "ThreeAdapter",
    import: "@babylonjsmarket/ecs/three",
    deps: { "@dimforge/rapier3d-compat": "^0.19.3" },
    devDeps: { "@types/three": "^0.187.0" },
    viteExtras: ["@dimforge/rapier3d-compat"],
    needsThreeImportmap: true,
  },
};
const RENDERER_KEYS = Object.keys(RENDERERS);

// What to scaffold. `arcade` (default) = the walk-up room + cabinets multigame
// seam; `game` = a single starter scene (no room). The --demo path overrides
// both with the 3-adapter comparison.
const KINDS = {
  arcade: "Arcade — a walk-up room with cabinets that launch many games",
  game: "Game — a single starter scene",
} as const;
const KIND_KEYS = Object.keys(KINDS);

// Allow `arcade init <name>` as well as the npm-create-style bare `arcade <name>`.
// We strip a leading "init" subcommand here so positional parsing stays simple.
const rawArgs = process.argv.slice(2);
const argsAfterSubcommand =
  rawArgs[0] === "init" ? rawArgs.slice(1) : rawArgs;

const argv = mri<{
  help?: boolean;
  overwrite?: boolean;
  demo?: boolean;
  renderer?: string;
  kind?: string;
  newProject?: boolean;
  "new-project"?: boolean;
  core?: boolean;
  "core-from"?: string;
}>(argsAfterSubcommand, {
  alias: { h: "help" },
  boolean: ["help", "overwrite", "demo", "new-project", "core"],
  string: ["renderer", "kind", "core-from"],
  default: { core: true },
});

/**
 * Where the core set comes from: `--core-from <dir>` (a CodeLibrary checkout),
 * else `ARCADE_CORE_FROM`, else the site. The env form is how the monorepo's
 * own tests scaffold without the network.
 */
function coreFrom(): string | undefined {
  const flag = argv["core-from"];
  if (typeof flag === "string" && flag) return flag;
  return process.env.ARCADE_CORE_FROM || undefined;
}

/** One line per outcome, and the exact next step when it failed. */
function reportCore(r: InstallCoreResult): void {
  if (r.ok) {
    prompts.log.step(
      `Added ${r.components.length} core components to src/components (free, from ${r.source})`,
    );
    if (r.missing.length) {
      prompts.log.warn(`Not in the core set, skipped: ${r.missing.join(", ")}`);
    }
    return;
  }
  prompts.log.warn(
    `Could not download the core components (${r.error}).\n` +
      "The project needs them to run. After `npm install`, run this in the project:\n" +
      "  npx arcade core",
  );
}
const cwd = process.cwd();

const helpMessage = `\
Usage: arcade init [OPTION]... [DIRECTORY]
   or: npm create @babylonjsmarket/arcade [DIRECTORY]

Create a new data-driven BabylonJS game (or multigame arcade) powered by
@babylonjsmarket/ecs and @babylonjsmarket/arcade.

Pick a KIND: a single "game" (one starter scene) or a multigame "arcade" (a
walk-up "arcade room" — a carpeted room with a row of cabinets — whose cabinets
launch each game). An arcade is just the same data-driven idea at scale: many
game scenes sharing one code library. Either way, scenes are TS modules under
src/scenes/ that declare entities + their components by name. Every component
lives in src/components/: the free core set (meshes, lights, cameras, input,
physics, scoring, …) is downloaded there when the project is created, and
src/registry.ts picks up everything in that folder.

With no arguments, start the CLI in interactive mode.

Options:
  -h, --help                 print this help message
      --overwrite            replace any existing files in the target directory
      --kind <kind>          what to scaffold — one of: arcade (multigame room +
                             cabinets, default), game (a single starter scene).
                             Omit to pick interactively.
      --renderer <engine>    renderer + physics for the whole project — one of:
                             babylon (Babylon.js + Havok, default), babylon-lite
                             (Babylon Lite + Havok, WebGPU), three (Three.js +
                             Rapier). Omit to pick interactively.
      --demo                 scaffold the renderer-adapter comparison demo: one
                             scene rendered side-by-side by the Babylon, Three
                             and Babylon Lite adapters (instead of a game/arcade)
      --new-project          force a brand-new project even when run INSIDE an
                             existing arcade (where the default is to add a game
                             to it)
      --no-core              don't download the core components into
                             src/components (fetch them later with
                             npx arcade core)
      --core-from <dir>      copy the core components from a local library
                             checkout (a CodeLibrary folder) instead of
                             downloading them

Also:
  arcade core [DIRECTORY]    download the core components into an existing
                             project's src/components (fills in missing files,
                             never overwrites). Same --core-from option.

Run inside an existing arcade, this ADDS A GAME to it rather than scaffolding a
new project: a scene JSON under public/games/<name>/, a code seam under
src/games/<name>/, an entry in src/games/index.ts, and the first free cabinet
in the arcade room pointed at it. Components and assets stay shared, so every
game draws on the same downloaded pool.`;

const defaultTargetDir = "babylonjs-arcade";

/**
 * True if `dir` is an existing create-arcade ARCADE project — a package.json
 * that depends on @babylonjsmarket/arcade, next to the arcade room scene.
 *
 * Both halves matter: the dependency alone also matches a single-game scaffold
 * (which has no cabinets to point at), and the scene alone could be any folder.
 */
function isArcadeProject(dir: string): boolean {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps["@babylonjsmarket/arcade"]) return false;
  } catch {
    return false;
  }
  return fs.existsSync(path.join(dir, "src", "scenes", "arcade-room.ts"));
}

/** `my-cool-game` → `My Cool Game`, for the cabinet marquee / HUD title. */
function titleCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Add a game to the arcade we're standing in, rather than scaffolding a new
 * project. Writes the scene JSON + code seam, registers it, and points the
 * first cabinet that doesn't already front a game at it.
 */
function addGameToArcade(root: string, rawName: string): void {
  const name = formatTargetDir(rawName);
  const title = titleCase(name);
  const sceneDir = path.join(root, "public", "games", name);
  const codeDir = path.join(root, "src", "games", name);
  const registryPath = path.join(root, "src", "games", "index.ts");

  if (fs.existsSync(sceneDir) || fs.existsSync(codeDir)) {
    prompts.log.error(
      `A game called "${name}" already exists in this arcade. Pick another name, or delete public/games/${name} and src/games/${name}.`,
    );
    process.exitCode = 1;
    return;
  }

  const fill = (tpl: string) => tpl.replace(/__NAME__/g, name).replace(/__TITLE__/g, title);

  fs.mkdirSync(sceneDir, { recursive: true });
  fs.writeFileSync(path.join(sceneDir, "scene.json"), fill(readTemplate("game.scene.json")));
  fs.mkdirSync(codeDir, { recursive: true });
  fs.writeFileSync(path.join(codeDir, "index.ts"), fill(readTemplate("game-entry.ts")));

  // The registry may not exist yet in an arcade scaffolded before games were a
  // thing — lay down the template first so there is always something to edit.
  if (!fs.existsSync(registryPath)) {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, readTemplate("games-index.ts"));
  }
  const registered = registerGame(registryPath, name, title);
  const wired = wireFreeCabinet(path.join(root, "src", "scenes", "arcade-room.ts"), name);

  prompts.log.success(`Added game "${name}" to this arcade.`);
  const lines = [
    `  public/games/${name}/scene.json   the entities — edit + reload, no rebuild`,
    `  src/games/${name}/index.ts        this game's Systems, when it needs any`,
    registered
      ? `  src/games/index.ts               registered as "${name}"`
      : `  src/games/index.ts               COULD NOT auto-register — add the entry by hand`,
    wired
      ? `  src/scenes/arcade-room.ts        cabinet "${wired}" now launches it`
      : `  src/scenes/arcade-room.ts        no free cabinet found — pass the game name to a cabinet(...) call`,
  ];
  prompts.note(lines.join("\n"), "Files");
  prompts.outro(
    `Run \`npm run dev\`, walk up to the cabinet, and double-click it — or open /games/${name}/ directly.`,
  );
}

/**
 * Insert a GAMES entry into src/games/index.ts. Returns false if the file
 * doesn't look like the template we know how to edit, so the caller can tell
 * the user to do it by hand instead of silently doing nothing.
 */
function registerGame(registryPath: string, name: string, title: string): boolean {
  let src: string;
  try {
    src = fs.readFileSync(registryPath, "utf8");
  } catch {
    return false;
  }
  if (src.includes(`'${name}':`) || src.includes(`"${name}":`)) return true; // already there
  const marker = "export const GAMES: Record<string, ArcadeGameEntry> = {";
  const at = src.indexOf(marker);
  if (at === -1) return false;
  const insertAt = at + marker.length;
  const entry = `\n  '${name}': { name: '${name}', title: '${title}', sceneUrl: '/games/${name}/scene.json' },`;
  fs.writeFileSync(registryPath, src.slice(0, insertAt) + entry + src.slice(insertAt));
  return true;
}

/**
 * Point the first cabinet that doesn't already front a game at `name`, by
 * adding the third argument to its `cabinet(x, skin)` call. Returns the skin of
 * the cabinet claimed, or null if every cabinet is taken / the file was edited
 * past recognition.
 */
function wireFreeCabinet(scenePath: string, name: string): string | null {
  let src: string;
  try {
    src = fs.readFileSync(scenePath, "utf8");
  } catch {
    return null;
  }
  // `Cabinet_3: cabinet(0, 'donkey-kong'),` — two args means no game yet.
  const free = /(cabinet\(\s*-?[\d.]+\s*,\s*'([a-z0-9-]+)'\s*)\)/;
  const m = free.exec(src);
  if (!m) return null;
  fs.writeFileSync(scenePath, src.replace(free, `$1, '${name}')`));
  return m[2];
}

async function init() {
  const argTargetDir = argv._[0]
    ? formatTargetDir(String(argv._[0]))
    : undefined;
  const argOverwrite = argv.overwrite;
  // `--demo` scaffolds the multi-adapter comparison instead of the arcade room.
  const demo = !!argv.demo;

  const help = argv.help;
  if (help) {
    console.log(helpMessage);
    return;
  }

  // Standing inside an arcade already? Then "create" means ADD A GAME TO IT —
  // same folder, same components, same downloaded assets — not a nested second
  // project. `--new-project` opts back out. (`--demo` is its own thing, and a
  // fresh scaffold into a subdirectory that isn't this arcade still works: we
  // only take this path when no directory argument was given, or it names the
  // arcade itself.)
  const inArcade = !demo && !argv["new-project"] && isArcadeProject(cwd);
  const targetIsElsewhere =
    argTargetDir !== undefined &&
    path.resolve(cwd, argTargetDir) !== path.resolve(cwd) &&
    fs.existsSync(path.resolve(cwd, argTargetDir));
  if (inArcade && !targetIsElsewhere) {
    let gameName = argTargetDir;
    if (!gameName) {
      const answer = await prompts.text({
        message: "Name for the new game in this arcade:",
        placeholder: "my-game",
        validate: (v) => (v && v.trim() ? undefined : "Give the game a name"),
      });
      if (prompts.isCancel(answer)) return prompts.cancel("Operation cancelled");
      gameName = formatTargetDir(answer as string);
    }
    prompts.intro(`Adding a game to the arcade in ${cwd}`);
    addGameToArcade(cwd, gameName);
    return;
  }

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent);
  const cancel = () => prompts.cancel("Operation cancelled");

  // 1. Get project name and target dir
  let targetDir = argTargetDir;
  if (!targetDir) {
    const projectName = await prompts.text({
      message: "Project name:",
      defaultValue: defaultTargetDir,
      placeholder: defaultTargetDir,
    });
    if (prompts.isCancel(projectName)) return cancel();
    targetDir = formatTargetDir(projectName as string);
  }

  // 2. Handle directory if exist and not empty
  if (fs.existsSync(targetDir) && !isEmpty(targetDir)) {
    const overwrite = argOverwrite
      ? "yes"
      : await prompts.select({
          message:
            (targetDir === "."
              ? "Current directory"
              : `Target directory "${targetDir}"`) +
            ` is not empty. Please choose how to proceed:`,
          options: [
            { label: "Cancel operation", value: "no" },
            { label: "Remove existing files and continue", value: "yes" },
            { label: "Ignore files and continue", value: "ignore" },
          ],
        });
    if (prompts.isCancel(overwrite)) return cancel();
    switch (overwrite) {
      case "yes":
        emptyDir(targetDir);
        break;
      case "no":
        cancel();
        return;
    }
  }

  // 3. Get package name
  let packageName = path.basename(path.resolve(targetDir));
  if (!isValidPackageName(packageName)) {
    const packageNameResult = await prompts.text({
      message: "Package name:",
      defaultValue: toValidPackageName(packageName),
      placeholder: toValidPackageName(packageName),
      validate(dir) {
        if (!isValidPackageName(dir)) {
          return "Invalid package.json name";
        }
      },
    });
    if (prompts.isCancel(packageNameResult)) return cancel();
    packageName = packageNameResult;
  }

  // 4. Choose the renderer + physics (one engine for the whole arcade). The
  // demo scaffold runs all three adapters, so it skips this. Honor --renderer
  // when given; otherwise prompt interactively; default to Babylon in CI / when
  // a prompt isn't available.
  let renderer = "babylon";
  if (!demo) {
    const flag = typeof argv.renderer === "string" ? argv.renderer : undefined;
    if (flag) {
      if (!RENDERER_KEYS.includes(flag)) {
        prompts.log.error(
          `Unknown --renderer "${flag}". Choose one of: ${RENDERER_KEYS.join(", ")}.`,
        );
        process.exitCode = 1;
        return;
      }
      renderer = flag;
    } else if (!process.env.CI) {
      const choice = await prompts.select({
        message: "Renderer & physics (used by every game in the arcade):",
        options: RENDERER_KEYS.map((k) => ({ label: RENDERERS[k].label, value: k })),
        initialValue: "babylon",
      });
      if (prompts.isCancel(choice)) return cancel();
      renderer = choice as string;
    }
  }
  const rc = RENDERERS[renderer];

  // 5. Choose the KIND — a single game or a multigame arcade. The demo overrides
  // both. Honor --kind when given; otherwise prompt; default to arcade in CI /
  // when a prompt isn't available (preserving `npm create arcade`'s behavior).
  let kind = "arcade";
  if (!demo) {
    const kindFlag = typeof argv.kind === "string" ? argv.kind : undefined;
    if (kindFlag) {
      if (!KIND_KEYS.includes(kindFlag)) {
        prompts.log.error(
          `Unknown --kind "${kindFlag}". Choose one of: ${KIND_KEYS.join(", ")}.`,
        );
        process.exitCode = 1;
        return;
      }
      kind = kindFlag;
    } else if (!process.env.CI) {
      const choice = await prompts.select({
        message: "What do you want to scaffold?",
        options: KIND_KEYS.map((k) => ({ label: KINDS[k as keyof typeof KINDS], value: k })),
        initialValue: "arcade",
      });
      if (prompts.isCancel(choice)) return cancel();
      kind = choice as string;
    }
  }

  const root = path.isAbsolute(targetDir) ? targetDir : path.join(cwd, targetDir);
  fs.mkdirSync(root, { recursive: true });
  const pkgManager = pkgInfo ? pkgInfo.name : "npm";

  prompts.log.step(`Scaffolding project in ${root}...`);

  // Generate project structure
  const write = (file: string, content: string) => {
    const targetPath = path.join(root, file);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, content);
  };

  // Engine packages: the demo boots all three adapters; a normal scaffold pulls
  // only the chosen renderer's engine set. (Three itself loads from a CDN import
  // map — only its types are installed locally.)
  const engineDeps = demo
    ? {
        "@babylonjs/core": "^9.33.1",
        "@babylonjs/loaders": "^9.33.1",
        "@babylonjs/havok": "^1.3.14",
        "@babylonjs/lite": "^1.37.2",
        "@dimforge/rapier3d-compat": "^0.19.3",
      }
    : rc.deps;
  const engineDevDeps = demo ? { "@types/three": "^0.187.0" } : (rc.devDeps ?? {});
  // The core components arrive as source in src/components, with their adapter
  // plugins (src/components/<Name>/adapter/). main.ts imports every
  // register.ts on every renderer; each registrar checks `adapter.kind` FIRST
  // and only then dynamic-imports its engine half (`await import('./X.babylon')`),
  // so a Three or Lite game never loads Babylon at runtime. But Vite still has
  // to resolve and build those lazy chunks, so their imports must be
  // INSTALLED everywhere: earcut (NeonSign's extruded text) always, and
  // @babylonjs/core on the renderers that don't already depend on it. On
  // Three/Lite that dependency is install-only: it ends up in a lazy chunk
  // that is never fetched, never in the main bundle.
  const coreDeps: Record<string, string> = {
    earcut: "^3.2.3",
    ...("@babylonjs/core" in engineDeps ? {} : { "@babylonjs/core": "^9.33.1" }),
  };

  // package.json — templates differ only in scene data + the chosen adapter.
  const pkg = {
    name: packageName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      test: "vitest run",
      lint: "eslint src",
    },
    dependencies: {
      "@babylonjsmarket/ecs": range(ECS_VERSION),
      "@babylonjsmarket/arcade": range(ARCADE_VERSION),
      "@babylonjsmarket/viz": range(VIZ_VERSION),
      ...engineDeps,
      ...coreDeps,
    },
    devDependencies: {
      // typescript stays on 6.0.x: @typescript-eslint/parser 8 declares
      // `typescript <6.1.0` as its peer, so ~6.0 is the newest that installs
      // clean. vite 8 needs vite-plugin-solid >= 2.11.11 (its first release
      // with ^8 in the peer range). vitest stays on 4: 5.x declares
      // node "^22.12.0 || ^24.0.0 || >=26.0.0", so npm warns EBADENGINE on
      // Node 25; 4.1 takes ">=24" and vite ^8.
      typescript: "~6.0.3",
      vite: "^8.3.0",
      vitest: "^4.1.11",
      "vite-plugin-solid": "^2.11.14",
      "solid-js": "^1.9.0",
      eslint: "^10.0.0",
      "@typescript-eslint/parser": "^8.70.0",
      "@babylonjsmarket/eslint-plugin": range(ESLINT_PLUGIN_VERSION),
      ...engineDevDeps,
    },
  };
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  // vite.config.js — the Solid plugin must process the arcade viz/panel
  // .tsx files (they live in node_modules), and arcade has to be EXCLUDED
  // from optimizeDeps so esbuild doesn't pre-bundle them with the default
  // React JSX transform before solid sees them.
  //
  // build.target: 'esnext' opts the bundler into top-level await (our main.ts
  // uses `await game.init(canvas)` directly). Without this, the default
  // browser baseline rejects TLA at bundle time. (Vite 8 transforms with oxc,
  // not esbuild, so the old `esbuild: { target }` line is gone — Vite 8 warns
  // "Both esbuild and oxc options were set" and ignores it.)
  //
  // test: the @babylonjsmarket packages are inlined because their dist uses
  // extensionless relative imports (`./ArcadeGame`), which Node's own ESM
  // loader can't resolve. `environment: 'node'` is required: without it
  // vite-plugin-solid defaults vitest to jsdom, which the scaffold does not
  // install, and `npm test` exits 1 with "MISSING DEPENDENCY jsdom".
  //
  // Rapier (WASM) and Babylon Lite (WebGPU shader assets) get the same
  // dedupe + optimize-exclude treatment as havok. (Three itself is CDN-loaded
  // via the import map, so it stays out of Vite's graph.) The demo pulls both;
  // a normal scaffold pulls just its renderer's extras.
  const viteExtras = demo ? ["@dimforge/rapier3d-compat", "@babylonjs/lite"] : (rc.viteExtras ?? []);
  const demoDedupe = viteExtras.map((p) => `\n      '${p}',`).join("");
  const demoExclude = viteExtras.map((p) => `, '${p}'`).join("");
  // Three: ecs is excluded too, and Babylon is not pre-bundled. Vite 8's
  // pre-bundle turns ThreeAdapter's @vite-ignore imports into literal
  // `three/addons/...` imports, which fail to resolve (Three comes from the CDN
  // import map, not node_modules).
  const isThree = renderer === "three" && !demo;
  const ecsExclude = isThree ? ", '@babylonjsmarket/ecs'" : "";
  const includeLine = isThree ? "" : "\n    include: ['@babylonjs/core', '@babylonjs/loaders']";
  write(
    "vite.config.js",
    `import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid({ include: /\\.(jsx|tsx)$/ })],
  server: { port: 3000 },
  build: { target: 'esnext' },
  test: {
    environment: 'node',
    server: { deps: { inline: [/@babylonjsmarket\\//] } },
  },
  // Force ONE copy of the engine packages. When the framework packages are
  // linked from a workspace (file: deps), the app and the linked packages can
  // otherwise each resolve their own @babylonjs/core — two Babylon instances in
  // one bundle hard-crash physics/rendering (e.g. pinball + Havok hangs the tab).
  resolve: {
    dedupe: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/havok',
      '@babylonjsmarket/ecs',
      '@babylonjsmarket/arcade',
      '@babylonjsmarket/viz',${demoDedupe}
    ],
  },
  optimizeDeps: {
    // arcade + viz excluded so esbuild doesn't pre-bundle their Solid .tsx with
    // the default React JSX transform — that throws "React is not defined" at
    // runtime (viz ships raw .tsx source). havok excluded so Vite doesn't
    // rewrite its wasm URL.
    exclude: ['@babylonjsmarket/arcade', '@babylonjsmarket/viz', '@babylonjs/havok'${demoExclude}${ecsExclude}],${includeLine}
  }
});
`,
  );

  // Flat ESLint config enforcing the @babylonjsmarket/ecs framework
  // conventions (the same rules the babylonjsmarket skill documents).
  write(
    "eslint.config.js",
    `import bjsm from '@babylonjsmarket/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist'] },
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  ...bjsm.configs.recommended,
];
`,
  );

  // Tests stay out of `tsc`, and so out of `npm run build`: vitest runs them
  // without a type check either way, and the ones `bjs download` brings with a
  // component import test-only packages (@solidjs/testing-library, node's
  // types) a game never installs. Without the exclude, the first download
  // turns `npm run build` red before Vite runs.
  write(
    "tsconfig.json",
    `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
`,
  );

  // Vite ambient types — pulls in `import.meta.glob` / `import.meta.env` typing
  // used by src/registry.ts (it auto-discovers downloaded components via a glob).
  write("src/vite-env.d.ts", `/// <reference types="vite/client" />\n`);

  if (demo) {
    // Three labelled panes. The import map points the Three adapter's runtime
    // `import('three')` at a CDN (it uses a non-literal @vite-ignore import that
    // bypasses Vite); Babylon, Babylon Lite and Rapier resolve from node_modules
    // through Vite as usual, so they stay out of the map.
    write(
      "index.html",
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${packageName} — adapter comparison</title>
    <script type="importmap">
    {
      "imports": {
        "three": "https://esm.sh/three@0.187.0",
        "three/addons/": "https://esm.sh/three@0.187.0/examples/jsm/"
      }
    }
    </script>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; background: #0b0e14; color: #e6e6e6;
        font: 14px/1.4 system-ui, sans-serif; }
      .grid { display: flex; gap: 1px; height: 100vh; background: #1d2430; }
      .pane { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;
        background: #0b0e14; position: relative; }
      .pane h2 { margin: 0; padding: 8px 12px; font-size: 13px; font-weight: 600;
        display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #1d2430; }
      .pane h2 .fps { margin-left: auto; font-weight: 600; color: #3ddc84;
        font-variant-numeric: tabular-nums; }
      .pane h2 .tag { font-weight: 400; font-size: 11px; color: #8b97a7; }
      canvas { flex: 1 1 auto; width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
      .status { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 12px;
        font-size: 11px; color: #8b97a7; background: rgba(11,14,20,.7); border-top: 1px solid #1d2430; }
      .status.error { color: #ff8c8c; }
    </style>
  </head>
  <body>
    <div class="grid">
      <div class="pane">
        <h2>Babylon <span class="tag">Havok</span><span class="fps" id="fps-babylon">— fps</span></h2>
        <canvas id="cv-babylon"></canvas>
        <div class="status" id="st-babylon">starting…</div>
      </div>
      <div class="pane">
        <h2>Three.js <span class="tag">Rapier</span><span class="fps" id="fps-three">— fps</span></h2>
        <canvas id="cv-three"></canvas>
        <div class="status" id="st-three">starting…</div>
      </div>
      <div class="pane">
        <h2>Babylon Lite <span class="tag">WebGPU · Havok</span><span class="fps" id="fps-lite">— fps</span></h2>
        <canvas id="cv-lite"></canvas>
        <div class="status" id="st-lite">starting…</div>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    );
  } else {
    // The Three renderer's adapter dynamic-imports `three` past Vite, so it
    // resolves through a CDN import map; Babylon / Babylon Lite need none.
    const threeImportmap = rc.needsThreeImportmap
      ? `    <script type="importmap">
    {
      "imports": {
        "three": "https://esm.sh/three@0.187.0",
        "three/addons/": "https://esm.sh/three@0.187.0/examples/jsm/"
      }
    }
    </script>
`
      : "";
    write(
      "index.html",
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${packageName}</title>
${threeImportmap}    <style>
      body { margin: 0; padding: 0; overflow: hidden; width: 100vw; height: 100vh; }
      #renderCanvas { width: 100%; height: 100%; touch-action: none; display: block; }
    </style>
  </head>
  <body>
    <canvas id="renderCanvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    );
  }

  // Tiny boot — imports the scene map + REGISTRY and starts the game(s). The
  // demo boot spins up one ArcadeGame per adapter into three canvases; the
  // normal boot runs a single Babylon game. Both load pure-data scenes whose
  // component names resolve through src/registry.ts (the src/components/ glob).
  if (demo) {
    write("src/main.ts", readTemplate("demo-main.ts"));
    write("src/scenes/index.ts", readTemplate("demo-scenes-index.ts"));
    write("src/scenes/compare.ts", readTemplate("demo-compare.scene.ts"));
  } else {
    // The starter main.ts is authored for Babylon; for the other renderers swap
    // the adapter import + constructor (the only renderer-specific lines).
    let mainTs = readTemplate("main.ts");
    if (renderer !== "babylon") {
      mainTs = mainTs
        .replace(
          "import { BabylonAdapter } from '@babylonjsmarket/ecs/babylon'",
          `import { ${rc.adapter} } from '${rc.import}'`,
        )
        .replace("new BabylonAdapter()", `new ${rc.adapter}()`);
      // The adapter lines are the only renderer-specific part now: plugins come
      // from the downloaded components' adapter/register.ts files, which each
      // check adapter.kind. A template edit that brings back a Babylon-only
      // import must fail the scaffold here, loudly.
      const leftover = mainTs.match(/BabylonAdapter|registerArcadePlugins|@babylonjsmarket\/arcade\/babylon/);
      if (leftover) {
        throw new Error(
          `create-arcade: Babylon-only reference "${leftover[0]}" survived the ${renderer} ` +
            "swap in templates/main.ts — extend the swap in src/cli/index.ts.",
        );
      }
    }
    write("src/main.ts", mainTs);
    // The scene set differs by kind: a single game ships one starter scene; an
    // arcade ships the walk-up room + cabinets (the multigame seam).
    if (kind === "game") {
      write("src/scenes/index.ts", readTemplate("game-scenes-index.ts"));
      write("src/scenes/game.ts", readTemplate("game.scene.ts"));
    } else {
      write("src/scenes/index.ts", readTemplate("scenes-index.ts"));
      write("src/scenes/arcade-room.ts", readTemplate("arcade-room.scene.ts"));
    }
    // The games registry — empty until `npm create @babylonjsmarket/arcade`
    // is run INSIDE an arcade, which adds one. Both kinds need it: the shared
    // main.ts imports GAMES + gameFromPath from ./games for its router, so a
    // single game without it fails `tsc` with "Cannot find module ./games".
    write("src/games/index.ts", readTemplate("games-index.ts"));
  }

  // Example test: loads the default scene against MockRendererAdapter so
  // `npm test` passes on a fresh scaffold and shows how to test without a GPU.
  // Every kind (game / arcade / demo) exports the same SCENES + DEFAULT_SCENE
  // shape from src/scenes/index.ts, so one test fits all three.
  write("src/scenes/scenes.test.ts", readTemplate("scenes.test.ts"));

  // Shared component resolver map (HUD panels + any custom components). The
  // demo uses only stock components, so the empty default map is correct too.
  write("src/registry.ts", readTemplate("arcade-room.registry.ts"));

  // The core components: downloaded (free) into src/components, where the
  // registry and main.ts's plugin auto-wire find them. The starter scenes are
  // made of them, so a project without them does not boot — say so clearly.
  let coreResult: InstallCoreResult | null = null;
  if (argv.core !== false) {
    const from = coreFrom();
    prompts.log.step(
      from ? `Copying the core components from ${from}...` : `Downloading the core components from ${coreApiUrl()}...`,
    );
    coreResult = await installCore(root, { from });
    reportCore(coreResult);
  }

  // .gitignore
  write(
    ".gitignore",
    `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`,
  );

  const isGame = kind === "game";
  // The two kinds share the same framework + boot; only the starter scene, the
  // file table, the assets note, and the "grow it" section differ.
  const readmeIntro = isGame
    ? `A data-driven BabylonJS game built with the @babylonjsmarket/ecs framework
and the @babylonjsmarket/arcade component library.

You start with one scene — the **starter game** (a lit ground, a hero mesh, and
an orbit camera) — and grow it by adding entities + components, or more scenes.

An **arcade** is just this same idea at scale: many game scenes sharing one code
library, fronted by a walk-up "arcade room" whose cabinets launch each game.
Re-scaffold one with \`npm create @babylonjsmarket/arcade -- --kind arcade\`.`
    : `A data-driven, multigame BabylonJS arcade built with the @babylonjsmarket/ecs
framework and the @babylonjsmarket/arcade component library.

You start with one scene — the **arcade room** (a carpeted room with a row of
cabinets) — and grow it into a full arcade by adding more scenes and pointing
cabinets at them.`;
  const readmeFileRow = isGame
    ? `| \`src/scenes/game.ts\` | The starter game — entities + components, as pure data |`
    : `| \`src/scenes/arcade-room.ts\` | The starter room — entities + components, as pure data |`;
  const readmeSceneMapRow = isGame
    ? `| \`src/scenes/index.ts\` | The scene map: every scene the game can load (the multigame seam) |`
    : `| \`src/scenes/index.ts\` | The scene map: every scene the arcade can load (the multigame seam) |`;
  const readmeAssetsNote = isGame
    ? `The starter game uses no external assets, so a fresh scaffold runs offline.
Drop your own models/textures under \`public/\` and reference them from
\`src/scenes/game.ts\`.`
    : `You walk the room in first person — **W/S** move, **A/D** turn, **Q/E**
strafe. The carpet, cabinet and skins are marketplace assets; pull them into
\`public/\` once with the member CLI:

\`\`\`bash
bjs download arcade-carpet        # → public/arcade/Carpet013_1K-JPG/*.webp
bjs download arcade-cabinet       # → public/arcade/QBERT_TEMPLATE.glb
bjs download arcade-cabinet-skins # → public/arcade/cabinet-skins/*.webp
\`\`\`

The five machines along the back wall are all the SAME cabinet mesh wearing
different skins — one 2048² sheet each, holding that game's marquee, screen,
control panel and side art. So a varied arcade costs one model, and adding a
sixth machine is one line in \`src/scenes/arcade-room.ts\` (see
\`CABINET_SKINS\` for the full line-up).

The room still runs before you download them — you just get an untextured floor,
no cabinets, and (without the skins) machines wearing the model's own Q*bert
art. Swap in your own art by editing the paths in
\`src/scenes/arcade-room.ts\` (\`ASSET_BASE\` points them at \`public/\`).`;
  const readmeGrow = isGame
    ? `## Growing your game

To add another scene:

1. Author it under \`src/scenes/<my-scene>.ts\` (copy \`game.ts\`).
2. Import it in \`src/scenes/index.ts\` and add it under a new key.
3. Switch to it at runtime: \`game.loadScene(SCENES['<my-scene>'])\`.`
    : `## Filling the arcade

Each cabinet is meant to launch its own game. To add one:

1. Author a scene under \`src/scenes/<my-game>.ts\` (copy \`arcade-room.ts\`).
2. Import it in \`src/scenes/index.ts\` and add it under a new key.
3. Switch to it at runtime: \`game.loadScene(SCENES['<my-game>'])\` — e.g. when
   the player activates the matching cabinet.`;

  write(
    "README.md",
    `# ${packageName}

${readmeIntro}

| File | What's in it |
|---|---|
${readmeFileRow}
${readmeSceneMapRow}
| \`src/components/\` | Every component the scenes use — the core set, plus anything you download or write |
| \`src/registry.ts\` | Registers every folder in \`src/components/\` by name |
| \`src/main.ts\` | Boot: ${rc.adapter} → ArcadeGame → loadScene → start |

## Getting Started

\`\`\`bash
npm install
npm run dev      # http://localhost:3000
npm test         # runs src/scenes/scenes.test.ts (no browser needed)
npm run build    # type-check, then bundle the game into dist/
npm run preview  # serve dist/ at http://localhost:4173
\`\`\`

${readmeAssetsNote}

## How it works

\`src/main.ts\` boots the renderer, mounts the debug panels in dev (\`F1\`
Entities, \`F2\` EventBus, \`F3\` State Stepper, \`Esc\` for the menu that
lists every panel), then calls \`game.loadScene(...)\` with the default scene —
that's it. A production build (\`npm run build\`) leaves the panels out.

Everything else — meshes, lights, cameras, gameplay logic — is declared in the
scene modules as entities + named components. Each named component is a folder
in \`src/components/\`: the free core set was downloaded there when this project
was created (re-fetch any missing file with \`npx arcade core\`), and
\`bjs download <name>\` adds more. \`src/registry.ts\` picks up every folder;
bundlers split each component into its own chunk, loaded only when a scene uses
it.

${readmeGrow}

To add a custom component, create \`src/components/MyThing/MyThing.ts\`
exporting \`MyThingComponent\` (and optionally \`MyThingSystem\`). It is
registered automatically.
`,
  );

  // Drop the babylonjsmarket Claude skill so Claude Code auto-discovers it in
  // this project (no plugin install needed).
  if (fs.existsSync(SKILL_PAYLOAD_DIR)) {
    fs.cpSync(
      SKILL_PAYLOAD_DIR,
      path.join(root, ".claude", "skills", "babylonjsmarket"),
      { recursive: true },
    );
    prompts.log.step("Added .claude/skills/babylonjsmarket (Claude Code skill)");
  }

  let doneMessage = "Done. Now run:\n";
  const cdProjectName = path.relative(cwd, root);
  if (root !== cwd) {
    doneMessage += `\n  cd ${cdProjectName.includes(" ") ? `"${cdProjectName}"` : cdProjectName}`;
  }
  switch (pkgManager) {
    case "yarn":
      doneMessage += "\n  yarn";
      doneMessage += "\n  yarn dev";
      break;
    default:
      doneMessage += `\n  ${pkgManager} install`;
      doneMessage += `\n  ${pkgManager} run dev`;
      break;
  }
  // The arcade room references marketplace assets (carpet, cabinet, skins).
  // Point the user at all three `bjs download` pulls so the room comes up
  // textured with its full line-up of machines instead of a bare floor — miss
  // the skins and every cabinet's art 404s. (The single-game and demo scaffolds
  // use no such assets.)
  if (coreResult && !coreResult.ok) {
    doneMessage += "\n  npx arcade core   # the core components did not download";
  } else if (argv.core === false) {
    doneMessage += "\n  npx arcade core   # skipped by --no-core; the scenes need it";
  }
  if (!demo && kind === "arcade") {
    doneMessage += "\n\nThen pull the room's assets (member CLI):";
    doneMessage += "\n  bjs download arcade-carpet";
    doneMessage += "\n  bjs download arcade-cabinet";
    doneMessage += "\n  bjs download arcade-cabinet-skins";
  }
  prompts.outro(doneMessage);
}

function formatTargetDir(targetDir: string) {
  return targetDir.trim().replace(/\/+$/g, "");
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName,
  );
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z\d\-~]+/g, "-");
}

function isEmpty(p: string) {
  const files = fs.readdirSync(p);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file === ".git") continue;
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
  }
}

interface PkgInfo {
  name: string;
  version: string;
}

function pkgFromUserAgent(userAgent: string | undefined): PkgInfo | undefined {
  if (!userAgent) return undefined;
  const pkgSpec = userAgent.split(" ")[0];
  const pkgSpecArr = pkgSpec.split("/");
  return { name: pkgSpecArr[0], version: pkgSpecArr[1] };
}

/** `arcade core [dir]` — fill in an existing project's core components. */
async function core(): Promise<void> {
  const dir = argv._[1] ? path.resolve(cwd, String(argv._[1])) : cwd;
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    prompts.log.error(`No package.json in ${dir} — run this inside a project.`);
    process.exitCode = 1;
    return;
  }
  const r = await installCore(dir, { from: coreFrom() });
  if (!r.ok) {
    prompts.log.error(`Could not get the core components from ${r.source}: ${r.error}`);
    process.exitCode = 1;
    return;
  }
  prompts.log.success(
    r.written.length
      ? `Wrote ${r.written.length} file(s) for ${r.components.length} core components into src/components.`
      : `All ${r.components.length} core components are already in src/components.`,
  );
  if (r.missing.length) prompts.log.warn(`Not in the core set, skipped: ${r.missing.join(", ")}`);
}

async function main() {
  if (rawArgs[0] === "core") {
    await core();
    return;
  }
  await init();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
