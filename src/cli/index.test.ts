import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const CLI_PATH = path.join(PACKAGE_ROOT, "dist", "cli", "index.js");

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runCli(args: string[], cwd: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI_PATH, ...args],
      {
        cwd,
        env: { ...process.env, CI: "true" },
      },
    );
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: typeof e.code === "number" ? e.code : 1,
    };
  }
}

describe("arcade CLI", () => {
  let tmpDir: string;

  beforeAll(async () => {
    if (!fs.existsSync(CLI_PATH)) {
      await execFileAsync("npm", ["run", "build"], {
        cwd: PACKAGE_ROOT,
        env: { ...process.env, CI: "true" },
      });
    }
    expect(fs.existsSync(CLI_PATH)).toBe(true);
  }, 120_000);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "arcade-cli-test-"));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("--help", () => {
    it("prints usage and exits 0", async () => {
      const { stdout, code } = await runCli(["--help"], tmpDir);
      expect(code).toBe(0);
      expect(stdout).toContain("Usage: arcade init");
    });

    it("describes the multigame arcade scaffold (no template choice)", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("arcade room");
      expect(stdout).not.toContain("--template");
    });

    it("documents the @babylonjsmarket/ecs + arcade stack", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("@babylonjsmarket/ecs");
      expect(stdout).toContain("@babylonjsmarket/arcade");
    });
  });

  // The scaffold is a single multigame arcade — no template flag. It ships:
  //   src/main.ts             — tiny boot (loads the default scene)
  //   src/scenes/index.ts     — the scene map (the multigame seam)
  //   src/scenes/arcade-room.ts — the starter room scene (pure data)
  //   src/registry.ts         — shared component resolvers
  // Plus the standard package.json/vite.config.js/tsconfig.json/index.html/README/.gitignore.
  const COMMON_FILES = [
    "package.json",
    "vite.config.js",
    "tsconfig.json",
    "index.html",
    "src/main.ts",
    "src/scenes/index.ts",
    "src/scenes/arcade-room.ts",
    "src/registry.ts",
    "src/vite-env.d.ts",
    "README.md",
    ".gitignore",
  ];

  describe("scaffold", () => {
    const dir = "my-arcade";

    it("creates every expected file", async () => {
      const { code } = await runCli([dir, "--overwrite"], tmpDir);
      expect(code).toBe(0);
      const projectRoot = path.join(tmpDir, dir);
      for (const file of COMMON_FILES) {
        expect(
          fs.existsSync(path.join(projectRoot, file)),
          `expected ${file} to exist in the arcade scaffold`,
        ).toBe(true);
      }
      // No legacy single-scene layout the old CLI used.
      expect(fs.existsSync(path.join(projectRoot, "src", "scene.ts"))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, "src", "components"))).toBe(false);
    }, 60_000);

    it("generates a package.json with the expected name, type, and dependencies", async () => {
      await runCli([dir, "--overwrite"], tmpDir);
      const pkg = JSON.parse(
        fs.readFileSync(path.join(tmpDir, dir, "package.json"), "utf-8"),
      );
      expect(pkg.name).toBe(dir);
      expect(pkg.type).toBe("module");
      expect(pkg.scripts.dev).toBe("vite");
      expect(pkg.scripts.build).toContain("vite build");
      expect(pkg.scripts.preview).toBe("vite preview");
      expect(pkg.dependencies).toMatchObject({
        "@babylonjsmarket/ecs": expect.any(String),
        "@babylonjsmarket/arcade": expect.any(String),
        // viz must be a real dep: main.ts boots arcade/viz, which pulls in
        // @babylonjsmarket/viz + every component panel. Without it a fresh
        // scaffold fails to load (the panels' viz imports go unresolved).
        "@babylonjsmarket/viz": expect.any(String),
        "@babylonjs/core": expect.any(String),
      });
    }, 60_000);

    it("ships a tiny main.ts that loads the default scene (and honors ?scene=)", async () => {
      await runCli([dir, "--overwrite"], tmpDir);
      const mainTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "main.ts"),
        "utf-8",
      );
      expect(mainTs).toContain("from '@babylonjsmarket/arcade'");
      expect(mainTs).toContain("from '@babylonjsmarket/ecs/babylon'");
      expect(mainTs).toContain("mountArcadeViz");
      // The Esc gear/FPS menu + themed panels come from the viz renderer; the
      // scaffold must mount it (and pull a theme) or panels render bare.
      expect(mainTs).toContain("mountViz");
      expect(mainTs).toContain("from '@babylonjsmarket/viz/solid'");
      expect(mainTs).toContain("@babylonjsmarket/viz/themes/");
      expect(mainTs).toContain("from './scenes'");
      expect(mainTs).toContain("from './registry'");
      expect(mainTs).toContain("loadScene(scene");
      // ?scene=<url> override — how `bjs download` previews a downloaded asset.
      expect(mainTs).toContain("loadSceneFromUrl");
      expect(mainTs).toContain("'scene'");
    }, 60_000);

    it("ships a scenes/index.ts exposing the scene map (multigame seam)", async () => {
      await runCli([dir, "--overwrite"], tmpDir);
      const indexTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "scenes", "index.ts"),
        "utf-8",
      );
      expect(indexTs).toContain("export const SCENES");
      expect(indexTs).toContain("DEFAULT_SCENE");
      expect(indexTs).toContain("'arcade-room'");
      expect(indexTs).toContain("from './arcade-room'");
    }, 60_000);

    it("ships a registry.ts that auto-discovers downloaded components", async () => {
      await runCli([dir, "--overwrite"], tmpDir);
      const registryTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "registry.ts"),
        "utf-8",
      );
      expect(registryTs).toContain("export const REGISTRY");
      // Auto-glob: components dropped by `bjs download` into
      // src/Components/<Name>/<Name>.ts are registered with zero manual wiring.
      expect(registryTs).toContain("import.meta.glob('./Components/*/*.ts')");
      // …and `arcade eject`'s lowercase target is globbed too.
      expect(registryTs).toContain("import.meta.glob('./components/*/*.ts')");
      // No hand-maintained literal object body to keep in sync.
      expect(registryTs).not.toContain("export const REGISTRY = {}");
    }, 60_000);
  });

  describe("arcade-room scene content", () => {
    it("includes a textured carpet floor, walls, cabinets, lighting, and a camera", async () => {
      await runCli(["my-arcade", "--overwrite"], tmpDir);
      const sceneTs = fs.readFileSync(
        path.join(tmpDir, "my-arcade", "src", "scenes", "arcade-room.ts"),
        "utf-8",
      );
      expect(sceneTs).toContain("export const ARCADE_ROOM");
      expect(sceneTs).toMatch(/entities\s*:/);
      // Textured PBR floor — the capability the arcade package adds.
      expect(sceneTs).toContain("Floor");
      expect(sceneTs).toContain("albedoTexture");
      // Remote assets stream from the public BabylonJS Games host.
      expect(sceneTs).toContain("babylonjsgames.com");
      // Room shell + cabinets + camera.
      for (const wall of ["Wall_N", "Wall_S", "Wall_E", "Wall_W"]) {
        expect(sceneTs).toContain(wall);
      }
      expect(sceneTs).toContain("Cabinet_1");
      expect(sceneTs).toContain("ArcCamera");
    }, 60_000);
  });

  describe("--demo (renderer-adapter comparison)", () => {
    const dir = "my-demo";

    it("documents the --demo flag in --help", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("--demo");
    });

    it("scaffolds the comparison scene instead of the arcade room", async () => {
      const { code } = await runCli([dir, "--demo", "--overwrite"], tmpDir);
      expect(code).toBe(0);
      const root = path.join(tmpDir, dir);
      expect(fs.existsSync(path.join(root, "src", "scenes", "compare.ts"))).toBe(true);
      // The demo replaces the arcade room.
      expect(fs.existsSync(path.join(root, "src", "scenes", "arcade-room.ts"))).toBe(false);
    }, 60_000);

    it("adds the Three (Rapier) + Babylon Lite engine deps", async () => {
      await runCli([dir, "--demo", "--overwrite"], tmpDir);
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, dir, "package.json"), "utf-8"));
      expect(pkg.dependencies).toMatchObject({
        "@babylonjs/lite": expect.any(String),
        "@dimforge/rapier3d-compat": expect.any(String),
      });
      // three loads from a CDN (import map); only its types are local.
      expect(pkg.devDependencies).toMatchObject({ "@types/three": expect.any(String) });
    }, 60_000);

    it("boots all three adapters into three labelled canvases", async () => {
      await runCli([dir, "--demo", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, dir);
      const mainTs = fs.readFileSync(path.join(root, "src", "main.ts"), "utf-8");
      expect(mainTs).toContain("from '@babylonjsmarket/ecs/babylon'");
      expect(mainTs).toContain("from '@babylonjsmarket/ecs/three'");
      expect(mainTs).toContain("from '@babylonjsmarket/ecs/babylon-lite'");
      const html = fs.readFileSync(path.join(root, "index.html"), "utf-8");
      for (const id of ["cv-babylon", "cv-three", "cv-lite"]) {
        expect(html).toContain(`id="${id}"`);
      }
      // Three's runtime import resolves via the import map (CDN).
      expect(html).toContain("importmap");
      expect(html).toContain("esm.sh/three");
    }, 60_000);

    it("extends vite dedupe/optimize for the extra engines", async () => {
      await runCli([dir, "--demo", "--overwrite"], tmpDir);
      const vite = fs.readFileSync(path.join(tmpDir, dir, "vite.config.js"), "utf-8");
      expect(vite).toContain("@dimforge/rapier3d-compat");
      expect(vite).toContain("@babylonjs/lite");
    }, 60_000);
  });

  describe("--renderer (engine choice)", () => {
    it("documents --renderer in --help", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("--renderer");
      expect(stdout).toContain("babylon-lite");
      expect(stdout).toContain("three");
    });

    it("defaults to Babylon (Havok) with no flag", async () => {
      await runCli(["d", "--overwrite"], tmpDir);
      const main = fs.readFileSync(path.join(tmpDir, "d", "src", "main.ts"), "utf-8");
      expect(main).toContain("new BabylonAdapter()");
      expect(main).toContain("from '@babylonjsmarket/ecs/babylon'");
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, "d", "package.json"), "utf-8"));
      expect(pkg.dependencies).toHaveProperty("@babylonjs/core");
      expect(pkg.dependencies).toHaveProperty("@babylonjs/havok");
    }, 60_000);

    it("--renderer three wires the Three adapter + Rapier + a three import map", async () => {
      await runCli(["d", "--renderer", "three", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, "d");
      const main = fs.readFileSync(path.join(root, "src", "main.ts"), "utf-8");
      expect(main).toContain("new ThreeAdapter()");
      expect(main).toContain("from '@babylonjsmarket/ecs/three'");
      expect(main).not.toContain("BabylonAdapter");
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
      expect(pkg.dependencies).toHaveProperty("@dimforge/rapier3d-compat");
      expect(pkg.dependencies).not.toHaveProperty("@babylonjs/core"); // three is CDN
      expect(pkg.devDependencies).toHaveProperty("@types/three");
      const html = fs.readFileSync(path.join(root, "index.html"), "utf-8");
      expect(html).toContain("esm.sh/three");
      const vite = fs.readFileSync(path.join(root, "vite.config.js"), "utf-8");
      expect(vite).toContain("@dimforge/rapier3d-compat");
    }, 60_000);

    it("--renderer babylon-lite wires the Lite adapter + Havok, no three import map", async () => {
      await runCli(["d", "--renderer", "babylon-lite", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, "d");
      const main = fs.readFileSync(path.join(root, "src", "main.ts"), "utf-8");
      expect(main).toContain("new BabylonLiteAdapter()");
      expect(main).toContain("from '@babylonjsmarket/ecs/babylon-lite'");
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
      expect(pkg.dependencies).toHaveProperty("@babylonjs/lite");
      expect(pkg.dependencies).toHaveProperty("@babylonjs/havok");
      const html = fs.readFileSync(path.join(root, "index.html"), "utf-8");
      expect(html).not.toContain("esm.sh/three");
    }, 60_000);

    it("rejects an unknown --renderer without scaffolding", async () => {
      const { code } = await runCli(["d", "--renderer", "unreal", "--overwrite"], tmpDir);
      expect(code).not.toBe(0);
      expect(fs.existsSync(path.join(tmpDir, "d", "package.json"))).toBe(false);
    }, 60_000);
  });

  describe("--kind (game vs arcade)", () => {
    it("documents --kind in --help", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("--kind");
      expect(stdout).toContain("game");
      expect(stdout).toContain("arcade");
    });

    it("defaults to the arcade room (no flag) — the multigame seam", async () => {
      await runCli(["d", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, "d");
      expect(fs.existsSync(path.join(root, "src", "scenes", "arcade-room.ts"))).toBe(true);
      expect(fs.existsSync(path.join(root, "src", "scenes", "game.ts"))).toBe(false);
      const idx = fs.readFileSync(path.join(root, "src", "scenes", "index.ts"), "utf-8");
      expect(idx).toContain("ARCADE_ROOM");
      expect(idx).toContain("'arcade-room'");
    }, 60_000);

    it("--kind game scaffolds a single starter game scene instead of the room", async () => {
      const { code } = await runCli(["d", "--kind", "game", "--overwrite"], tmpDir);
      expect(code).toBe(0);
      const root = path.join(tmpDir, "d");
      // The single game replaces the arcade room.
      expect(fs.existsSync(path.join(root, "src", "scenes", "game.ts"))).toBe(true);
      expect(fs.existsSync(path.join(root, "src", "scenes", "arcade-room.ts"))).toBe(false);

      const sceneTs = fs.readFileSync(path.join(root, "src", "scenes", "game.ts"), "utf-8");
      expect(sceneTs).toContain("export const GAME");
      expect(sceneTs).toMatch(/entities\s*:/);
      expect(sceneTs).toContain("Hero");
      expect(sceneTs).toContain("ArcCamera");
      // The single game is asset-free (no remote streaming, no cabinets).
      expect(sceneTs).not.toContain("babylonjsgames.com");
      expect(sceneTs).not.toContain("Cabinet");

      const idx = fs.readFileSync(path.join(root, "src", "scenes", "index.ts"), "utf-8");
      expect(idx).toContain("GAME");
      expect(idx).toContain("DEFAULT_SCENE");
      expect(idx).toContain("'game'");

      // Shared framework wiring is identical to the arcade kind.
      expect(fs.existsSync(path.join(root, "src", "registry.ts"))).toBe(true);
      const main = fs.readFileSync(path.join(root, "src", "main.ts"), "utf-8");
      expect(main).toContain("new BabylonAdapter()");
    }, 60_000);

    it("--kind arcade is explicit-equivalent to the default", async () => {
      await runCli(["d", "--kind", "arcade", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, "d");
      expect(fs.existsSync(path.join(root, "src", "scenes", "arcade-room.ts"))).toBe(true);
      expect(fs.existsSync(path.join(root, "src", "scenes", "game.ts"))).toBe(false);
    }, 60_000);

    it("--kind game composes with --renderer three", async () => {
      await runCli(["d", "--kind", "game", "--renderer", "three", "--overwrite"], tmpDir);
      const root = path.join(tmpDir, "d");
      expect(fs.existsSync(path.join(root, "src", "scenes", "game.ts"))).toBe(true);
      const main = fs.readFileSync(path.join(root, "src", "main.ts"), "utf-8");
      expect(main).toContain("new ThreeAdapter()");
    }, 60_000);

    it("the game README reflects the single-game kind", async () => {
      await runCli(["d", "--kind", "game", "--overwrite"], tmpDir);
      const readme = fs.readFileSync(path.join(tmpDir, "d", "README.md"), "utf-8");
      expect(readme).toContain("src/scenes/game.ts");
      expect(readme).not.toContain("row of\ncabinets");
    }, 60_000);

    it("rejects an unknown --kind without scaffolding", async () => {
      const { code } = await runCli(["d", "--kind", "platformer", "--overwrite"], tmpDir);
      expect(code).not.toBe(0);
      expect(fs.existsSync(path.join(tmpDir, "d", "package.json"))).toBe(false);
    }, 60_000);
  });

  describe("init subcommand", () => {
    it("accepts `init <name>` as a synonym for the bare positional form", async () => {
      const { code } = await runCli(
        ["init", "my-project2", "--overwrite"],
        tmpDir,
      );
      expect(code).toBe(0);
      const projectRoot = path.join(tmpDir, "my-project2");
      expect(fs.existsSync(path.join(projectRoot, "package.json"))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, "src", "main.ts"))).toBe(true);
    }, 60_000);
  });

  describe("package name sanitization", () => {
    it("sanitizes a directory name with spaces into a valid package.json name", async () => {
      const proc = spawn(
        process.execPath,
        [CLI_PATH, "Invalid Name", "--overwrite"],
        { cwd: tmpDir, env: { ...process.env, CI: "true" } },
      );
      const exitCode = await new Promise<number>((resolve) => {
        proc.stdout.on("data", () => {});
        proc.stderr.on("data", () => {});
        setTimeout(() => proc.stdin.write("\r"), 500);
        setTimeout(() => proc.stdin.end(), 1500);
        proc.on("exit", (c) => resolve(c ?? 0));
      });
      expect(exitCode).toBe(0);

      const projectRoot = path.join(tmpDir, "Invalid Name");
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"),
      );
      expect(pkg.name).toMatch(/^[a-z0-9][a-z0-9\-._~]*$/);
      expect(pkg.name).not.toContain(" ");
      expect(pkg.name).not.toMatch(/[A-Z]/);
    }, 30_000);
  });
});
