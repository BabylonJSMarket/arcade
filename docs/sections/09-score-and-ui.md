# Score & UI

Two components handle in-game scoring: `Score` (data + events) and `Scoreboard` (DOM overlay that renders the data). Use them together or just Score if you're rendering UI elsewhere.

## Score

A score tracker keyed by player ID. The Score component is typically attached to a **world-level entity** rather than per-player — it tracks all players' scores in one place.

```ts
export interface ScoreInput {
  scores?: Record<string, number>;  // initial scores keyed by player ID
}

export const ScoreEvents = {
  CHANGED:  'score.changed',
  RESET:    'score.reset',
} as const;

export const ScoreInputEvents = {
  ADD:    'score.add',     // { playerId, delta }
  SET:    'score.set',     // { playerId, value }
  RESET:  'score.reset',
} as const;
```

### JSON

A common pattern: a top-level "World" entity owns the Score component.

```json
"World": {
  "tags": ["global"],
  "components": {
    "Score": { "scores": { "p1": 0, "p2": 0 } }
  }
}
```

### Driving the score from gameplay

When a player picks up a coin, kills an enemy, scores a goal — emit `score.add`:

```ts
this.eventBus.emit('score.add', { playerId: 'p1', delta: 10 });
```

The Score System updates its internal map and emits `score.changed` with the new value. Subscribe to `score.changed` in your UI / sound / particle systems if you want effects when scores update.

## Scoreboard

A DOM overlay that renders the current Score state. It creates a `<div>` outside the canvas, positioned by CSS, and re-renders whenever `score.changed` fires.

```ts
export interface ScoreboardInput {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  fontSize?: number;
  players: Array<{ id: string; label: string; color?: [number, number, number] }>;
}
```

### JSON

```json
"ScoreboardUI": {
  "components": {
    "Scoreboard": {
      "position": "top-right",
      "fontSize": 18,
      "players": [
        { "id": "p1", "label": "Player 1", "color": [1, 0.3, 0.3] },
        { "id": "p2", "label": "Player 2", "color": [0.3, 0.6, 1] }
      ]
    }
  }
}
```

The Scoreboard listens for `score.changed` on the EventBus and re-renders only the affected player's row. It's lightweight DOM work — fine to run alongside your 60fps game loop.

### Custom styling

The Scoreboard renders inline styles. To restyle, pass an explicit `style` field or replace the component with your own Solid/React/whatever UI that subscribes to `score.changed`.

The component is just an event listener + DOM writer — you can absolutely build your own HUD that subscribes to the same events without using Scoreboard at all.

## Common patterns

### Game over on threshold

```ts
this.eventBus.on('score.changed', ({ playerId, value }) => {
  if (value >= 100) {
    this.eventBus.emit('game.over', { winnerId: playerId });
  }
});
```

### Persisting score across scene loads

Save the score state when transitioning out:

```ts
const score = world.getEntitiesByTag('global')[0]?.get(ScoreComponent);
localStorage.setItem('score', JSON.stringify(score?.scores ?? {}));
```

And restore by passing it in via the scene JSON or directly setting it after instantiation.

### Multi-team scoring

Don't fight the API — give each team its own player ID:

```json
"Score": { "scores": { "red": 0, "blue": 0 } }
```

And tag entities `'team-red'` or `'team-blue'` so your gameplay Systems know who scored for whom.

## Where to next

- **[Animation & Mesh](./animation-and-mesh)** — `.glb` loading and skeletal animation
- **[Extending](./extending)** — viz panels, custom registries
