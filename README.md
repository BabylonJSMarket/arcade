# My Arcade ECS Library

A lightweight TypeScript Entity-Component-System (ECS) library built for BabylonJS game development. This library provides a clean, flexible architecture for building games and 3D applications with reusable components and systems.

> **Note**: This package excludes the Inspector component which requires React dependencies. If you need inspector functionality, install React separately and import the component directly from the source.

## Features

- 🎮 **ECS Architecture**: Clean separation of data (Components), behavior (Systems), and game objects (Entities)
- 🌐 **BabylonJS Integration**: Built-in components for common BabylonJS functionality
- 📦 **TypeScript Support**: Full TypeScript definitions included
- 🧪 **Well Tested**: Comprehensive test coverage
- 🔧 **Extensible**: Easy to create custom components and systems

## Installation

```bash
npm install my-arcade
```

### Peer Dependencies

This library requires BabylonJS as a peer dependency:

```bash
npm install @babylonjs/core @babylonjs/materials @babylonjs/loaders
```

For inspector functionality (optional):
```bash
npm install @babylonjs/inspector react react-dom
```

### Local Development & Testing

To link this package locally for development:

```bash
# In the my-arcade package directory
npm link

# In your project directory
npm link my-arcade
```

Or install directly from the local package:
```bash
npm install /path/to/my-arcade
```

## Quick Start

```typescript
import { World, Entity, Component, System } from 'my-arcade';
import { CameraComponent, LightingComponent } from 'my-arcade';

// Create a world
const world = new World();

// Create an entity
const entity = new Entity("player");

// Add components
entity.addComponent(new CameraComponent({
  type: "Free",
  offset: [0, 5, -10]
}));

entity.addComponent(new LightingComponent({
  types: ["ambient", "directional"],
  shadows: true,
  offset: [0, 10, 0]
}));

// Add entity to world
world.addEntity(entity);

// Update the world
world.update(deltaTime);
```

## Core ECS Classes

### Entity
Represents a game object that can have multiple components attached.

```typescript
const entity = new Entity("myEntity");
entity.addComponent(component);
entity.getComponent(ComponentClass);
entity.removeComponent(ComponentClass);
```

### Component
Base class for all components. Components hold data but no behavior.

```typescript
class HealthComponent extends Component {
  public health: number;
  public maxHealth: number;

  constructor(data: { health: number; maxHealth: number }) {
    super(data);
    this.health = data.health;
    this.maxHealth = data.maxHealth;
  }
}
```

### System
Systems contain the logic that operates on entities with specific components.

```typescript
class HealthSystem extends System {
  constructor(world: World) {
    super(world, [HealthComponent]);
  }

  processEntity(entity: Entity, deltaTime: number) {
    const health = entity.getComponent(HealthComponent);
    // Process health logic here
  }
}
```

### World
The world manages all entities and systems.

```typescript
const world = new World();
world.addEntity(entity);
world.addSystem(new HealthSystem(world));
world.update(deltaTime);
```

## Built-in Components

### CameraComponent
Provides camera functionality with different camera types.

```typescript
const camera = new CameraComponent({
  type: "Follow", // "Free" | "Static" | "Follow"
  offset: [0, 5, -10],
  target: "player"
});
```

### LightingComponent
Handles scene lighting with ambient and directional lights.

```typescript
const lighting = new LightingComponent({
  types: ["ambient", "directional"],
  shadows: true,
  offset: [0, 10, 5]
});
```

### InspectorComponent (Excluded from Build)
The InspectorComponent is available in the source but excluded from the npm build due to React dependencies. If you need inspector functionality:

1. Install React dependencies: `npm install react react-dom @babylonjs/inspector`
2. Import directly from source: `import { InspectorComponent } from 'my-arcade/src/components/Inspector'`

```typescript
const inspector = new InspectorComponent({
  debugLayerId: "debugLayer",
  triggerKey: "Backquote" // Press ` to toggle inspector
});
```

## Creating Custom Components

```typescript
import { Component } from 'my-arcade';

interface MovementData {
  speed: number;
  direction: Vector3;
}

class MovementComponent extends Component {
  public speed: number;
  public direction: Vector3;

  constructor(data: MovementData) {
    super(data);
    this.speed = data.speed;
    this.direction = data.direction;
  }
}
```

## Creating Custom Systems

```typescript
import { System, World, Entity } from 'my-arcade';

class MovementSystem extends System {
  constructor(world: World) {
    super(world, [MovementComponent]);
  }

  processEntity(entity: Entity, deltaTime: number) {
    const movement = entity.getComponent(MovementComponent);
    // Update entity position based on movement
    entity.position.addInPlace(
      movement.direction.scale(movement.speed * deltaTime)
    );
  }
}
```

## API Reference

### World Methods
- `addEntity(entity: Entity)`: Add an entity to the world
- `removeEntity(entity: Entity)`: Remove an entity from the world
- `addSystem(system: System)`: Add a system to the world
- `update(deltaTime: number)`: Update all systems

### Entity Methods
- `addComponent(component: Component)`: Add a component
- `getComponent<T>(componentClass: new (...args: any[]) => T): T`: Get a component
- `removeComponent(componentClass: any)`: Remove a component
- `hasComponent(componentClass: any): boolean`: Check if entity has component

### Component Properties
- `enabled: boolean`: Whether the component is active
- `loaded: boolean`: Whether the component has finished loading
- `loading: boolean`: Whether the component is currently loading
- `entity: Entity | null`: Reference to the parent entity

## Development

### Local Development
To use this package locally during development:

```bash
# In your game project
npm link my-arcade

# In the my-arcade package directory
npm link
```

### Testing
Run the test suite:

```bash
npm test
```

## Package Structure

```
my-arcade/
├── dist/                    # Built package files
├── src/lib/ECS/            # Core ECS classes
├── src/components/         # Built-in components
├── examples/               # Usage examples
└── index.ts               # Main entry point
```

## Publishing

To publish this package to npm:

```bash
# Build the library
npm run build:lib

# Publish to npm
npm publish
```

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Known Issues

- InspectorComponent requires React dependencies and is excluded from the npm build
- BabylonJS peer dependencies must be installed separately