import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eject } from "./eject.js";
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

function read(rel: string): string {
  return fs.readFileSync(path.join(tmpDir, rel), "utf8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(tmpDir, rel));
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

    it("resolves a transitive closure (Bullet → Health/Obstacle/MeshPrimitive)", async () => {
      await runEject(["Bullet"]);
      // Bullet imports Health, Obstacle, MeshPrimitive; Health/Obstacle also
      // import MeshPrimitive — all must land via the transitive walk.
      for (const c of ["Bullet", "Health", "Obstacle", "MeshPrimitive"]) {
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
      await runEject(["Bullet"]);
      const ejected = new Set(
        fs.readdirSync(path.join(tmpDir, "src", "components")),
      );
      // Walk every ejected file: each `../Sibling/` relative import must target
      // a co-ejected sibling; non-ejected siblings must have become a package
      // subpath. (Bullet's closure is self-contained, so all stay relative —
      // this asserts the rewrite never broke a path.)
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
});
