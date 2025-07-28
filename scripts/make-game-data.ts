// /scripts/make-game-data.ts
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const GAMES_DIR = path.resolve(DATA_DIR, "GameData");
const SHARED_DIR = path.resolve(GAMES_DIR, "Shared");
const OUTPUT_DIR = path.resolve(process.cwd(), "public/GameData");
const LEVEL_DIR = "scenes";

const MakeGameData = async (GAME_DIR: string) => {
  const GAME = path.resolve(GAMES_DIR, GAME_DIR);
  if (GAME == SHARED_DIR) return; // 2.
  console.log("Making: ", GAME_DIR);
  const scenes = fs.readdirSync(path.resolve(GAME, LEVEL_DIR));
  for (const scene of scenes) {
    // 3.
    const sceneFile = path.resolve(GAME, LEVEL_DIR, scene);
    console.log("Scene: ", scene, sceneFile);
    const mod = await import(sceneFile);
    const sceneData = mod.default; // 4.
    const dirPath = path.resolve(OUTPUT_DIR, GAME_DIR, LEVEL_DIR);
    const outputFileName = path.resolve(
      dirPath,
      `${scene.replace(".ts", ".json")}`, // 5.
    );
    console.log("Writing: ", outputFileName);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    const data = JSON.stringify(sceneData, null, 2); // 6.
    fs.writeFileSync(outputFileName, data); // 7.
  }
};

const AllGameData = async () => {
  const games = fs.readdirSync(GAMES_DIR);
  for (const game of games) await MakeGameData(game);
};

await AllGameData(); // 1.
process.exit(0);
