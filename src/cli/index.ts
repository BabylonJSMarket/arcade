#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mri from "mri";
import * as prompts from "@clack/prompts";
import { eject } from "./eject.js";


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
    deps: { "@babylonjs/core": "^9.0.0", "@babylonjs/loaders": "^9.0.0", "@babylonjs/havok": "^1.3.0" },
  },
  "babylon-lite": {
    label: "Babylon Lite + Havok physics (WebGPU)",
    adapter: "BabylonLiteAdapter",
    import: "@babylonjsmarket/ecs/babylon-lite",
    deps: { "@babylonjs/lite": "^1.0.1", "@babylonjs/havok": "^1.3.0" },
    viteExtras: ["@babylonjs/lite"],
  },
  three: {
    label: "Three.js + Rapier physics",
    adapter: "ThreeAdapter",
    import: "@babylonjsmarket/ecs/three",
    deps: { "@dimforge/rapier3d-compat": "^0.19.3" },
    devDeps: { "@types/three": "^0.184.0" },
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
}>(argsAfterSubcommand, {
  alias: { h: "help" },
  boolean: ["help", "overwrite", "demo"],
  string: ["renderer", "kind"],
});
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
src/scenes/ that declare entities + their components by name; arcade lazy-imports
each named component the first time it appears, and custom components go under
src/components/ wired up via src/registry.ts.

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
                             and Babylon Lite adapters (instead of a game/arcade)`;

const defaultTargetDir = "babylonjs-arcade";

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
        "@babylonjs/core": "^9.0.0",
        "@babylonjs/loaders": "^9.0.0",
        "@babylonjs/havok": "^1.3.0",
        "@babylonjs/lite": "^1.0.1",
        "@dimforge/rapier3d-compat": "^0.19.3",
      }
    : rc.deps;
  const engineDevDeps = demo ? { "@types/three": "^0.184.0" } : (rc.devDeps ?? {});

  // package.json — templates differ only in scene data + the chosen adapter.
  const pkg = {
    name: packageName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      lint: "eslint src",
    },
    dependencies: {
      "@babylonjsmarket/ecs": range(ECS_VERSION),
      "@babylonjsmarket/arcade": range(ARCADE_VERSION),
      "@babylonjsmarket/viz": range(VIZ_VERSION),
      ...engineDeps,
    },
    devDependencies: {
      typescript: "^5.5.0",
      vite: "^6.0.0",
      "vite-plugin-solid": "^2.11.0",
      "solid-js": "^1.9.0",
      eslint: "^9.0.0",
      "@typescript-eslint/parser": "^8.0.0",
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
  // build.target: 'esnext' opts esbuild into top-level await (our main.ts
  // uses `await game.init(canvas)` directly). Without this, the default
  // browser baseline rejects TLA at bundle time.
  // Rapier (WASM) and Babylon Lite (WebGPU shader assets) get the same
  // dedupe + optimize-exclude treatment as havok. (Three itself is CDN-loaded
  // via the import map, so it stays out of Vite's graph.) The demo pulls both;
  // a normal scaffold pulls just its renderer's extras.
  const viteExtras = demo ? ["@dimforge/rapier3d-compat", "@babylonjs/lite"] : (rc.viteExtras ?? []);
  const demoDedupe = viteExtras.map((p) => `\n      '${p}',`).join("");
  const demoExclude = viteExtras.map((p) => `, '${p}'`).join("");
  write(
    "vite.config.js",
    `import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid({ include: /\\.(jsx|tsx)$/ })],
  server: { port: 3000 },
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
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
    exclude: ['@babylonjsmarket/arcade', '@babylonjsmarket/viz', '@babylonjs/havok'${demoExclude}],
    include: ['@babylonjs/core', '@babylonjs/loaders']
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
  "include": ["src"]
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
        "three": "https://esm.sh/three@0.184.0",
        "three/addons/": "https://esm.sh/three@0.184.0/examples/jsm/"
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
        "three": "https://esm.sh/three@0.184.0",
        "three/addons/": "https://esm.sh/three@0.184.0/examples/jsm/"
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
  // component names resolve via arcade's default registry or src/registry.ts.
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
        .replace("new BabylonAdapter()", `new ${rc.adapter}()`)
        // The ToneMapping grade is a Babylon-only plugin; drop its import + call
        // for the other renderers (they have no scene image-processing seam).
        .replace(
          "import { ArcadeGame, registerBabylonToneMappingExtension } from '@babylonjsmarket/arcade'",
          "import { ArcadeGame } from '@babylonjsmarket/arcade'",
        )
        .replace(
          /\n\/\/ Built-in arcade adapter plugin:[\s\S]*?registerBabylonToneMappingExtension\(adapter\)\n/,
          "\n",
        );
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
  }

  // Shared component resolver map (HUD panels + any custom components). The
  // demo uses only stock components, so the empty default map is correct too.
  write("src/registry.ts", readTemplate("arcade-room.registry.ts"));

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
strafe. The carpet + cabinet are marketplace assets; pull them into \`public/\`
once with the member CLI:

\`\`\`bash
bjs download arcade-carpet     # → public/arcade/Carpet013_1K-JPG/*.webp
bjs download arcade-cabinet    # → public/arcade/QBERT_TEMPLATE.glb
\`\`\`

The room still runs before you download them — you just get an untextured floor
and no cabinets. Swap in your own art by editing the paths in
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
| \`src/registry.ts\` | Resolvers for HUD panels and any custom components |
| \`src/main.ts\` | Boot: ${rc.adapter} → ArcadeGame → loadScene → start |

## Getting Started

\`\`\`bash
npm install
npm run dev      # http://localhost:3000
\`\`\`

${readmeAssetsNote}

## How it works

\`src/main.ts\` boots the renderer, mounts the viz panels (press \`\\\`\` for
the Entities panel, \`F4\` for the EventBus debugger), then calls
\`game.loadScene(...)\` with the default scene — that's it.

Everything else — meshes, lights, cameras, gameplay logic — is declared in the
scene modules as entities + named components. The arcade package's default
registry maps every named component to its module; bundlers tree-shake any
component a scene doesn't use.

${readmeGrow}

To add a custom component, drop a file under \`src/components/MyThing.ts\`
exporting \`MyThingComponent\` (and optionally \`MyThingSystem\`), then add
\`MyThing: () => import('./components/MyThing')\` to the resolver map in
\`src/registry.ts\`.
`,
  );

  // Drop the babylonjsmarket Claude skill so Claude Code auto-discovers it in
  // this project (no plugin install needed). Same payload `arcade eject` uses.
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
  // The arcade room references marketplace assets (carpet + cabinet). Point the
  // user at the two `bjs download` pulls so the room comes up textured instead
  // of a bare floor. (The single-game and demo scaffolds use no such assets.)
  if (!demo && kind === "arcade") {
    doneMessage += "\n\nThen pull the room's carpet + cabinet (member CLI):";
    doneMessage += "\n  bjs download arcade-carpet";
    doneMessage += "\n  bjs download arcade-cabinet";
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

async function main() {
  if (rawArgs[0] === "eject") {
    await eject(rawArgs.slice(1));
    return;
  }
  await init();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
