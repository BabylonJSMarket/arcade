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

    it("mentions all four templates in the help output", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("empty-3d");
      expect(stdout).toContain("ThirdPerson");
      expect(stdout).toContain("FirstPerson");
      expect(stdout).toContain("json-scene");
    });

    it("documents the @babylonjsmarket/ecs + arcade stack", async () => {
      const { stdout } = await runCli(["--help"], tmpDir);
      expect(stdout).toContain("@babylonjsmarket/ecs");
      expect(stdout).toContain("@babylonjsmarket/arcade");
    });
  });

  describe("empty-3d template", () => {
    it("creates the expected files in the target directory", async () => {
      const { code } = await runCli(
        ["my-project", "-t", "empty-3d", "--overwrite"],
        tmpDir,
      );
      expect(code).toBe(0);

      const projectRoot = path.join(tmpDir, "my-project");
      const expectedFiles = [
        "package.json",
        "vite.config.js",
        "tsconfig.json",
        "index.html",
        "src/main.ts",
        "README.md",
        ".gitignore",
      ];
      for (const file of expectedFiles) {
        expect(
          fs.existsSync(path.join(projectRoot, file)),
          `expected ${file} to exist`,
        ).toBe(true);
      }
    }, 60_000);

    it("generates a package.json with the expected name, type, and dependencies", async () => {
      await runCli(
        ["my-project", "-t", "empty-3d", "--overwrite"],
        tmpDir,
      );
      const projectRoot = path.join(tmpDir, "my-project");
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"),
      );
      expect(pkg.name).toBe("my-project");
      expect(pkg.type).toBe("module");
      expect(pkg.scripts.dev).toBe("vite");
      expect(pkg.scripts.build).toContain("vite build");
      expect(pkg.scripts.preview).toBe("vite preview");
      expect(pkg.dependencies).toMatchObject({
        "@babylonjsmarket/ecs": expect.any(String),
        "@babylonjsmarket/arcade": expect.any(String),
        "@babylonjs/core": expect.any(String),
        "@babylonjs/loaders": expect.any(String),
        "@babylonjs/havok": expect.any(String),
      });
    }, 60_000);

    it("generates src/main.ts that imports from the published ecs+arcade packages, not local folders", async () => {
      await runCli(
        ["my-project", "-t", "empty-3d", "--overwrite"],
        tmpDir,
      );
      const mainTs = fs.readFileSync(
        path.join(tmpDir, "my-project", "src", "main.ts"),
        "utf-8",
      );
      expect(mainTs).toContain('from "@babylonjsmarket/ecs/babylon"');
      expect(mainTs).toContain('from "@babylonjsmarket/arcade"');
      expect(mainTs).not.toMatch(/from\s+["']\.\/lib/);
      expect(mainTs).not.toMatch(/from\s+["']\.\/ECS/);
      expect(mainTs).not.toMatch(/from\s+["']\.\.\/lib/);
      expect(mainTs).not.toMatch(/from\s+["']\.\.\/ECS/);
    }, 60_000);
  });

  describe("ThirdPerson template", () => {
    it("imports KeyboardMover, Movement, and ArcCamera components", async () => {
      const { code } = await runCli(
        ["tp-project", "-t", "ThirdPerson", "--overwrite"],
        tmpDir,
      );
      expect(code).toBe(0);
      const mainTs = fs.readFileSync(
        path.join(tmpDir, "tp-project", "src", "main.ts"),
        "utf-8",
      );
      expect(mainTs).toContain("KeyboardMoverComponent");
      expect(mainTs).toContain("MovementComponent");
      expect(mainTs).toContain("ArcCameraComponent");
    }, 60_000);
  });

  describe("FirstPerson template", () => {
    it("wires a UniversalCamera with pointer-lock and crosshair UI", async () => {
      const { code } = await runCli(
        ["fp-project", "-t", "FirstPerson", "--overwrite"],
        tmpDir,
      );
      expect(code).toBe(0);
      const mainTs = fs.readFileSync(
        path.join(tmpDir, "fp-project", "src", "main.ts"),
        "utf-8",
      );
      // First-person needs the actual mouse-look camera, not ECS movement.
      expect(mainTs).toContain("UniversalCamera");
      expect(mainTs).toContain("requestPointerLock");
      expect(mainTs).toContain("addCrosshair");
    }, 60_000);
  });

  describe("json-scene template", () => {
    it("creates public/scenes/level1.json with the expected entity shape", async () => {
      const { code } = await runCli(
        ["json-project", "-t", "json-scene", "--overwrite"],
        tmpDir,
      );
      expect(code).toBe(0);

      const scenePath = path.join(
        tmpDir,
        "json-project",
        "public",
        "scenes",
        "level1.json",
      );
      expect(fs.existsSync(scenePath)).toBe(true);

      const scene = JSON.parse(fs.readFileSync(scenePath, "utf-8"));
      expect(scene.entities).toBeDefined();
      expect(scene.entities.Player).toBeDefined();
      expect(scene.entities.Camera).toBeDefined();
      expect(scene.entities.Sun).toBeDefined();
      expect(scene.entities.Sky).toBeDefined();
      expect(scene.entities.Ground).toBeDefined();
      expect(scene.entities.Player.tags).toContain("player");
      expect(scene.entities.Player.components.MeshPrimitive.primitive).toBe(
        "capsule",
      );
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
      expect(fs.existsSync(path.join(projectRoot, "src", "main.ts"))).toBe(
        true,
      );
    }, 60_000);
  });

  describe("package name sanitization", () => {
    it("sanitizes a directory name with spaces into a valid package.json name", async () => {
      // The CLI prompts for a package name when the target dir basename is
      // not a valid npm name. The placeholder is the sanitized version, so
      // we just hit return (`\r`) to accept the default.
      const proc = spawn(
        process.execPath,
        [
          CLI_PATH,
          "Invalid Name",
          "-t",
          "empty-3d",
          "--overwrite",
        ],
        { cwd: tmpDir, env: { ...process.env, CI: "true" } },
      );
      const exitCode = await new Promise<number>((resolve) => {
        // Swallow output so the buffer never blocks.
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
      // npm package names: lowercase, no spaces.
      expect(pkg.name).toMatch(/^[a-z0-9][a-z0-9\-._~]*$/);
      expect(pkg.name).not.toContain(" ");
      expect(pkg.name).not.toMatch(/[A-Z]/);
    }, 30_000);
  });
});
