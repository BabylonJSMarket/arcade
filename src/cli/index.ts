#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";
import mri from "mri";
import * as prompts from "@clack/prompts";
import colors from "picocolors";
import SETUP_OPTIONS from "./setup-options.js";

const { cyan, green, magenta, yellow } = colors;

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

With no arguments, start the CLI in interactive mode.

Options:
  -t, --template NAME        use a specific template (skip the prompt)
  -h, --help                 print this help message
      --overwrite            replace any existing files in the target directory

Available templates:
  ${cyan("empty-3d")}     A minimal Babylon scene with a ground and a box
  ${yellow("ThirdPerson")}  Capsule player with arc camera, lights, keyboard mover
  ${green("FirstPerson")}  Free-look camera with WASD input
  ${magenta("json-scene")}   Load an arcade-style level from a JSON scene file`;

const TEMPLATES = SETUP_OPTIONS.map(option => option.name);

const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
};

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
            {
              label: "Cancel operation",
              value: "no",
            },
            {
              label: "Remove existing files and continue",
              value: "yes",
            },
            {
              label: "Ignore files and continue",
              value: "ignore",
            },
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

  // 4. Choose a framework and variant
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
        : "Select a framework:",
      options: SETUP_OPTIONS.map((framework) => {
        const frameworkColor = framework.color;
        return {
          label: frameworkColor(framework.display || framework.name),
          value: framework,
        };
      }),
    });
    if (prompts.isCancel(framework)) return cancel();
    template = framework.name;
  }

  const root = path.isAbsolute(targetDir) ? targetDir : path.join(cwd, targetDir);
  fs.mkdirSync(root, { recursive: true });

  const pkgManager = pkgInfo ? pkgInfo.name : "npm";

  const { customCommand } =
    SETUP_OPTIONS.find((v) => v.name === template) ?? {};

  if (customCommand) {
    const fullCustomCommand = getFullCustomCommand(customCommand, pkgInfo);

    const [command, ...args] = fullCustomCommand.split(" ");
    // we replace TARGET_DIR here because targetDir may include a space
    const replacedArgs = args.map((arg) =>
      arg.replace("TARGET_DIR", () => targetDir),
    );
    const { status } = spawn.sync(command, replacedArgs, {
      stdio: "inherit",
    });
    process.exit(status ?? 0);
  }

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

  // Create package.json — depends on the published ECS + arcade packages
  const pkg = {
    name: packageName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      "@babylonjsmarket/ecs": "^0.1.0",
      "@babylonjsmarket/arcade": "^0.1.0",
      "@babylonjs/core": "^9.0.0",
      "@babylonjs/loaders": "^9.0.0",
      "@babylonjs/havok": "^1.3.0",
    },
    devDependencies: {
      typescript: "^5.5.0",
      vite: "^6.0.0",
    },
  };

  write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  // Create vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/materials', '@babylonjs/loaders', '@babylonjs/gui', '@babylonjs/inspector']
  }
});
`;
  write("vite.config.js", viteConfig);

  // Create tsconfig.json
  const tsConfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
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
`;
  write("tsconfig.json", tsConfig);

  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BabylonJS Arcade Game</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        width: 100vw;
        height: 100vh;
      }
      #renderCanvas {
        width: 100%;
        height: 100%;
        touch-action: none;
      }
    </style>
  </head>
  <body>
    <canvas id="renderCanvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  write("index.html", indexHtml);

  // Create main.ts based on template — every template uses the published
  // @babylonjsmarket/ecs and @babylonjsmarket/arcade packages directly.
  let mainTs: string;
  if (template === "ThirdPerson") {
    mainTs = generateThirdPersonTemplate();
  } else if (template === "FirstPerson") {
    mainTs = generateFirstPersonTemplate();
  } else if (template === "json-scene") {
    mainTs = generateJsonSceneTemplate();
    write("public/scenes/level1.json", generateJsonSceneFile());
  } else {
    mainTs = generateEmptySceneTemplate();
  }
  write("src/main.ts", mainTs);

  // Create .gitignore
  const gitignore = `# Logs
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
`;
  write(".gitignore", gitignore);

  // Create README.md
  const readme = `# ${packageName}

A BabylonJS game built with the Arcade ECS framework.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Project Structure

