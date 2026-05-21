---
name: arcade-scaffold
description: Scaffold a new arcade-style game using @babylonjsmarket/arcade. Use when the user asks to "create an arcade game", "start a new arcade project", "scaffold arcade", or names a classic arcade title to build (e.g. "make a breakout clone").
---

# Arcade scaffold

When the user wants to spin up a new arcade game powered by `@babylonjsmarket/arcade`:

1. Run the CLI in the directory the user wants:
   ```bash
   npx @babylonjsmarket/arcade init <project-name>
   ```
2. The CLI presents four templates (basic, first-person, top-down, side-scroller). Pick the one matching the user's request, or ask if ambiguous.
3. After scaffolding:
   - `cd <project-name> && npm install && npm run dev`
   - Open the printed URL.
4. To add a component to an existing arcade project:
   ```bash
   npx @babylonjsmarket/arcade add <ComponentName>
   ```
   Components available: MeshPrimitive, Movement, KeyboardMover, PlayerInput, ArcCamera, CameraFollow, DirectionalLight, HemisphericLight, Physics, Score, Scoreboard, Shadow, Skybox, Animation, Mesh.

## ECS conventions

- Components are pure data; Systems own per-frame logic.
- Systems declare a `query` (`required` / `excluded` / `tags`) in their constructor.
- Communicate between systems via `EventBus`, not direct references.
- Scene JSON declares entities and their components — see the arcade README for the format.
