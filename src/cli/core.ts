/**
 * The core component set — downloaded into a new project's src/components.
 *
 * These components used to ship inside @babylonjsmarket/arcade. They live in
 * the marketplace library now (CodeLibrary, meta.json `"builtin": true` and
 * `"isFree": true`), so arcade stays small and a new core component never needs
 * an arcade release. A scaffold gets them one of two ways, both producing the
 * same files:
 *
 *   1. the public endpoint GET <site>/api/library/core (no login — it runs
 *      before one, and the set is free), the default;
 *   2. a local library checkout, `--core-from <CodeLibrary dir>` — offline,
 *      and how the monorepo's own tests scaffold without the network.
 *
 * Files keep their library-relative paths in the bundle and are written the way
 * `bjs download` writes them: `Components/<Name>/…` → `src/components/<Name>/…`,
 * shared helpers (`inputEvents.ts`, `math/…`) → `src/<path>`. Existing files are
 * never overwritten, so re-running only fills in what is missing.
 */
import fs from "node:fs";
import path from "node:path";

export interface CoreComponent {
  name: string;
  /** "Components/Mesh" */
  path: string;
  version: string;
  files: string[];
  dependencies: string[];
}

export interface CoreFile {
  /** Library-relative: "Components/Mesh/Mesh.ts", "inputEvents.ts". */
  path: string;
  content: string;
}

export interface CoreBundle {
  components: CoreComponent[];
  files: CoreFile[];
  /** Imports that left the core set and could not be served. */
  missing: string[];
}

/** The production site. `BJS_API_URL` overrides it, the same variable `bjs` reads. */
export const DEFAULT_API_URL = "https://babylonjsmarket.com";

export function coreApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BJS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

// Tests, panels and viz are not runtime: they would break a scaffold's `tsc`.
// The same rule as the site's runtimeDownloadFiles.
const NON_RUNTIME_RE = /\.(test|spec|contract\.test)\.[jt]sx?$|\.(panel|viz)\.[jt]sx?$/;

// Shared files a component may import from outside its folder — the site's
// free-helper allowlist: math/*, top-level inputEvents, Components/_shared/*,
// and any component's own .events.ts (names only, free by policy).
const SHARED_HELPER_RE =
  /^(math\/[\w./-]+\.tsx?|inputEvents\.tsx?|Components\/_shared\/[\w./-]+\.tsx?|Components\/([A-Z]\w*)\/\2\.events\.ts)$/;

const VALID_EXT = new Set([".ts", ".tsx", ".json"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "images", "coverage", ".git"]);

function relativeSpecs(source: string): string[] {
  const specs = new Set<string>();
  const re = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) specs.add(m[1]!);
  return [...specs];
}

function resolveSpec(fromFile: string, spec: string): string | null {
  const parts = fromFile.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join("/");
}

/** A component's runtime files, component-relative, the way sync-library lists them. */
function listRuntimeFiles(componentDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), rel);
      } else if (e.isFile() && VALID_EXT.has(path.extname(e.name)) && e.name !== "meta.json") {
        if (!NON_RUNTIME_RE.test(e.name)) out.push(rel);
      }
    }
  };
  walk(componentDir, "");
  return out.sort();
}

interface Meta {
  builtin?: unknown;
  isFree?: unknown;
  hidden?: unknown;
  dependencies?: unknown;
}

/**
 * Build the core bundle from a library checkout on disk. Mirrors the server:
 * builtin AND free AND not hidden (a hidden row is inactive in the catalogue,
 * so the site would not serve it either).
 */
export function readLocalCoreBundle(libraryDir: string): CoreBundle {
  const componentsDir = path.join(libraryDir, "Components");
  if (!fs.existsSync(componentsDir)) {
    throw new Error(`no Components/ folder under ${libraryDir}`);
  }
  const read = (rel: string): string | null => {
    const full = path.resolve(libraryDir, rel);
    if (!full.startsWith(path.resolve(libraryDir) + path.sep)) return null;
    return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, "utf8") : null;
  };

  const components: CoreComponent[] = [];
  for (const e of fs.readdirSync(componentsDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_")) continue;
    const dir = path.join(componentsDir, e.name);
    if (!fs.existsSync(path.join(dir, `${e.name}.ts`))) continue;
    let meta: Meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as Meta;
    } catch {
      continue;
    }
    if (meta.builtin !== true || meta.isFree !== true || meta.hidden === true) continue;
    components.push({
      name: e.name,
      path: `Components/${e.name}`,
      version: "local",
      files: listRuntimeFiles(dir),
      dependencies: Array.isArray(meta.dependencies)
        ? meta.dependencies.filter((d): d is string => typeof d === "string")
        : [],
    });
  }
  components.sort((a, b) => a.path.localeCompare(b.path));
  return assembleBundle(components, read);
}