- \`src/main.ts\` - Main entry point
- \`src/components/\` - ECS Components
- \`src/systems/\` - ECS Systems
- \`src/entities/\` - Game entities

## Documentation

For more information about the Arcade ECS framework, visit:
[https://github.com/babylonjsmarket/arcade](https://github.com/babylonjsmarket/arcade)
`;
  write("README.md", readme);

  let doneMessage = "";
  const cdProjectName = path.relative(cwd, root);
  doneMessage += `Done. Now run:\n`;
  if (root !== cwd) {
    doneMessage += `\n  cd ${
      cdProjectName.includes(" ") ? `"${cdProjectName}"` : cdProjectName
    }`;
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

function copy(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
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

function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file);
    const destFile = path.resolve(destDir, file);
    copy(srcFile, destFile);
  }
}

function isEmpty(path: string) {
  const files = fs.readdirSync(path);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === ".git") {
      continue;
    }
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
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  };
}

function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, "utf-8");
  fs.writeFileSync(file, callback(content), "utf-8");
}

function getFullCustomCommand(customCommand: string, pkgInfo?: PkgInfo) {
  const pkgManager = pkgInfo ? pkgInfo.name : "npm";
  const isYarn1 = pkgManager === "yarn" && pkgInfo?.version.startsWith("1.");

  return (
    customCommand
      .replace(/^npm create /, () => {
        // `bun create` uses it's own set of templates,
        // the closest alternative is using `bun x` directly on the package
        if (pkgManager === "bun") {
          return "bun x create-";
        }
        return `${pkgManager} create `;
      })
      // Only Yarn 1.x doesn't support `@version` in the `create` command
      .replace("@latest", () => (isYarn1 ? "" : "@latest"))
      .replace(/^npm exec/, () => {
        // Prefer `pnpm dlx`, `yarn dlx`, or `bun x`
        if (pkgManager === "pnpm") {
          return "pnpm dlx";
        }
        if (pkgManager === "yarn" && !isYarn1) {
          return "yarn dlx";
        }
        if (pkgManager === "bun") {
          return "bun x";
        }
        // Use `npm exec` in all other cases,
        // including Yarn 1.x and other custom npm clients.
        return "npm exec";
      })
  );
}

function generateEmptySceneTemplate(): string {
  return `// Empty 3D Scene — a minimal showcase of the @babylonjsmarket/arcade
// primitives. A glowing cyan sphere over a dark grid floor, dramatic single
// key light, gentle ambient fill. Edit any of the entities below to make it
// yours.
import { World } from "@babylonjsmarket/ecs";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  HemisphericLightComponent,
  HemisphericLightSystem,
  DirectionalLightComponent,
  DirectionalLightSystem,
  ArcCameraComponent,
  ArcCameraSystem,
} from "@babylonjsmarket/arcade";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const renderer = new BabylonAdapter();
await renderer.init(canvas, { clearColor: [0.03, 0.02, 0.08, 1] }); // deep purple

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));
world.addSystem(new DirectionalLightSystem(world.eventBus));
world.addSystem(new ArcCameraSystem(world.eventBus));

// Grid-feel floor — dark base so the hero sphere reads against it.
const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 20;
groundMesh.height = 20;
groundMesh.color = [0.12, 0.08, 0.18];
ground.add(groundMesh);

// Hero sphere — cyan, glowing-ish from the emissive component of its material.
const hero = world.createEntity("Hero");
const heroMesh = new MeshPrimitiveComponent();
heroMesh.primitive = "sphere";
heroMesh.diameter = 2;
heroMesh.segments = 32;
heroMesh.position = [0, 1.5, 0];
heroMesh.material = {
  diffuse: [0.2, 0.7, 1.0],
  emissive: [0.05, 0.2, 0.35],
};
hero.add(heroMesh);

// A small cluster of accent cubes around the hero.
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2;
  const accent = world.createEntity(\`Accent\${i}\`);
  const m = new MeshPrimitiveComponent();
  m.primitive = "box";
  m.width = 0.4;
  m.height = 0.4;
  m.depth = 0.4;
  m.position = [Math.cos(angle) * 3.5, 0.2, Math.sin(angle) * 3.5];
  m.color = [0.9, 0.35, 0.75]; // magenta accents
  accent.add(m);
}

// Single dramatic key light from the upper-right.
const sun = world.createEntity("KeyLight");
const dir = new DirectionalLightComponent();
dir.direction = [-0.6, -1, -0.4];
dir.intensity = 1.1;
dir.diffuse = [1.0, 0.95, 0.85];
sun.add(dir);

// Soft cool fill from below for a subtle two-tone feel.
const fill = world.createEntity("Fill");
const hemi = new HemisphericLightComponent();
hemi.direction = [0, 1, 0];
hemi.intensity = 0.35;
hemi.diffuse = [0.3, 0.4, 0.7];
fill.add(hemi);

// Orbit camera framing the hero.
const cam = world.createEntity("Camera");
const arc = new ArcCameraComponent();
arc.target = "Hero";
arc.radius = 8;
arc.alpha = Math.PI / 4;
arc.beta = Math.PI / 3;
cam.add(arc);

renderer.startLoop((dt) => world.update(dt));
window.addEventListener("resize", () => renderer.resize());

// Helpful on-canvas hint.
addOverlay("Empty 3D Scene — drag to orbit the camera");

function addOverlay(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;top:16px;left:16px;color:#dde;background:rgba(0,0,0,0.4);padding:8px 12px;font:13px/1.4 system-ui,sans-serif;border-radius:6px;pointer-events:none;";
  document.body.appendChild(el);
}
`;
}

