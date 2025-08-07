# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit testing with **real Babylon.js modules** running in a headless NullEngine environment. Tests can be placed next to your source files using the `.test.ts` extension.

## Getting Started

### Running Tests

```bash
# Run tests in watch mode (default)
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui
```

### Test File Location

You can place test files next to your components:

```
src/
├── components/
│   ├── Camera.ts
│   ├── Camera.test.ts
│   ├── Lighting.ts
│   └── Lighting.test.ts
└── lib/
    └── ECS/
        ├── Component.ts
        ├── Component.test.ts
        ├── Entity.ts
        ├── Entity.test.ts
        ├── System.ts
        ├── System.test.ts
        ├── World.ts
        ├── World.test.ts
        └── index.ts
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { YourComponent } from './YourComponent';

describe('YourComponent', () => {
  it('should do something', () => {
    const component = new YourComponent({ /* test data */ });
    expect(component.someProperty).toBe('expected value');
  });
});
```

### Testing BabylonJS Components

The project uses **real Babylon.js modules** with a headless NullEngine for testing. Import test helpers from `~/test/helpers`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Vector3, NullEngine, Scene } from '@babylonjs/core';
import { 
  createTestEngine,
  createTestScene,
  createTestWorld,
  createTestEntity,
  cleanupBabylonObjects,
  expectVector3ToEqual
} from '../test/helpers';
import { YourComponent, YourSystem } from './YourComponent';

describe('YourComponent', () => {
  let engine: NullEngine;
  let scene: Scene;
  
  beforeEach(() => {
    engine = createTestEngine();
    scene = createTestScene(engine);
  });
  
  afterEach(() => {
    cleanupBabylonObjects(scene, engine);
  });

  it('should create component with real Babylon.js objects', () => {
    const component = new YourComponent({
      type: 'Free',
      offset: [0, 1, 0]
    });
    
    expect(component.offset).toBeInstanceOf(Vector3);
    expectVector3ToEqual(component.offset, { x: 0, y: 1, z: 0 });
  });
});
```

### Available Test Helpers

#### Engine and Scene Creation
- `createTestEngine()` - Creates a real NullEngine for headless testing
- `createTestScene(engine?)` - Creates a real Babylon.js Scene
- `cleanupBabylonObjects(...objects)` - Properly dispose Babylon.js objects

#### Real Babylon.js Object Creators
- `createTestVector3(x, y, z)` - Creates a real Vector3
- `createTestCamera(name, position, scene)` - Creates a real UniversalCamera
- `createTestHemisphericLight(name, direction, scene)` - Creates a real HemisphericLight
- `createTestDirectionalLight(name, direction, scene)` - Creates a real DirectionalLight

#### ECS Test Helpers
- `createTestWorld(canvasId?)` - Creates a mock world (avoids Engine initialization issues)
- `createTestEntity(name, scene?)` - Creates a real Entity (extends Babylon.js Mesh)
- `createTestComponentWithData(ComponentClass, data)` - Helper for creating components
- `createTestSystemWithWorld(SystemClass, world, componentClasses)` - Helper for creating systems

#### Utility Functions
- `expectVector3ToEqual(actual, expected, tolerance?)` - Custom Vector3 assertion with tolerance
- `mockFetchForSceneData(sceneData)` - Mock fetch for World scene loading tests

### Example: Testing a Component

```typescript
import { describe, it, expect } from 'vitest';
import { Vector3 } from '@babylonjs/core';
import { expectVector3ToEqual, createCameraComponentData } from '../test/helpers';
import { CameraComponent } from './Camera';

