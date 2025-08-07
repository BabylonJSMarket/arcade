// Global test setup file using real Babylon.js with headless NullEngine
import { vi, afterAll } from "vitest";
import { NullEngine, Scene } from "@babylonjs/core";

// Mock DOM elements that Babylon.js might need
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock HTMLCanvasElement for NullEngine
global.HTMLCanvasElement = class MockHTMLCanvasElement {
  width = 800;
  height = 600;
  getContext = vi.fn(() => ({
    // Mock WebGL context methods that NullEngine might need
    getExtension: vi.fn(() => null),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getProgramParameter: vi.fn(() => true),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    depthFunc: vi.fn(),
    cullFace: vi.fn(),
    canvas: this,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    TRIANGLES: 4,
    DEPTH_TEST: 2929,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
  }));
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  getBoundingClientRect = vi.fn(() => ({
    width: this.width,
    height: this.height,
    top: 0,
    left: 0,
    right: this.width,
    bottom: this.height,
  }));
} as any;

// Mock document.getElementById for canvas creation
Object.defineProperty(document, "getElementById", {
  writable: true,
  value: vi.fn((id: string) => new global.HTMLCanvasElement()),
});

// Create a global test engine and scene for reuse
let testEngine: NullEngine | null = null;
let testScene: Scene | null = null;

export const getTestEngine = (): NullEngine => {
  if (!testEngine) {
    // Disable WebGL validation and audio context for testing
    const originalWarn = console.warn;
    console.warn = vi.fn();

    testEngine = new NullEngine({
      renderWidth: 800,
      renderHeight: 600,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 1,
      disableWebGL2Support: true,
    });

    console.warn = originalWarn;
  }
  return testEngine;
};

export const getTestScene = (): Scene => {
  if (!testScene) {
    const engine = getTestEngine();
    testScene = new Scene(engine);
  }
  return testScene;
};

export const cleanupTestEngine = () => {
  if (testScene) {
    testScene.dispose();
    testScene = null;
  }
  if (testEngine) {
    testEngine.dispose();
    testEngine = null;
  }
};

// Cleanup after all tests
afterAll(() => {
  cleanupTestEngine();
});

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
