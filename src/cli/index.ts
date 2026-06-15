#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mri from "mri";
import * as prompts from "@clack/prompts";
import colors from "picocolors";
import SETUP_OPTIONS from "./setup-options.js";
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

const { cyan } = colors;

// Allow `arcade init <name>` as well as the npm-create-style bare `arcade <name>`.
// We strip a leading "init" subcommand here so positional parsing stays simple.
const rawArgs = process.argv.slice(2);
const argsAfterSubcommand =
  rawArgs[0] === "init" ? rawArgs.slice(1) : rawArgs;

const argv = mri<{
  template?: string;
  help?: boolean;
  overwrite?: boolean;
}>(argsAfterSubcommand, {
  alias: { h: "help", t: "template" },
  boolean: ["help", "overwrite"],
  string: ["template"],
});
const cwd = process.cwd();

const helpMessage = `\
Usage: arcade init [OPTION]... [DIRECTORY]
   or: npm create @babylonjsmarket/arcade [DIRECTORY]

Create a new BabylonJS game powered by @babylonjsmarket/ecs and @babylonjsmarket/arcade.

Every template ships the SAME tiny src/main.ts boot. Scenes are TS modules
(src/scene.ts) that declare entities + their components by name; arcade
lazy-imports each named component the first time it appears. Custom
components go under src/components/ and are wired up via src/registry.ts.

With no arguments, start the CLI in interactive mode.

Options:
  -t, --template NAME        use a specific template (skip the prompt)
  -h, --help                 print this help message
      --overwrite            replace any existing files in the target directory

Available templates:
${SETUP_OPTIONS.map((o) => `  ${cyan(o.name)}${" ".repeat(Math.max(1, 14 - o.name.length))}${o.hint}`).join("\n")}`;

const TEMPLATES = SETUP_OPTIONS.map((option) => option.name);

const defaultTargetDir = "babylonjs-arcade";

async function init() {
  const argTargetDir = argv._[0]
    ? formatTargetDir(String(argv._[0]))
    : undefined;
  const argTemplate = argv.template;
  const argOverwrite = argv.overwrite;

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

  // 4. Choose a template
  let template = argTemplate;
  let hasInvalidArgTemplate = false;
  if (argTemplate && !TEMPLATES.includes(argTemplate)) {
    template = undefined;
    hasInvalidArgTemplate = true;
  }
  if (!template) {
    const framework = await prompts.select({
      message: hasInvalidArgTemplate
        ? `"${argTemplate}" isn't a valid template. Please choose from below: `
        : "Select a template:",
      options: SETUP_OPTIONS.map((opt) => ({
        label: opt.color(opt.display || opt.name),
        value: opt,
        hint: opt.hint,
      })),
    });
    if (prompts.isCancel(framework)) return cancel();
    template = framework.name;
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

  // package.json — same for every template; templates differ only in scene JSON.
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
      "@babylonjs/core": "^9.0.0",
      "@babylonjs/loaders": "^9.0.0",
      "@babylonjs/havok": "^1.3.0",
    },
    devDependencies: {
      typescript: "^5.5.0",
      vite: "^6.0.0",
      "vite-plugin-solid": "^2.11.0",
      "solid-js": "^1.9.0",
      eslint: "^9.0.0",
      "@typescript-eslint/parser": "^8.0.0",
      "@babylonjsmarket/eslint-plugin": range(ESLINT_PLUGIN_VERSION),
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
    ],
  },
  optimizeDeps: {
    // arcade excluded so esbuild doesn't pre-bundle its .tsx with the default
    // React JSX transform; havok excluded so Vite doesn't rewrite its wasm URL.
    exclude: ['@babylonjsmarket/arcade', '@babylonjs/havok'],
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

  write(
    "index.html",
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${packageName}</title>
    <style>
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

  // Tiny boot, identical for every template — imports SCENE + REGISTRY and
  // starts the game. Users rarely edit this file.
  write("src/main.ts", generateMainTs());

  // The actual game definition. Pure data: entities + components by name.
  // Every component name appearing here is resolved either by arcade's
  // default registry or by src/registry.ts (HUD panels and any custom
  // components the user authors locally).
  write("src/scene.ts", generateSceneTs(template!));

  // HUD-panel resolvers and any user-supplied custom components.
  write("src/registry.ts", generateRegistryTs(template!));

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

  write(
    "README.md",
    `# ${packageName}

A data-driven BabylonJS game built with the @babylonjsmarket/ecs framework
and the @babylonjsmarket/arcade component library.

The whole game is three small TS files:

| File | What's in it |
|---|---|
| \`src/scene.ts\` | Entities + components — the game itself, as pure data |
| \`src/registry.ts\` | HUD panel resolvers (Scoreboard, etc.) and any custom components |
| \`src/main.ts\` | Three-line boot: BabylonAdapter → ArcadeGame → loadScene → start |

## Getting Started

\`\`\`bash
npm install
npm run dev      # http://localhost:3000
\`\`\`

## How it works

\`src/main.ts\` boots the renderer, mounts the viz panels (press \`\\\`\` for
the Entities panel, \`F4\` for the EventBus debugger), then calls
\`game.loadScene(SCENE)\` — that's it.

Everything else — meshes, lights, cameras, gameplay logic — is declared in
\`src/scene.ts\` as entities + named components. The arcade package's
default registry maps every named component to its module; bundlers
tree-shake any component a scene doesn't use.

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

/**
 * Template generators — read the .ts source for each template's main.ts,
 * scene.ts, and registry.ts from packages/arcade/templates/ and return its
 * contents. `main.ts` is shared across every template; `scene.ts` and
 * `registry.ts` are per-template.
 *
 * The CLI ships these files unchanged into the scaffolded project: no
 * String.raw blobs, no per-template branches in this file. Adding a new
 * template means dropping a `{name}.scene.ts` + `{name}.registry.ts` pair
 * into templates/ and listing the name in setup-options.ts.
 */
function generateMainTs(): string {
  return readTemplate("main.ts");
}

function generateSceneTs(template: string): string {
  return readTemplate(`${template}.scene.ts`);
}

function generateRegistryTs(template: string): string {
  return readTemplate(`${template}.registry.ts`);
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
