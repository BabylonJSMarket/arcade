import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Mock the modules
vi.mock("node:fs");
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

const mockFs = vi.mocked(fs);
const mockPrompts = (await vi.importMock("@clack/prompts")) as {
  text: ReturnType<typeof vi.fn>;
  isCancel: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("game-generator", () => {
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd to return a predictable path
    vi.spyOn(process, "cwd").mockReturnValue("/test/project");
    // Mock process.exit to prevent actual exit
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`Process exit called with code ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.cwd = () => originalCwd;
    process.exit = originalExit;
  });

  it("should generate both Data.ts and Component.ts files when name is provided", async () => {
    // Setup mocks
    mockPrompts.text.mockResolvedValue("TestGame");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("Hello Blank game blank");
    mockFs.writeFileSync.mockImplementation(() => {});

    // Import and run the generator
    const { main } = await import("./game-generator.js");
    await main();

    // Verify prompts were called
    expect(mockPrompts.text).toHaveBeenCalledWith({ message: "Enter name:" });
    expect(mockPrompts.isCancel).toHaveBeenCalledWith("TestGame");

    // Verify file operations
    const templatesDir = path.join(__dirname, "templates");

    expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join(templatesDir, "Data.ts"),
      "utf-8",
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join(templatesDir, "Component.ts"),
      "utf-8",
    );

    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);

    // Verify output paths
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/test/project/data/GameData/Shared/TestGame.ts",
      "Hello TestGame game testgame",
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/test/project/src/components/TestGame.ts",
      "Hello TestGame game testgame",
    );
  });

  it("should skip files that already exist", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockPrompts.text.mockResolvedValue("ExistingGame");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(true); // All files exist

    const { main } = await import("./game-generator.js");
    await main();

    // Should not write any files
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();

    // Should log skip messages
    expect(consoleSpy).toHaveBeenCalledWith(
      "Skipping ExistingGame.ts (already exists)",
    );

    consoleSpy.mockRestore();
  });

  it("should handle cancelled input", async () => {
    mockPrompts.text.mockResolvedValue("SomeName");
    mockPrompts.isCancel.mockReturnValue(true);
    mockPrompts.cancel.mockImplementation(() => {});

    const { main } = await import("./game-generator.js");

    // Expect the function to exit early, so wrap in try-catch since process.exit throws
    await expect(main()).rejects.toThrow("Process exit called with code 0");

    expect(mockPrompts.cancel).toHaveBeenCalledWith("Operation cancelled");
    expect(process.exit).toHaveBeenCalledWith(0);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should replace template placeholders correctly", async () => {
    const templateContent = `
      export class BlankComponent {
        constructor() {
          this.name = 'blank';
        }
      }
      // Some Blank reference
      const blankInstance = new Blank();
    `;

    mockPrompts.text.mockResolvedValue("SpaceInvaders");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue(templateContent);
    mockFs.writeFileSync.mockImplementation(() => {});

    const { main } = await import("./game-generator.js");
    await main();

    const expectedContent = `
      export class SpaceInvadersComponent {
        constructor() {
          this.name = 'spaceinvaders';
        }
      }
      // Some SpaceInvaders reference
      const spaceinvadersInstance = new SpaceInvaders();
    `;

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expectedContent,
    );
  });

  it("should handle mixed existing and new files", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockPrompts.text.mockResolvedValue("MixedGame");
    mockPrompts.isCancel.mockReturnValue(false);

    // First file exists, second doesn't
    mockFs.existsSync
      .mockReturnValueOnce(true) // Data.ts exists
      .mockReturnValueOnce(false); // Component.ts doesn't exist

    mockFs.readFileSync.mockReturnValue("template content");
    mockFs.writeFileSync.mockImplementation(() => {});

    const { main } = await import("./game-generator.js");
    await main();

    // Should skip first, create second
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Skipping MixedGame.ts (already exists)",
    );
    expect(consoleSpy).toHaveBeenCalledWith("Created MixedGame.ts");

    consoleSpy.mockRestore();
  });

  it("should use correct output paths", async () => {
    mockPrompts.text.mockResolvedValue("PathTest");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("content");
    mockFs.writeFileSync.mockImplementation(() => {});

    const { main } = await import("./game-generator.js");
    await main();

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/test/project/data/GameData/Shared/PathTest.ts",
      "content",
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/test/project/src/components/PathTest.ts",
      "content",
    );
  });

  it("should handle errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Set up successful prompts but cause an error during file operations
    mockPrompts.text.mockResolvedValue("ErrorTest");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("File system error");
    });

    const { main } = await import("./game-generator.js");

    // The main function should throw the original error when imported and called directly
    await expect(main()).rejects.toThrow("File system error");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should log creation messages for successfully created files", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockPrompts.text.mockResolvedValue("NewGame");
    mockPrompts.isCancel.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("content");
    mockFs.writeFileSync.mockImplementation(() => {});

    const { main } = await import("./game-generator.js");
    await main();

    expect(consoleSpy).toHaveBeenCalledWith("Created NewGame.ts");
    expect(consoleSpy).toHaveBeenCalledTimes(2); // One for each file

    consoleSpy.mockRestore();
  });
});
