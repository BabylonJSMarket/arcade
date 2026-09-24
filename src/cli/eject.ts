import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mri from "mri";
import colors from "picocolors";
import { EJECT_HELP } from "./eject-options.js";

const { cyan, green, yellow, dim, bold } = colors;

// Mirror index.ts's path strategy: from dist/cli/, the package root is two up.
// `src/Components` and `.claude-payload` ship in the published `files` array.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, "..", "..");
const COMPONENTS_SRC_DEFAULT = path.resolve(PACKAGE_ROOT, "src", "Components");
const PAYLOAD_SRC_DEFAULT = path.resolve(
  PACKAGE_ROOT,
  ".claude-payload",
  "skills",
  "babylonjsmarket",
);

/**
 * Where eject reads its source from. Defaults to this package's shipped dirs;
 * overridable so tests can point at an isolated fixture tree instead of
 * mutating the real package (which other suites read concurrently).
 */
export interface EjectRoots {
  componentsSrc: string;
  payloadSrc: string;
}

const DEFAULT_ROOTS: EjectRoots = {
  componentsSrc: COMPONENTS_SRC_DEFAULT,
  payloadSrc: PAYLOAD_SRC_DEFAULT,
};

/** The component universe = top-level folders under src/Components. */
function arcadeComponentNames(componentsSrc: string): string[] {
  if (!fs.existsSync(componentsSrc)) return [];
  return fs
    .readdirSync(componentsSrc, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** Every .ts/.tsx file inside a component folder. */
function componentFiles(componentsSrc: string, name: string): string[] {
  const dir = path.join(componentsSrc, name);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

/**
 * Files a bare `arcade eject` scans for component names, relative to the
 * project root. What the scaffold writes today:
 *
 *  - `src/scenes/*.ts`            — the scene modules (game.ts / arcade-room.ts)
 *  - `public/games/<name>/scene.json` — each game added inside an arcade
 *  - `src/registry.ts`            — the shared resolver map
 *
 * plus the single-file layout older scaffolds wrote (`src/scene.ts`,
 * `src/scene.json`), so projects made before the scenes/ split still work.
 * Test files are skipped. Only files that exist are returned.
 */
export function sceneSourceFiles(projectDir: string): string[] {
  const out: string[] = [];
  const add = (rel: string) => {
    if (fs.existsSync(path.join(projectDir, rel))) out.push(rel);
  };
  const listDir = (rel: string) => {
    const dir = path.join(projectDir, rel);
    return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  };
  for (const e of listDir("src/scenes")) {
    if (e.isFile() && /\.(ts|json)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
      out.push(`src/scenes/${e.name}`);
    }
  }
  for (const e of listDir("public/games")) {
    if (e.isDirectory()) add(`public/games/${e.name}/scene.json`);
  }
  add("src/registry.ts");
  add("src/scene.ts");
  add("src/scene.json");
  return out;
}

/** Scan the project's scene + registry files for arcade component names used as object keys. */
function parseUsedComponents(
  projectDir: string,
  names: string[],
): Set<string> {
  const used = new Set<string>();
  const text = sceneSourceFiles(projectDir)
    .map((f) => fs.readFileSync(path.join(projectDir, f), "utf8"))
    .join("\n");
  for (const name of names) {
    // name as an object key: not preceded by `.` or a word char, followed by
    // `:`. The key may be quoted — scene JSON always is (`"Score": {}`).
    const re = new RegExp(`(?:^|[^.\\w])(["']?)${name}\\1\\s*:`, "m");
    if (re.test(text)) used.add(name);
  }
  return used;
}

/** Component names a given component imports via `../Sibling/...` or lists in meta.json. */
function directDeps(
  componentsSrc: string,
  name: string,
  names: Set<string>,
): Set<string> {
  const deps = new Set<string>();
  const metaPath = path.join(componentsSrc, name, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      for (const d of meta.dependencies ?? []) if (names.has(d)) deps.add(d);
    } catch {
      /* ignore malformed meta.json — the import scan is the safety net */
    }
  }
  const importRe = /['"]\.\.\/([A-Z][A-Za-z0-9_]*)\//g;
  for (const file of componentFiles(componentsSrc, name)) {
    const src = fs.readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src))) if (names.has(m[1])) deps.add(m[1]);
  }
  return deps;
}

