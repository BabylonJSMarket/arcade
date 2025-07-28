// File: main.ts
import { World } from "./lib/ECS";

// 2. On Browser Load, Load the Game.
document.addEventListener("DOMContentLoaded", async () => {
  // 3. Figure out what to load from Params with some defaults.
  const params = new URLSearchParams(location.search);
  const gameName = params.get("game") || "Arcade";
  const level = params.get("scene") || params.get("level") || "0";
  const canvasId = "renderCanvas";

  // 4. Initialize the Game and load scene data and code.
  const world = new World(canvasId);
  await world.loadSceneData(level, gameName);
  world.start();
});
