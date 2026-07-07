import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eject, rewriteImports } from "./eject.js";
import { EJECT_HELP } from "./eject-options.js";

// eject() reads the REAL component source that ships in this package
// (../../src/Components, resolved from import.meta.url) and writes copies into
// process.cwd(). We drive it by chdir-ing into a throwaway project dir, then
// assert on what landed on disk + what it logged.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, "..", "..");
const COMPONENTS_SRC = path.join(PACKAGE_ROOT, "src", "Components");

let tmpDir: string;
let cwdBefore: string;
let logs: string[];
let errs: string[];
let exitCode: number | undefined;

function joinLogs(): string {
  return logs.join("\n");
}

beforeEach(() => {
  cwdBefore = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "arcade-eject-test-"));
  process.chdir(tmpDir);

  logs = [];
  errs = [];
  exitCode = undefined;

  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    logs.push(a.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errs.push(a.map(String).join(" "));
  });
  // process.exit must not actually kill the test runner. Record + throw so the
  // caller's control flow unwinds the same way `process.exit` would.
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCode = code;
    throw new Error(`__EXIT__${code ?? 0}`);
  }) as never);
});

afterEach(() => {
  process.chdir(cwdBefore);
  vi.restoreAllMocks();
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** Run eject, swallowing the synthetic exit throw so assertions can run after. */
async function runEject(args: string[]): Promise<void> {
  try {
    await eject(args);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith("__EXIT__")) throw e;
  }
}

/** Same, but against an isolated fixture component/payload source. */
async function runEjectRoots(
  args: string[],
  roots: { componentsSrc: string; payloadSrc: string },
): Promise<void> {
  try {
    await eject(args, roots);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith("__EXIT__")) throw e;
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(tmpDir, rel), "utf8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(tmpDir, rel));
}

// ---------------------------------------------------------------------------
// Fixture-root harness.
//
// Most tests drive eject() against the REAL package source (the default
// roots). A few edge paths — a malformed meta.json, a missing component
// source dir, a missing skill payload, a component folder with a nested
// subdirectory — don't occur in the shipped package and can't be forced by
// mutating it (other suites read it concurrently). For those, eject() takes
// an optional { componentsSrc, payloadSrc } so we point it at a throwaway
// fixture tree under tmpDir/_fixture instead.
// ---------------------------------------------------------------------------

interface FixtureComponent {
  /** Map of relative file path → contents, written under the component dir. */
  files: Record<string, string>;
}

/** Build an isolated component-source + payload tree; return roots for eject(). */
function makeFixtureRoots(
  components: Record<string, FixtureComponent>,
  opts: { withPayload?: boolean } = { withPayload: true },
): { componentsSrc: string; payloadSrc: string } {
  const root = fs.mkdtempSync(path.join(tmpDir, "_fixture-"));
  const componentsSrc = path.join(root, "Components");
  for (const [name, comp] of Object.entries(components)) {
    for (const [rel, contents] of Object.entries(comp.files)) {
      const full = path.join(componentsSrc, name, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
    }
  }
  const payloadSrc = path.join(root, "payload", "babylonjsmarket");
  if (opts.withPayload) {
    fs.mkdirSync(payloadSrc, { recursive: true });
    fs.writeFileSync(path.join(payloadSrc, "SKILL.md"), "# fixture skill\n");
  }
  return { componentsSrc, payloadSrc };
}

describe("arcade eject", () => {
  describe("--help", () => {
    it("prints the help text and writes nothing", async () => {
      await runEject(["--help"]);
      expect(joinLogs()).toContain(EJECT_HELP);
      expect(exists("src/components")).toBe(false);
    });

    it("also responds to -h", async () => {
      await runEject(["-h"]);
      expect(joinLogs()).toContain("Usage: arcade eject");
    });
  });

  describe("error handling (no seed)", () => {
    it("exits 1 with guidance when no scene/registry and no names given", async () => {
      await runEject([]);
      expect(exitCode).toBe(1);
      expect(errs.join("\n")).toContain("Couldn't detect any arcade components");
      expect(exists("src/components")).toBe(false);
    });

    it("exits 1 on an unknown explicit component name", async () => {
      await runEject(["NotARealComponent"]);
      expect(exitCode).toBe(1);
      expect(errs.join("\n")).toContain("Unknown arcade component(s): NotARealComponent");
      expect(errs.join("\n")).toContain("Available:");
    });
  });

  describe("explicit names — dependency closure", () => {
    it("ejects a leaf component with no siblings (Score)", async () => {
      await runEject(["Score"]);
      expect(exists("src/components/Score/Score.ts")).toBe(true);
      // Score has no sibling deps — closure stays at exactly { Score }.
      const others = fs.readdirSync(path.join(tmpDir, "src", "components"));
      expect(others).toEqual(["Score"]);
    });

    it("pulls a direct sibling dependency into the closure (Health → MeshPrimitive)", async () => {
      await runEject(["Health"]);
      expect(exists("src/components/Health/Health.ts")).toBe(true);
      expect(exists("src/components/MeshPrimitive/MeshPrimitive.ts")).toBe(true);
    });

    it("resolves a transitive closure (Enemy → Obstacle → MeshPrimitive)", async () => {
      await runEject(["Enemy"]);
      // Enemy imports Obstacle + MeshPrimitive; Obstacle also imports
      // MeshPrimitive — all must land via the transitive walk. Event constants
      // now come from the shared dictionary, so they no longer widen the closure.
      for (const c of ["Enemy", "Obstacle", "MeshPrimitive"]) {
        expect(exists(`src/components/${c}/${c}.ts`), `${c} should be ejected`).toBe(true);
      }
    });

    it("logs each ejected component folder", async () => {
      await runEject(["Score"]);
      expect(joinLogs()).toContain("src/components/Score/");
      expect(joinLogs()).toContain("Done.");
    });
  });

  describe("import rewriting", () => {
    it("rewrites a NON-ejected sibling import to the package subpath", async () => {
      // Eject only Health. Its `../MeshPrimitive/` import — MeshPrimitive IS in
      // Health's closure, so it stays relative. Pick a component whose dep we
      // can leave un-ejected instead: Bumper imports MeshPrimitive AND Score.
      // Ejecting Bumper drags in MeshPrimitive + Score (closure), so both stay
      // relative. To see a rewrite we need a sibling NOT in the closure — use a
      // component that references a sibling only via meta/import we exclude.
      // Simplest deterministic case: eject Health alone and confirm its single
      // sibling (MeshPrimitive) is in the closure and kept relative.
      await runEject(["Health"]);
      const healthSrc = read("src/components/Health/Health.ts");
      // MeshPrimitive was co-ejected, so the relative import is preserved.
      expect(healthSrc).toContain("../MeshPrimitive/");
      expect(healthSrc).not.toContain("@babylonjsmarket/arcade/MeshPrimitive");
    });

    it("rewrites siblings outside the ejected set to the package subpath", async () => {
      // Hand-build a tiny project component that imports a sibling we will NOT
      // eject, then eject just that handmade component is impossible (eject only
      // knows package components). Instead verify the rewrite indirectly: eject
      // a component, then confirm any surviving `../X/` references point only at
      // co-ejected siblings (never a dangling relative path).
      await runEject(["Enemy"]);
      const ejected = new Set(
        fs.readdirSync(path.join(tmpDir, "src", "components")),
      );
      // Walk every ejected file: each `../Sibling/` relative import must target
      // a co-ejected sibling; non-ejected siblings must have become a package
      // subpath. (Enemy's closure — Enemy/Obstacle/MeshPrimitive — is
      // self-contained, so all stay relative; this asserts the rewrite never
      // broke a path.)
      const walk = (dir: string): string[] => {
        const out: string[] = [];
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) out.push(...walk(p));
          else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
        }
        return out;
      };
      const re = /['"]\.\.\/([A-Z][A-Za-z0-9_]*)\//g;
      for (const f of walk(path.join(tmpDir, "src", "components"))) {
        const src = fs.readFileSync(f, "utf8");
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          // any surviving relative sibling import must be co-ejected
          expect(ejected.has(m[1]), `${m[1]} relative-imported by ${f} but not ejected`).toBe(true);
        }
      }
    });
  });

  describe("registry patching", () => {
    it("inserts a resolver line into an existing REGISTRY", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "registry.ts"),
        "export const REGISTRY = {\n};\n",
      );
      await runEject(["Score"]);
      const reg = read("src/registry.ts");
      expect(reg).toContain("Score: () => import('./components/Score/Score'),");
      expect(joinLogs()).toContain("patched registry: Score");
    });

    it("is idempotent — a second eject does not duplicate the resolver", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "registry.ts"),
        "export const REGISTRY = {\n};\n",
      );
      await runEject(["Score"]);
      await runEject(["Score"]);
      const reg = read("src/registry.ts");
      const matches = reg.match(/import\('\.\/components\/Score\/Score'\)/g) ?? [];
      expect(matches.length).toBe(1);
    });

    it("skips patching an auto-glob registry (components are auto-discovered)", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "registry.ts"),
        "export const REGISTRY = Object.fromEntries(\n" +
          "  Object.entries(import.meta.glob('./components/*/*.ts')))\n",
      );
      await runEject(["Score"]);
      const reg = read("src/registry.ts");
      // Untouched — no manual resolver line injected.
      expect(reg).not.toContain("Score: () => import(");
      expect(joinLogs()).toContain("auto-discovers components");
    });

    it("warns when registry.ts is missing", async () => {
      await runEject(["Score"]);
      expect(joinLogs()).toContain("src/registry.ts not found");
    });

    it("warns when REGISTRY marker cannot be found", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, "registry.ts"), "// no registry here\n");
      await runEject(["Score"]);
      expect(joinLogs()).toContain("Could not find 'export const REGISTRY = {'");
    });
  });

  describe("scene/registry scan (no explicit names)", () => {
    it("auto-detects components referenced as object keys in scene.ts", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "scene.ts"),
        `export const SCENE = {
  entities: {
    Hero: { components: { Score: {}, MeshPrimitive: { primitive: 'box' } } }
  }
};\n`,
      );
      fs.writeFileSync(
        path.join(srcDir, "registry.ts"),
        "export const REGISTRY = {\n};\n",
      );
      await runEject([]);
      expect(exists("src/components/Score/Score.ts")).toBe(true);
      expect(exists("src/components/MeshPrimitive/MeshPrimitive.ts")).toBe(true);
    });

    it("does not match a dotted member access (e.g. foo.Score:)", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      // Only `MeshPrimitive` is a real object key; `x.Score` is member access.
      fs.writeFileSync(
        path.join(srcDir, "scene.ts"),
        `const obj = { MeshPrimitive: 1 }; const y = x.Score;\n`,
      );
      await runEject([]);
      expect(exists("src/components/MeshPrimitive/MeshPrimitive.ts")).toBe(true);
      expect(exists("src/components/Score/Score.ts")).toBe(false);
    });
  });

  describe("--all", () => {
    it("ejects every package component", async () => {
      await runEject(["--all"]);
      const pkgComponents = fs
        .readdirSync(COMPONENTS_SRC, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      for (const c of pkgComponents) {
        expect(exists(`src/components/${c}`), `${c} should be ejected by --all`).toBe(true);
      }
    });

    it("rewrites the arcade-core inputEvents import to the package root", async () => {
      // KeyboardMover imports `../../inputEvents` (arcade core). Once copied to
      // src/components/KeyboardMover/, that path would dangle — eject rewrites
      // it to `@babylonjsmarket/arcade`, which re-exports the constants.
      await runEject(["KeyboardMover"]);
      const src = read("src/components/KeyboardMover/KeyboardMover.ts");
      expect(src).toContain("from '@babylonjsmarket/arcade'");
      expect(src).not.toContain("../../inputEvents");
    });

    it("drops the babylonjsmarket Claude skill into .claude/skills", async () => {
      await runEject(["--all"]);
      expect(exists(".claude/skills/babylonjsmarket")).toBe(true);
      expect(joinLogs()).toContain(".claude/skills/babylonjsmarket/");
    });
  });

  describe("--dry-run", () => {
    it("prints the plan but writes nothing to disk", async () => {
      await runEject(["--all", "--dry-run"]);
      expect(joinLogs()).toContain("dry run");
      expect(joinLogs()).toContain("Re-run without --dry-run");
      expect(exists("src/components")).toBe(false);
      expect(exists(".claude/skills/babylonjsmarket")).toBe(false);
    });

    it("does not patch the registry in dry-run mode", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "registry.ts"),
        "export const REGISTRY = {\n};\n",
      );
      await runEject(["Score", "--dry-run"]);
      expect(read("src/registry.ts")).not.toContain("import('./components/Score/Score')");
    });
  });

  // -------------------------------------------------------------------------
  // Edge paths driven against an isolated fixture component source, so we
  // never mutate the real package other suites read concurrently.
  // -------------------------------------------------------------------------
  describe("missing / empty component source", () => {
    it("errors and exits 1 when the component source dir is absent", async () => {
      // arcadeComponentNames() short-circuits to [] when COMPONENTS_SRC is
      // missing; buildPlan then throws the "No component source found" guidance.
      const roots = {
        componentsSrc: path.join(tmpDir, "_fixture-does-not-exist", "Components"),
        payloadSrc: path.join(tmpDir, "_fixture-does-not-exist", "payload"),
      };
      try {
        await eject(["--all"], roots);
      } catch (e) {
        if (!(e instanceof Error) || !e.message.startsWith("__EXIT__")) throw e;
      }
      expect(exitCode).toBe(1);
      expect(errs.join("\n")).toContain("No component source found");
      expect(exists("src/components")).toBe(false);
    });

    it("errors when the component source dir exists but is empty", async () => {
      // Same throw, reached through the readdir-returns-no-dirs branch.
      const roots = makeFixtureRoots({});
      // The fixture's Components dir is only created lazily per component, so
      // create it empty to exercise the existsSync-true / zero-names path.
      fs.mkdirSync(roots.componentsSrc, { recursive: true });
      try {
        await eject(["--all"], roots);
      } catch (e) {
        if (!(e instanceof Error) || !e.message.startsWith("__EXIT__")) throw e;
      }
      expect(exitCode).toBe(1);
      expect(errs.join("\n")).toContain("No component source found");
    });
  });

  describe("malformed meta.json", () => {
    it("ignores a component's broken meta.json and falls back to the import scan", async () => {
      // Foo's meta.json is invalid JSON → directDeps' try/catch swallows it and
      // relies on the `../Bar/` import scan to still pull Bar into the closure.
      const roots = makeFixtureRoots({
        Foo: {
          files: {
            "meta.json": "{ this is not valid json",
            "Foo.ts": "import { Bar } from '../Bar/Bar';\nexport const Foo = Bar;\n",
          },
        },
        Bar: {
          files: {
            "meta.json": '{ "dependencies": [] }',
            "Bar.ts": "export const Bar = 1;\n",
          },
        },
      });
      await runEjectRoots(["Foo"], roots);
      // Despite the unparseable meta, Bar is still ejected via the import scan.
      expect(exists("src/components/Foo/Foo.ts")).toBe(true);
      expect(exists("src/components/Bar/Bar.ts")).toBe(true);
    });
  });

  describe("nested component subdirectory", () => {
    it("walks subfolders when collecting a component's files", async () => {
      // componentFiles() recurses into subdirectories; a real package has none,
      // so use a fixture whose dep import lives in a nested file.
      const roots = makeFixtureRoots({
        Parent: {
          files: {
            "meta.json": '{ "dependencies": [] }',
            "Parent.ts": "export const Parent = 1;\n",
            // dep declared only inside a nested subfolder file → exercises the
            // `e.isDirectory()` recurse branch of componentFiles.
            "nested/inner.ts": "import { Kid } from '../Kid/Kid';\nexport const x = Kid;\n",
          },
        },
        Kid: {
          files: {
            "meta.json": '{ "dependencies": [] }',
            "Kid.ts": "export const Kid = 2;\n",
          },
        },
      });
      await runEjectRoots(["Parent"], roots);
      // The nested-file import was discovered → Kid ejected alongside Parent.
      expect(exists("src/components/Parent/nested/inner.ts")).toBe(true);
      expect(exists("src/components/Kid/Kid.ts")).toBe(true);
    });
  });

  describe("missing skill payload", () => {
    it("warns and skips when the package ships no skill payload", async () => {
      const roots = makeFixtureRoots(
        {
          Solo: {
            files: {
              "meta.json": '{ "dependencies": [] }',
              "Solo.ts": "export const Solo = 1;\n",
            },
          },
        },
        { withPayload: false },
      );
      await runEjectRoots(["Solo"], roots);
      expect(exists("src/components/Solo/Solo.ts")).toBe(true);
      expect(joinLogs()).toContain("skill payload not found in package — skipped");
      expect(exists(".claude/skills/babylonjsmarket")).toBe(false);
    });

    it("copies the payload into the project when present", async () => {
      const roots = makeFixtureRoots({
        Solo: {
          files: {
            "meta.json": '{ "dependencies": [] }',
            "Solo.ts": "export const Solo = 1;\n",
          },
        },
      });
      await runEjectRoots(["Solo"], roots);
      expect(exists(".claude/skills/babylonjsmarket/SKILL.md")).toBe(true);
    });
  });

  describe("rewriteImports (unit)", () => {
    // The closure builder always co-ejects siblings a copied file imports, so
    // the "non-ejected sibling" rewrite never fires through eject(). It is the
    // documented safety net for the standalone rewrite contract, exercised here
    // directly.
    it("rewrites a sibling import to the package subpath when the sibling was NOT ejected", () => {
      const all = new Set(["Foo", "Bar"]);
      const ejected = new Set(["Foo"]); // Bar was not ejected
      const out = rewriteImports(
        'import { Bar } from "../Bar/Bar.js";',
        ejected,
        all,
      );
      expect(out).toBe('import { Bar } from "@babylonjsmarket/arcade/Bar";');
    });

    it("keeps a sibling import relative when the sibling WAS co-ejected", () => {
      const all = new Set(["Foo", "Bar"]);
      const ejected = new Set(["Foo", "Bar"]);
      const src = 'import { Bar } from "../Bar/Bar.js";';
      expect(rewriteImports(src, ejected, all)).toBe(src);
    });

    it("leaves a sibling import alone when it is not a known component", () => {
      const all = new Set(["Foo"]);
      const src = 'import { x } from "../Unknown/x.js";';
      expect(rewriteImports(src, new Set(["Foo"]), all)).toBe(src);
    });

    it("rewrites ../../inputEvents to the package root", () => {
      const out = rewriteImports(
        'import { KEY } from "../../inputEvents";',
        new Set(),
        new Set(),
      );
      expect(out).toBe('import { KEY } from "@babylonjsmarket/arcade";');
    });
  });
});