function generateThirdPersonTemplate(): string {
  return `// Third Person — game-ready scaffold. A blue capsule "player" runs around a
// grass-green field at sunset, climbing a few platforms. The camera follows
// the player with smoothing. WASD or arrow keys to move.
import { World } from "@babylonjsmarket/ecs";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  KeyboardMoverComponent,
  KeyboardMoverSystem,
  MovementComponent,
  MovementSystem,
  ArcCameraComponent,
  ArcCameraSystem,
  DirectionalLightComponent,
  DirectionalLightSystem,
  HemisphericLightComponent,
  HemisphericLightSystem,
} from "@babylonjsmarket/arcade";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const renderer = new BabylonAdapter();
await renderer.init(canvas, { clearColor: [0.95, 0.55, 0.4, 1] }); // sunset orange

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new KeyboardMoverSystem(world.eventBus));
world.addSystem(new MovementSystem(world.eventBus));
world.addSystem(new ArcCameraSystem(world.eventBus));
world.addSystem(new DirectionalLightSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));

// Grass-green ground.
const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 50;
groundMesh.height = 50;
groundMesh.color = [0.25, 0.45, 0.18];
ground.add(groundMesh);

// A few platforms to navigate.
const platforms = [
  { pos: [8, 0.5, 0] as [number, number, number], size: [4, 1, 4] as [number, number, number] },
  { pos: [-6, 1, -4] as [number, number, number], size: [3, 2, 3] as [number, number, number] },
  { pos: [0, 0.5, 10] as [number, number, number], size: [6, 1, 2] as [number, number, number] },
];
platforms.forEach((p, i) => {
  const e = world.createEntity(\`Platform\${i}\`);
  const m = new MeshPrimitiveComponent();
  m.primitive = "box";
  m.position = p.pos;
  m.width = p.size[0];
  m.height = p.size[1];
  m.depth = p.size[2];
  m.color = [0.5, 0.35, 0.25]; // wooden brown
  e.add(m);
});

// Player capsule — bright blue so it pops against the green ground.
const player = world.createEntity("Player");
player.addTag("player");
const playerMesh = new MeshPrimitiveComponent();
playerMesh.primitive = "capsule";
playerMesh.height = 2;
playerMesh.diameter = 1;
playerMesh.position = [0, 1, 0];
playerMesh.color = [0.2, 0.45, 0.95];
player.add(playerMesh);
const mover = new KeyboardMoverComponent();
mover.speed = 8;
player.add(mover);
player.add(new MovementComponent());

// Golden-hour sun.
const sun = world.createEntity("Sun");
const dir = new DirectionalLightComponent();
dir.direction = [-0.4, -0.9, -0.2];
dir.intensity = 1.0;
dir.diffuse = [1.0, 0.85, 0.65];
sun.add(dir);

// Warm ambient fill so shadows don't go black.
const sky = world.createEntity("Sky");
const hemi = new HemisphericLightComponent();
hemi.intensity = 0.45;
hemi.diffuse = [0.95, 0.75, 0.55];
sky.add(hemi);

// Camera that follows the player (ArcCamera lerps to its target each frame).
const camera = world.createEntity("Camera");
const arc = new ArcCameraComponent();
arc.target = "Player";
arc.radius = 14;
arc.beta = 1.15;
arc.alpha = -Math.PI / 2;
camera.add(arc);

renderer.startLoop((dt) => world.update(dt));
window.addEventListener("resize", () => renderer.resize());

addOverlay("Third Person — WASD or arrow keys to move");

function addOverlay(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;top:16px;left:16px;color:#fff;background:rgba(0,0,0,0.5);padding:8px 12px;font:13px/1.4 system-ui,sans-serif;border-radius:6px;pointer-events:none;";
  document.body.appendChild(el);
}
`;
}