describe('CameraComponent', () => {
  it('should initialize with correct type and real Vector3', () => {
    const data = createCameraComponentData('Follow', [0, 5, -10]);
    const component = new CameraComponent(data);
    
    expect(component.type).toBe('Follow');
    expect(component.offset).toBeInstanceOf(Vector3);
    expectVector3ToEqual(component.offset, { x: 0, y: 5, z: -10 });
  });
});
```

### Example: Testing a System

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Vector3, NullEngine, Scene } from '@babylonjs/core';
import { 
  createTestEngine,
  createTestScene, 
  createTestWorld,
  createTestEntity,
  cleanupBabylonObjects
} from '../test/helpers';
import { CameraSystem, CameraComponent } from './Camera';

describe('CameraSystem', () => {
  let system: CameraSystem;
  let world: any;
  let entity: any;
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = createTestEngine();
    scene = createTestScene(engine);
    world = createTestWorld();
    world.currentScene = scene;
    
    system = new CameraSystem(world, [CameraComponent]);
    entity = new Entity('TestCamera');
    entity.addComponent(new CameraComponent({
      type: 'Free',
      offset: [0, 5, -10]
    }));
    world.entities.set(entity.name, entity);
  });

  afterEach(() => {
    cleanupBabylonObjects(scene, engine);
  });

  it('should create real UniversalCamera on load', () => {
    system.loadEntity(entity);
    
    const component = entity.getComponent(CameraComponent);
    expect(component.camera).toBeDefined();
    expect(component.camera.name).toBe('UniversalCamera');
    expect(component.loaded).toBe(true);
  });
});
```

## Configuration

### Vitest Configuration

The test configuration is in both `vite.config.ts` and `vitest.config.ts`:

- **Environment**: jsdom (for DOM testing)
- **Engine**: Real Babylon.js NullEngine (headless, command-line compatible)
- **Globals**: Enabled (no need to import `describe`, `it`, `expect`)
- **Path alias**: `~` points to `src/`
- **Setup file**: `src/test/setup.ts` with WebGL context mocking for NullEngine

### TypeScript Configuration

Tests are included in `tsconfig.json` with Vitest global types enabled.

### Real Babylon.js Integration

The test setup uses:
- **NullEngine**: Headless Babylon.js engine that doesn't require a browser
- **Real Vector3**: Actual Babylon.js Vector3 objects with real methods
- **Real Cameras/Lights**: Actual UniversalCamera, HemisphericLight, DirectionalLight instances
- **Real Scene**: Fully functional Babylon.js Scene for integration testing

## Best Practices

1. **Keep tests close to source code** - Place `.test.ts` files next to the components they test
2. **Use descriptive test names** - Make it clear what behavior is being tested
3. **Mock external dependencies** - Use the provided helpers for BabylonJS and ECS mocking
4. **Test behavior, not implementation** - Focus on what the code does, not how it does it
5. **Keep tests focused** - Each test should verify one specific behavior
6. **Use beforeEach for setup** - Initialize common test data in beforeEach blocks

## Debugging Tests

- Use `npm run test:ui` to run tests in the browser with a visual interface
- Add `console.log` statements in tests (they won't be suppressed by default)
- Use VS Code's built-in debugger with Vitest extension for breakpoint debugging

## Current Test Status

✅ **All tests passing**: 157 tests across 6 test files
- `Component.test.ts` - 18 tests (base Component class functionality)
- `Entity.test.ts` - 34 tests (Entity-Component relationships, Babylon.js Mesh integration)  
- `System.test.ts` - 30 tests (System processing, ECS integration)
- `World.test.ts` - 44 tests (World management, scene loading, entity queries)
- `Camera.test.ts` - 13 tests (Camera component/system with real Vector3 operations)
- `Lighting.test.ts` - 18 tests (Lighting system with real HemisphericLight/DirectionalLight)

## Coverage

To run tests with coverage:

```bash
npm test -- --coverage
```

This will generate a coverage report in the `coverage/` directory.

## Key Benefits of Real Babylon.js Testing

1. **No Mock Maintenance**: Tests use actual Babylon.js objects, so no need to maintain mocks
2. **Real Behavior**: Vector3 math, camera operations, and lighting work exactly as in production
3. **Integration Confidence**: Tests verify actual Babylon.js API compatibility
4. **Headless Performance**: NullEngine runs fast without WebGL context
5. **True Unit Testing**: Components are tested with their real dependencies