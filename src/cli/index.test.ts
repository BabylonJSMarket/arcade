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

    it("lists every shipped template", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("empty-3d");
      expect(stdout).toContain("top-down-shooter");
      expect(stdout).toContain("pinball");
    });

    it("documents the @babylonjsmarket/ecs + arcade stack", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("@babylonjsmarket/ecs");
      expect(stdout).toContain("@babylonjsmarket/arcade");
    });
  });

  // Every template now scaffolds the same three-file game module:
  //   src/main.ts     — shared tiny boot
  //   src/scene.ts    — per-template entity/component definition
  //   src/registry.ts — per-template HUD panel + custom-component resolvers
  // Plus the standard package.json/vite.config.js/tsconfig.json/index.html/README/.gitignore.
  const COMMON_FILES = [
    "package.json",
    "vite.config.js",
    "tsconfig.json",
    "index.html",
    "src/main.ts",
    "src/scene.ts",
    "src/registry.ts",
    "README.md",
    ".gitignore",
  ];

  describe.each([
    { template: "empty-3d", dir: "my-empty" },
    { template: "top-down-shooter", dir: "my-shooter" },
    { template: "pinball", dir: "my-pinball" },
  ])("$template template", ({ template, dir }) => {
    it("creates every expected file", async () => {
      const { code } = await runCli([dir, "-t", template, "--overwrite"], tmpDir);
      expect(code).toBe(0);
      const projectRoot = path.join(tmpDir, dir);
      for (const file of COMMON_FILES) {
        expect(
          fs.existsSync(path.join(projectRoot, file)),
          `expected ${file} to exist in ${template} scaffold`,
        ).toBe(true);
      }
      // No legacy locations the old CLI used:
      expect(fs.existsSync(path.join(projectRoot, "public", "scenes", "level1.json"))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, "src", "components"))).toBe(false);
    }, 60_000);

    it("generates a package.json with the expected name, type, and dependencies", async () => {
      await runCli([dir, "-t", template, "--overwrite"], tmpDir);
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
        "@babylonjs/core": expect.any(String),
      });
    }, 60_000);

    it("ships the shared tiny main.ts (no per-template branches)", async () => {
      await runCli([dir, "-t", template, "--overwrite"], tmpDir);
      const mainTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "main.ts"),
        "utf-8",
      );
      expect(mainTs).toContain("from '@babylonjsmarket/arcade'");
      expect(mainTs).toContain("from '@babylonjsmarket/ecs/babylon'");
      expect(mainTs).toContain("mountArcadeViz");
      expect(mainTs).toContain("from './scene'");
      expect(mainTs).toContain("from './registry'");
      expect(mainTs).toContain("loadScene(SCENE)");
      // Boot is template-agnostic — no per-game switch statements.
      expect(mainTs).not.toContain("new BulletSystem");
      expect(mainTs).not.toContain("new EnemySystem");
    }, 60_000);

    it("ships a scene.ts that exports SCENE with at least one entity", async () => {
      await runCli([dir, "-t", template, "--overwrite"], tmpDir);
      const sceneTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "scene.ts"),
        "utf-8",
      );
      expect(sceneTs).toContain("export const SCENE");
      expect(sceneTs).toMatch(/entities\s*:/);
    }, 60_000);

    it("ships a registry.ts that exports REGISTRY", async () => {
      await runCli([dir, "-t", template, "--overwrite"], tmpDir);
      const registryTs = fs.readFileSync(
        path.join(tmpDir, dir, "src", "registry.ts"),
        "utf-8",
      );
      expect(registryTs).toContain("export const REGISTRY");
    }, 60_000);
  });

  describe("empty-3d scene content", () => {
    it("includes a Skybox, sun w/ shadows, hero, ground, and ArcCamera", async () => {
      await runCli(["my-empty", "-t", "empty-3d", "--overwrite"], tmpDir);
      const sceneTs = fs.readFileSync(
        path.join(tmpDir, "my-empty", "src", "scene.ts"),
        "utf-8",
      );
      expect(sceneTs).toContain("Skybox");
      expect(sceneTs).toContain("DirectionalLight");
      expect(sceneTs).toContain("shadowEnabled: true");
      expect(sceneTs).toContain("Hero");
      expect(sceneTs).toContain("ArcCamera");
      expect(sceneTs).toContain("target: 'Hero'");
    }, 60_000);
  });

  describe("top-down-shooter scene content", () => {
    it("includes a Player, four corner Spawners, arena walls, and Bullet/Enemy markers on a World entity", async () => {
      await runCli(["my-shooter", "-t", "top-down-shooter", "--overwrite"], tmpDir);
      const sceneTs = fs.readFileSync(
        path.join(tmpDir, "my-shooter", "src", "scene.ts"),
        "utf-8",
      );
      expect(sceneTs).toContain("Player");
      expect(sceneTs).toContain("TwinStickShooter");
      for (const corner of ["Spawner_NW", "Spawner_NE", "Spawner_SW", "Spawner_SE"]) {
        expect(sceneTs).toContain(corner);
      }
      for (const wall of ["Wall_N", "Wall_S", "Wall_E", "Wall_W"]) {
        expect(sceneTs).toContain(wall);
      }
      // Runtime-only systems wired via the singleton World marker entity.
      expect(sceneTs).toContain("Bullet: {}");
      expect(sceneTs).toContain("Enemy: {}");
      expect(sceneTs).toContain("target: 'Player'");
    }, 60_000);
  });

  describe("pinball scene content", () => {
    it("includes a Playfield, flippers, bumpers, plunger, and table dims", async () => {
      await runCli(["my-pinball", "-t", "pinball", "--overwrite"], tmpDir);
      const sceneTs = fs.readFileSync(
        path.join(tmpDir, "my-pinball", "src", "scene.ts"),
        "utf-8",
      );
      expect(sceneTs).toContain("Playfield");
      expect(sceneTs).toContain("Flipper_Left");
      expect(sceneTs).toContain("Flipper_Right");
      expect(sceneTs).toContain("Bumper_Center");
      expect(sceneTs).toContain("Plunger");
      expect(sceneTs).toContain("PinballTable");
      expect(sceneTs).toContain("PinballCamera");
    }, 60_000);
  });

  describe("init subcommand", () => {
    it("accepts `init <name>` as a synonym for the bare positional form", async () => {
      const { code } = await runCli(
        ["init", "my-project2", "-t", "empty-3d", "--overwrite"],
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
        [CLI_PATH, "Invalid Name", "-t", "empty-3d", "--overwrite"],
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