function generateFirstPersonTemplate(): string {
  return `// First Person — FPS-style scaffold. Real pointer-lock + WASD/arrow-keys
// camera (Babylon's UniversalCamera, attached directly to the scene because
// the arcade package doesn't yet ship a FirstPersonCamera component).
// Walls form a small corridor maze. Click the canvas to lock the cursor.
import { World } from "@babylonjsmarket/ecs";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  HemisphericLightComponent,
  HemisphericLightSystem,
  DirectionalLightComponent,
  DirectionalLightSystem,
} from "@babylonjsmarket/arcade";
import { UniversalCamera, Vector3 } from "@babylonjs/core";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const renderer = new BabylonAdapter();
await renderer.init(canvas, { clearColor: [0.06, 0.06, 0.08, 1] }); // night gray

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));
world.addSystem(new DirectionalLightSystem(world.eventBus));

// Concrete-grey ground.
const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 60;
groundMesh.height = 60;
groundMesh.color = [0.35, 0.36, 0.4];
ground.add(groundMesh);

// Corridor walls — a simple zig-zag layout, not random scatter.
const wallLayout: Array<[number, number, number, number]> = [
  // [x, z, width, depth]
  [10, 0, 0.5, 12], [10, 12, 12, 0.5], [22, 12, 0.5, 10],
  [-10, 0, 0.5, 14], [-10, 14, 14, 0.5], [-24, 14, 0.5, 12],
  [0, -10, 16, 0.5], [-8, -16, 0.5, 12],
];
wallLayout.forEach(([x, z, w, d], i) => {
  const wall = world.createEntity(\`Wall\${i}\`);
  const m = new MeshPrimitiveComponent();
  m.primitive = "box";
  m.position = [x, 1.5, z];
  m.width = w;
  m.height = 3;
  m.depth = d;
  m.color = [0.55, 0.45, 0.4]; // warm brick
  wall.add(m);
});

// A couple of accent emissive blocks to draw the eye.
[[6, -4, [1, 0.3, 0.3]], [-15, 8, [0.3, 1, 0.6]]].forEach(([x, z, c], i) => {
  const e = world.createEntity(\`Beacon\${i}\`);
  const m = new MeshPrimitiveComponent();
  m.primitive = "box";
  m.position = [x as number, 0.5, z as number];
  m.width = 1;
  m.height = 1;
  m.depth = 1;
  m.material = { diffuse: c as [number, number, number], emissive: [(c as number[])[0] * 0.4, (c as number[])[1] * 0.4, (c as number[])[2] * 0.4] };
  e.add(m);
});

// Cool dim ambient — feels indoor-ish.
const sky = world.createEntity("Sky");
const hemi = new HemisphericLightComponent();
hemi.intensity = 0.45;
hemi.diffuse = [0.7, 0.75, 0.95];
sky.add(hemi);

// Stronger directional from above for some definition.
const sun = world.createEntity("Sun");
const dir = new DirectionalLightComponent();
dir.direction = [-0.3, -1, -0.4];
dir.intensity = 0.7;
sun.add(dir);

// First-person camera. The arcade package doesn't ship a FirstPersonCamera
// component yet, so we attach Babylon's UniversalCamera directly to the
// adapter's scene. \`renderer.scene\` is the live Babylon scene.
const fpCam = new UniversalCamera("FPSCamera", new Vector3(0, 1.7, -5), renderer.scene!);
fpCam.setTarget(new Vector3(0, 1.7, 0));
fpCam.attachControl(canvas, true);
fpCam.speed = 0.3;
fpCam.angularSensibility = 2000;
fpCam.keysUp = [87, 38];     // W, ArrowUp
fpCam.keysDown = [83, 40];   // S, ArrowDown
fpCam.keysLeft = [65, 37];   // A, ArrowLeft
fpCam.keysRight = [68, 39];  // D, ArrowRight
renderer.scene!.activeCamera = fpCam;

// Pointer-lock on click.
canvas.addEventListener("click", () => canvas.requestPointerLock?.());

renderer.startLoop((dt) => world.update(dt));
window.addEventListener("resize", () => renderer.resize());

addOverlay("First Person — click to lock cursor, WASD/arrows + mouse");
addCrosshair();

function addOverlay(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;top:16px;left:16px;color:#dde;background:rgba(0,0,0,0.5);padding:8px 12px;font:13px/1.4 system-ui,sans-serif;border-radius:6px;pointer-events:none;";
  document.body.appendChild(el);
}

function addCrosshair() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:50%;left:50%;width:6px;height:6px;margin:-3px 0 0 -3px;background:#fff;border-radius:50%;opacity:0.6;pointer-events:none;mix-blend-mode:difference;";
  document.body.appendChild(el);
}
`;
}