/** Collect each component's files, then the shared helpers they import. */
export function assembleBundle(
  components: CoreComponent[],
  read: (libraryPath: string) => string | null,
): CoreBundle {
  const files = new Map<string, string>();
  const missing = new Set<string>();
  const corePaths = new Set(components.map((c) => c.path));
  const queue: string[] = [];
  for (const c of components) {
    for (const f of c.files) {
      const p = `${c.path}/${f}`;
      const content = read(p);
      if (content == null) {
        missing.add(p);
        continue;
      }
      files.set(p, content);
      queue.push(p);
    }
  }
  while (queue.length) {
    const from = queue.shift()!;
    for (const spec of relativeSpecs(files.get(from) ?? "")) {
      const base = resolveSpec(from, spec);
      if (!base) continue;
      const owner = base.split("/").slice(0, 2).join("/");
      if (base.startsWith("Components/") && corePaths.has(owner)) continue;
      let hit = false;
      for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (files.has(cand)) {
          hit = true;
          break;
        }
        if (!SHARED_HELPER_RE.test(cand)) continue;
        const content = read(cand);
        if (content != null) {
          files.set(cand, content);
          queue.push(cand);
          hit = true;
          break;
        }
      }
      if (!hit) missing.add(base);
    }
  }
  return {
    components,
    files: [...files].map(([p, content]) => ({ path: p, content })),
    missing: [...missing].sort(),
  };
}

function isBundle(v: unknown): v is CoreBundle {
  const b = v as CoreBundle | null;
  return (
    !!b &&
    Array.isArray(b.components) &&
    Array.isArray(b.files) &&
    b.files.every((f) => typeof f?.path === "string" && typeof f?.content === "string")
  );
}

/** GET <apiUrl>/api/library/core. Throws with a readable message on failure. */
export async function fetchCoreBundle(
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CoreBundle> {
  const url = `${apiUrl}/api/library/core`;
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error(`could not reach ${url} (${(e as Error).message})`);
  }
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!isBundle(body)) throw new Error(`${url} did not return a core bundle`);
  return { ...body, missing: Array.isArray(body.missing) ? body.missing : [] };
}

/** Where a library path lands in a project. */
export function projectPathFor(libraryPath: string): string {
  return libraryPath.startsWith("Components/")
    ? `src/components/${libraryPath.slice("Components/".length)}`
    : `src/${libraryPath}`;
}

/**
 * Write a bundle into a project. Refuses any path that would leave src/, and
 * never overwrites a file that is already there. Returns the files written.
 */
export function writeCoreBundle(projectRoot: string, bundle: CoreBundle): string[] {
  const srcRoot = path.resolve(projectRoot, "src");
  const written: string[] = [];
  for (const f of bundle.files) {
    if (f.path.includes("\\") || f.path.split("/").some((s) => s === ".." || s === "." || s === "")) continue;
    const rel = projectPathFor(f.path);
    const dest = path.resolve(projectRoot, rel);
    if (!dest.startsWith(srcRoot + path.sep)) continue;
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content);
    written.push(rel);
  }
  // Mark each core folder, so `bjs submit` knows a dependency on it names the
  // catalogue's copy and never carries its files.
  for (const c of bundle.components) {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(c.name)) continue;
    const rel = `src/components/${c.name}/meta.json`;
    const dest = path.resolve(projectRoot, rel);
    if (!fs.existsSync(path.dirname(dest)) || fs.existsSync(dest)) continue;
    const meta = { name: c.name, version: c.version, builtin: true, isFree: true, dependencies: c.dependencies ?? [] };
    fs.writeFileSync(dest, JSON.stringify(meta, null, 2) + "\n");
    written.push(rel);
  }
  return written;
}

export interface InstallCoreResult {
  ok: boolean;
  /** Where the set came from: the site URL or the local library dir. */
  source: string;
  components: string[];
  written: string[];
  missing: string[];
  error?: string;
}

/** Fetch (or read) the core set and write it into `projectRoot`. Never throws. */
export async function installCore(
  projectRoot: string,
  opts: { from?: string; apiUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<InstallCoreResult> {
  const source = opts.from ? path.resolve(opts.from) : (opts.apiUrl ?? coreApiUrl());
  try {
    const bundle = opts.from
      ? readLocalCoreBundle(source)
      : await fetchCoreBundle(source, opts.fetchImpl);
    if (bundle.components.length === 0) {
      return { ok: false, source, components: [], written: [], missing: [], error: "the core set is empty" };
    }
    const written = writeCoreBundle(projectRoot, bundle);
    return {
      ok: true,
      source,
      components: bundle.components.map((c) => c.name),
      written,
      missing: bundle.missing,
    };
  } catch (e) {
    return { ok: false, source, components: [], written: [], missing: [], error: (e as Error).message };
  }
}
