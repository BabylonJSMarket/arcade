#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prompts from "@clack/prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function main() {
  // 1. Ask for the generator name
  const name = await prompts.text({ message: "Enter name:" });
  if (prompts.isCancel(name)) {
    prompts.cancel("Operation cancelled");
    process.exit(0);
  }

  const lower = name.toLowerCase();
  const templatesDir = path.join(__dirname, "templates");

  // 2. Your two template filenames
  const templates = ["Data.ts", "Component.ts"];

  const outPaths = ["data/GameData/Shared", "src/components"];

  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    const srcPath = path.join(templatesDir, tmpl);
    const outName = tmpl
      .replace(/^Data\.ts$/, `${name}.ts`)
      .replace(/^Component\.ts$/, `${name}.ts`);
    const outPath = path.resolve(process.cwd(), outPaths[i], outName);

    if (fs.existsSync(outPath)) {
      console.log(`Skipping ${outName} (already exists)`);
      continue;
    }

    let content = fs.readFileSync(srcPath, "utf-8");
    content = content.replace(/Blank/g, name).replace(/blank/g, lower);
    fs.writeFileSync(outPath, content);
    console.log(`Created ${outName}`);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