function generateJsonSceneTemplate(): string {
  return `// JSON Scene — data-driven scaffold. The entire scene lives in
// public/scenes/level1.json. Edit the JSON, hot-reload, no rebuild needed
// for level changes. main.ts stays this small forever.
import { ArcadeGame } from "@babylonjsmarket/arcade";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const game = new ArcadeGame(new BabylonAdapter());
await game.init(canvas);
await game.loadSceneFromUrl("/scenes/level1.json");
game.start();

window.addEventListener("resize", () => game.renderer.resize());

addOverlay("JSON Scene — edit public/scenes/level1.json then refresh");

function addOverlay(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;top:16px;left:16px;color:#fff;background:rgba(0,0,0,0.5);padding:8px 12px;font:13px/1.4 system-ui,sans-serif;border-radius:6px;pointer-events:none;";
  document.body.appendChild(el);
}
`;
}

function generateJsonSceneFile(): string {
  return JSON.stringify(
    {
      name: "Level1",
      clearColor: [0.15, 0.25, 0.45, 1],
      entities: {
        Ground: {
          components: {
            MeshPrimitive: {
              primitive: "ground",
              width: 40,
              height: 40,
              color: [0.2, 0.35, 0.55],
            },
          },
        },
        // A ring of pillars around the spawn point.
        Pillar0: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [6, 2, 0], color: [0.85, 0.7, 0.5] } } },
        Pillar1: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [4.24, 2, 4.24], color: [0.85, 0.7, 0.5] } } },
        Pillar2: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [0, 2, 6], color: [0.85, 0.7, 0.5] } } },
        Pillar3: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [-4.24, 2, 4.24], color: [0.85, 0.7, 0.5] } } },
        Pillar4: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [-6, 2, 0], color: [0.85, 0.7, 0.5] } } },
        Pillar5: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [-4.24, 2, -4.24], color: [0.85, 0.7, 0.5] } } },
        Pillar6: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [0, 2, -6], color: [0.85, 0.7, 0.5] } } },
        Pillar7: { components: { MeshPrimitive: { primitive: "cylinder", height: 4, diameter: 1, position: [4.24, 2, -4.24], color: [0.85, 0.7, 0.5] } } },
        // Centre obelisk — emissive teal to draw the eye.
        Obelisk: {
          components: {
            MeshPrimitive: {
              primitive: "box",
              width: 1.2,
              height: 5,
              depth: 1.2,
              position: [0, 2.5, 0],
              color: [0.2, 0.85, 0.8],
            },
          },
        },
        Player: {
          tags: ["player"],
          components: {
            MeshPrimitive: {
              primitive: "capsule",
              height: 2,
              diameter: 1,
              position: [0, 1, 12],
              color: [0.95, 0.4, 0.4],
            },
            KeyboardMover: { speed: 8 },
            Movement: {},
          },
        },
        Sun: {
          components: {
            DirectionalLight: { direction: [-0.5, -1, -0.3], intensity: 0.9, diffuse: [1.0, 0.95, 0.8] },
          },
        },
        Sky: {
          components: {
            HemisphericLight: { intensity: 0.45, diffuse: [0.7, 0.8, 1.0] },
          },
        },
        Camera: {
          components: {
            ArcCamera: { target: "Player", radius: 16, beta: 1.1, alpha: -1.5708 },
          },
        },
      },
    },
    null,
    2,
  );
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});