/** Expand a seed set to its transitive component-dependency closure. */
function resolveClosure(
  componentsSrc: string,
  seed: Set<string>,
  allNames: string[],
): Set<string> {
  const all = new Set(allNames);
  const out = new Set(seed);
  const queue = [...seed];
  while (queue.length) {
    const next = queue.pop()!;
    for (const dep of directDeps(componentsSrc, next, all)) {
      if (!out.has(dep)) {
        out.add(dep);
        queue.push(dep);
      }
    }
  }
  return out;
}

/**
 * Rewrite imports in a copied file so they resolve from `src/components/Name/`:
 *
 *  - `../Sibling/...` where Sibling was NOT ejected → the package subpath
 *    `@babylonjsmarket/arcade/Sibling`. Co-ejected siblings keep their relative
 *    path (it still resolves under src/components/).
 *  - `../../events` and `../../inputEvents` (the shared event dictionary +
 *    keyboard constants, two levels up to the package root in the source tree) →
 *    the package root `@babylonjsmarket/arcade`, which re-exports them. Otherwise
 *    the copied path would dangle.
 *
 * ecs/arcade/viz/solid/babylon package imports are left alone — they resolve
 * from node_modules in the ejected project.
 */
export function rewriteImports(
  src: string,
  ejected: Set<string>,
  allNames: Set<string>,
): string {
  return src
    .replace(
      /(['"])\.\.\/\.\.\/(?:events|inputEvents)\1/g,
      (_whole, quote) => `${quote}@babylonjsmarket/arcade${quote}`,
    )
    .replace(
      /(['"])(\.\.\/([A-Z][A-Za-z0-9_]*)\/[^'"]*)\1/g,
      (whole, quote, _spec, sibling) => {
        if (allNames.has(sibling) && !ejected.has(sibling)) {
          return `${quote}@babylonjsmarket/arcade/${sibling}${quote}`;
        }
        return whole;
      },
    );
}

function copyDir(src: string, dest: string) {
  fs.cpSync(src, dest, { recursive: true });
}

/** Rewrite sibling imports in every .ts/.tsx file under a directory tree. */
function rewriteTree(dir: string, ejected: Set<string>, allNames: Set<string>) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rewriteTree(p, ejected, allNames);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const before = fs.readFileSync(p, "utf8");
      const after = rewriteImports(before, ejected, allNames);
      if (after !== before) fs.writeFileSync(p, after);
    }
  }
}

/** Insert `Name: () => import('./components/Name/Name'),` into REGISTRY (idempotent). */
function patchRegistry(
  projectDir: string,
  names: string[],
  dryRun: boolean,
): string[] {
  const registryPath = path.join(projectDir, "src", "registry.ts");
  if (!fs.existsSync(registryPath)) {
    return [`! src/registry.ts not found — add resolvers manually for: ${names.join(", ")}`];
  }
  let text = fs.readFileSync(registryPath, "utf8");
  // The current scaffold auto-discovers components via `import.meta.glob`, so
  // ejected folders under src/components/ are registered with no edit needed.
  if (text.includes("import.meta.glob")) {
    return [`  registry auto-discovers components — no wiring needed for: ${names.join(", ")}`];
  }
  const marker = /export const REGISTRY\s*=\s*\{/;
  if (!marker.test(text)) {
    return [`! Could not find 'export const REGISTRY = {' — add resolvers manually for: ${names.join(", ")}`];
  }
  const added: string[] = [];
  const lines: string[] = [];
  for (const name of names) {
    if (text.includes(`./components/${name}/${name}`)) continue; // already wired
    lines.push(`  ${name}: () => import('./components/${name}/${name}'),`);
    added.push(name);
  }
  if (added.length && !dryRun) {
    text = text.replace(marker, (m) => `${m}\n${lines.join("\n")}`);
    fs.writeFileSync(registryPath, text);
  }
  return added.map((n) => `  patched registry: ${n}`);
}

interface EjectPlan {
  components: string[];
}

function buildPlan(
  args: string[],
  projectDir: string,
  componentsSrc: string,
): EjectPlan {
  const argv = mri(args, { boolean: ["all", "dry-run"] });
  const all = argv.all as boolean;
  const explicit = argv._.map(String);
  const names = arcadeComponentNames(componentsSrc);
  if (names.length === 0) {
    throw new Error(
      "No component source found. Run inside a project with @babylonjsmarket/arcade installed (the package must ship src/Components).",
    );
  }

  let seed: Set<string>;
  if (all) {
    seed = new Set(names);
  } else if (explicit.length) {
    const known = new Set(names);
    const bad = explicit.filter((n) => !known.has(n));
    if (bad.length) {
      throw new Error(
        `Unknown arcade component(s): ${bad.join(", ")}\nAvailable: ${names.join(", ")}`,
      );
    }
    seed = new Set(explicit);
  } else {
    seed = parseUsedComponents(projectDir, names);
    if (seed.size === 0) {
      throw new Error(
        "Couldn't detect any arcade components in src/scenes/*.ts, public/games/*/scene.json, src/registry.ts or src/scene.ts. Pass names explicitly (`arcade eject Bullet Enemy`) or use --all.",
      );
    }
  }

  const components = [...resolveClosure(componentsSrc, seed, names)].sort();
  return { components };
}

export async function eject(
  args: string[],
  roots: EjectRoots = DEFAULT_ROOTS,
): Promise<void> {
  const { componentsSrc, payloadSrc } = roots;
  if (args.includes("-h") || args.includes("--help")) {
    console.log(EJECT_HELP);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const projectDir = process.cwd();

  let plan: EjectPlan;
  try {
    plan = buildPlan(args, projectDir, componentsSrc);
  } catch (e) {
    console.error(yellow((e as Error).message));
    process.exit(1);
    return;
  }

  const ejectedSet = new Set(plan.components);
  const allNames = new Set(arcadeComponentNames(componentsSrc));
  const componentsDir = path.join(projectDir, "src", "components");

  console.log(
    bold(dryRun ? "\nEject plan (dry run — nothing written):" : "\nEjecting:"),
  );
  console.log(`  components: ${cyan(plan.components.join(", "))}`);

  // 1. Copy each component folder (with its own tests).
  for (const name of plan.components) {
    if (!dryRun) copyDir(path.join(componentsSrc, name), path.join(componentsDir, name));
    console.log(green(`  + src/components/${name}/`));
  }

  // 2. Rewrite imports across everything copied: a `../X/` whose X was NOT
  //    ejected becomes `@babylonjsmarket/arcade/X`; ejected siblings keep their
  //    still-valid relative path; `../../inputEvents` becomes the package root.
  //    ecs/arcade/viz package imports are untouched (resolve from node_modules).
  if (!dryRun) rewriteTree(componentsDir, ejectedSet, allNames);

  // 3. Patch the project registry so local copies override the package.
  for (const line of patchRegistry(projectDir, plan.components, dryRun)) {
    console.log(line.startsWith("!") ? yellow(line) : dim(line));
  }

  // 4. Drop the babylonjsmarket Claude skill into the project.
  const skillDest = path.join(projectDir, ".claude", "skills", "babylonjsmarket");
  if (fs.existsSync(payloadSrc)) {
    if (!dryRun) copyDir(payloadSrc, skillDest);
    console.log(green("  + .claude/skills/babylonjsmarket/"));
  } else {
    console.log(yellow("  ! skill payload not found in package — skipped"));
  }

  console.log(
    dryRun
      ? dim("\nRe-run without --dry-run to apply.\n")
      : green("\nDone. Ejected components now live in your project and override the package copies.\n"),
  );
}
