import colors from "picocolors";

const { blue, magenta } = colors;

type ColorFunc = (str: string | number) => string;

export interface TemplateOption {
  name: string;
  display: string;
  color: ColorFunc;
  /** Hint shown in the gallery index and the CLI help text. */
  hint: string;
}

/**
 * Every template scaffolds the SAME tiny `src/main.ts` boot, the SAME
 * `src/registry.ts` (HUD panel resolvers), and differs only in the
 * `src/scene.ts` it ships with. Every gameplay component referenced by
 * scene.ts already lives in @babylonjsmarket/arcade — no bespoke per-template
 * TS files. To add custom components, drop them in `src/components/` and add
 * a resolver entry to registry.ts.
 */
const SETUP_OPTIONS: TemplateOption[] = [
  {
    name: "empty-3d",
    display: "Empty 3D (procedural sky, sun + shadows, viz UI)",
    color: blue,
    hint: "Cinematic sunset baseline — orbit the hero, drag to inspect",
  },
  {
    name: "top-down-shooter",
    display: "Top-Down Shooter (SmashTV-style hordes + bullet hell)",
    color: magenta,
    hint: "Walled arena, twin-stick player (WASD move, arrows fire), enemy spawners at the corners",
  },
  {
    name: "pinball",
    display: "Pinball (Havok physics, flippers, bumpers, plunger)",
    color: magenta,
    hint: "Regulation-ratio table with bumpers, slingshots, dual flippers, score HUD, and a live element-builder panel",
  },
];

export default SETUP_OPTIONS;
