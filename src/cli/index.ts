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
      "@babylonjs/core": "^7.0.0",
      "@babylonjs/loaders": "^7.0.0",
      "@babylonjs/havok": "^1.3.0",
    },
    devDependencies: {
      typescript: "^5.5.0",
      vite: "^5.0.0",
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
  return `import { World } from "@babylonjsmarket/ecs";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  HemisphericLightComponent,
  HemisphericLightSystem,
  ArcCameraComponent,
  ArcCameraSystem,
} from "@babylonjsmarket/arcade";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const renderer = new BabylonAdapter();
await renderer.init(canvas, { clearColor: [0.05, 0.05, 0.1, 1] });

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));
world.addSystem(new ArcCameraSystem(world.eventBus));

const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 20;
groundMesh.height = 20;
ground.add(groundMesh);

const box = world.createEntity("Box");
const boxMesh = new MeshPrimitiveComponent();
boxMesh.primitive = "box";
boxMesh.position = [0, 1, 0];
box.add(boxMesh);

const sky = world.createEntity("Sky");
sky.add(new HemisphericLightComponent());

const camera = world.createEntity("Camera");
const cam = new ArcCameraComponent();
cam.target = "Box";
cam.radius = 10;
camera.add(cam);

renderer.startLoop((dt) => world.update(dt));

window.addEventListener("resize", () => renderer.resize());
`;
}

function generateThirdPersonTemplate(): string {
  return `import { World } from "@babylonjsmarket/ecs";
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
await renderer.init(canvas, { clearColor: [0.05, 0.05, 0.1, 1] });

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new KeyboardMoverSystem(world.eventBus));
world.addSystem(new MovementSystem(world.eventBus));
world.addSystem(new ArcCameraSystem(world.eventBus));
world.addSystem(new DirectionalLightSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));

const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 50;
groundMesh.height = 50;
ground.add(groundMesh);

const player = world.createEntity("Player");
player.addTag("player");
const playerMesh = new MeshPrimitiveComponent();
playerMesh.primitive = "capsule";
playerMesh.height = 2;
playerMesh.diameter = 1;
playerMesh.position = [0, 1, 0];
player.add(playerMesh);
const mover = new KeyboardMoverComponent();
mover.speed = 8;
player.add(mover);
player.add(new MovementComponent());

const sun = world.createEntity("Sun");
const dir = new DirectionalLightComponent();
dir.direction = [-1, -2, -1];
dir.intensity = 0.9;
sun.add(dir);

const sky = world.createEntity("Sky");
const hemi = new HemisphericLightComponent();
hemi.intensity = 0.3;
sky.add(hemi);

const camera = world.createEntity("Camera");
const cam = new ArcCameraComponent();
cam.target = "Player";
cam.radius = 12;
cam.beta = 1.2;
camera.add(cam);

renderer.startLoop((dt) => world.update(dt));

window.addEventListener("resize", () => renderer.resize());
`;
}

function generateFirstPersonTemplate(): string {
  return `import { World } from "@babylonjsmarket/ecs";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";
import {
  MeshPrimitiveComponent,
  MeshPrimitiveSystem,
  KeyboardMoverComponent,
  KeyboardMoverSystem,
  MovementComponent,
  MovementSystem,
  HemisphericLightComponent,
  HemisphericLightSystem,
  DirectionalLightComponent,
  DirectionalLightSystem,
} from "@babylonjsmarket/arcade";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const renderer = new BabylonAdapter();
await renderer.init(canvas, { clearColor: [0.05, 0.08, 0.12, 1] });

const world = new World({ renderer });
world.addSystem(new MeshPrimitiveSystem(world.eventBus));
world.addSystem(new KeyboardMoverSystem(world.eventBus));
world.addSystem(new MovementSystem(world.eventBus));
world.addSystem(new HemisphericLightSystem(world.eventBus));
world.addSystem(new DirectionalLightSystem(world.eventBus));

const ground = world.createEntity("Ground");
const groundMesh = new MeshPrimitiveComponent();
groundMesh.primitive = "ground";
groundMesh.width = 100;
groundMesh.height = 100;
ground.add(groundMesh);

for (let i = 0; i < 6; i++) {
  const wall = world.createEntity(\`Wall\${i}\`);
  const m = new MeshPrimitiveComponent();
  m.primitive = "box";
  m.position = [Math.random() * 40 - 20, 1.5, Math.random() * 40 - 20];
  m.width = 4;
  m.height = 3;
  m.depth = 0.5;
  wall.add(m);
}

const player = world.createEntity("Player");
player.addTag("player");
const playerMesh = new MeshPrimitiveComponent();
playerMesh.primitive = "capsule";
playerMesh.height = 1.8;
playerMesh.diameter = 0.6;
playerMesh.position = [0, 0.9, 0];
player.add(playerMesh);
const mover = new KeyboardMoverComponent();
mover.speed = 10;
player.add(mover);
player.add(new MovementComponent());

const sun = world.createEntity("Sun");
const dir = new DirectionalLightComponent();
dir.direction = [-1, -2, -1];
sun.add(dir);

const sky = world.createEntity("Sky");
sky.add(new HemisphericLightComponent());

renderer.startLoop((dt) => world.update(dt));

window.addEventListener("resize", () => renderer.resize());
`;
}

function generateJsonSceneTemplate(): string {
  return `import { ArcadeGame } from "@babylonjsmarket/arcade";
import { BabylonAdapter } from "@babylonjsmarket/ecs/babylon";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const game = new ArcadeGame(new BabylonAdapter());
await game.init(canvas);
await game.loadSceneFromUrl("/scenes/level1.json");
game.start();

window.addEventListener("resize", () => game.renderer.resize());
`;
}

function generateJsonSceneFile(): string {
  return JSON.stringify(
    {
      name: "Level1",
      entities: {
        Ground: {
          components: {
            MeshPrimitive: { primitive: "ground", width: 50, height: 50 },
          },
        },
        Player: {
          tags: ["player"],
          components: {
            MeshPrimitive: {
              primitive: "capsule",
              height: 2,
              diameter: 1,
              position: [0, 1, 0],
            },
            KeyboardMover: { speed: 8 },
            Movement: {},
          },
        },
        Sun: {
          components: {
            DirectionalLight: { direction: [-1, -2, -1], intensity: 0.9 },
          },
        },
        Sky: {
          components: {
            HemisphericLight: { intensity: 0.3 },
          },
        },
        Camera: {
          components: {
            ArcCamera: { target: "Player", radius: 12, beta: 1.2 },
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
