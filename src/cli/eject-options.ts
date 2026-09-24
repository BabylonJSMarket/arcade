import colors from "picocolors";

const { cyan, bold } = colors;

export const EJECT_HELP = `\
Usage: arcade eject [OPTION]... [COMPONENT]...

Copy arcade component source into your project so you own and can edit it
(shadcn-style). Ejected components land in ${cyan("src/components/<Name>/")} and are
wired into ${cyan("src/registry.ts")} so they override the package's built-in copy.

With no component names, ejects every arcade component referenced by your
scenes (plus their dependencies). It scans ${cyan("src/scenes/*.ts")},
${cyan("public/games/*/scene.json")} and ${cyan("src/registry.ts")} (and the older
${cyan("src/scene.ts")} / ${cyan("src/scene.json")}). Name components explicitly to
eject just those, or use --all for the whole library.

Each eject also drops the ${bold("babylonjsmarket")} Claude skill into
${cyan(".claude/skills/")} so Claude Code auto-discovers it with no plugin install.

Options:
  --all          eject every arcade component (ignore scene/registry scan)
  --dry-run      print what would be copied/patched, write nothing
  -h, --help     print this help message

Examples:
  arcade eject                 # eject what this project uses
  arcade eject Bullet Enemy    # eject specific components (+ their deps)
  arcade eject --all --dry-run # preview a full eject
`;
