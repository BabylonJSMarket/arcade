import { describe, it, expect } from "vitest";
import SETUP_OPTIONS, { type TemplateOption } from "./setup-options.js";

describe("SETUP_OPTIONS", () => {
  it("includes empty-3d as the baseline template", () => {
    const names = SETUP_OPTIONS.map((option) => option.name);
    expect(names).toContain("empty-3d");
  });

  it("gives each template a non-empty display label and hint", () => {
    for (const option of SETUP_OPTIONS) {
      expect(option.display).toBeTypeOf("string");
      expect(option.display.length).toBeGreaterThan(0);
      expect(option.hint).toBeTypeOf("string");
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it("attaches a callable color function to each template", () => {
    for (const option of SETUP_OPTIONS) {
      expect(option.color).toBeTypeOf("function");
      const colored = option.color(option.name);
      expect(colored).toContain(option.name);
    }
  });

  it("matches the TemplateOption shape", () => {
    for (const option of SETUP_OPTIONS) {
      const keys = Object.keys(option) as Array<keyof TemplateOption>;
      expect(keys).toContain("name");
      expect(keys).toContain("display");
      expect(keys).toContain("color");
      expect(keys).toContain("hint");
    }
  });
});
