/**
 * Shared component resolver map for every scene in the arcade.
 *
 * Every component lives in `src/components/<Name>/`: the free core set the
 * scenes use (MeshPrimitive, Mesh, DirectionalLight, HemisphericLight, Shadow,
 * ArcCamera, ...) was downloaded there when the project was created, and
 * anything you pull with `bjs download <name>` lands beside it. You rarely
 * touch this file.
 *
 * It AUTO-DISCOVERS that folder: each `src/components/<Name>/<Name>.ts` is
 * registered here with zero manual wiring — the glob below maps each
 * `components/<Name>/<Name>.ts` (the main component file, where the folder
 * name matches the file basename) to `<Name>: () => import(...)`. Sibling
 * files in the same folder (`<Name>.core.ts`, `<Name>.panel.tsx`,
 * `<Name>.viz.tsx`, `example.scene.json`, ...) are skipped, so only the entry
 * module is registered, and tests are never globbed at all.
 *
 * Bundlers tree-shake per component: each lazy `import()` becomes its own
 * chunk, so a scene only pulls in the components it actually references.
 *
 * To add a component by hand, just create `src/components/MyThing/MyThing.ts`
 * exporting `MyThingComponent` (and optionally `MyThingSystem`) — it is picked
 * up automatically. No edit to this file is required.
 */

export type ComponentModule = Record<string, unknown>
export type LazyComponentResolver = () => Promise<ComponentModule>

// `eager: false` (the default) gives `{ [path]: () => import(path) }`, so each
// component stays a separate lazy chunk. No matches → an empty map.
//
// Both folder spellings, in ONE glob call. `bjs download` and `arcade core`
// write `src/components/`, but a project that already has `src/Components/`
// keeps that. Two separate calls would each match the same files on a
// case-insensitive disk (macOS, Windows) and bundle every component twice;
// one call walks the real folder once.
//
// The `!` pattern keeps tests out. `bjs download` ships a component's tests
// beside it, and a test globbed here becomes a production chunk that imports
// vitest and @solidjs/testing-library: `vite build` fails to resolve them.
const modules = import.meta.glob([
  './Components/*/*.ts',
  './components/*/*.ts',
  '!**/*.test.ts',
]) as Record<string, LazyComponentResolver>

// Debug panels. A `<Name>.viz.tsx` exports `<Name>DebuggerComponent` +
// `<Name>DebuggerSystem`, which is exactly what the key `<Name>Debugger`
// resolves to — so registering them is the same convention, one glob wider.
// Without this a downloaded component ships its tuning panel and nothing can
// ever put it in a scene.
//
// Dev only, like the panels main.ts mounts: in a production build
// import.meta.env.DEV is the constant false, the glob is dropped, and no
// debugger chunk ships to players.
const vizModules = (
  import.meta.env.DEV
    ? import.meta.glob(['./Components/*/*.viz.tsx', './components/*/*.viz.tsx'])
    : {}
) as Record<string, LazyComponentResolver>

// Control panels: a `<Name>.panel.tsx` exports `<Name>PanelComponent` +
// `<Name>PanelSystem`, the knobs a scene's `<Name>Panel` entity opens with
// its hotkey. Dev only, like the debug panels.
const panelModules = (
  import.meta.env.DEV
    ? import.meta.glob(['./Components/*/*.panel.tsx', './components/*/*.panel.tsx'])
    : {}
) as Record<string, LazyComponentResolver>

export const REGISTRY: Record<string, LazyComponentResolver> = Object.fromEntries([
  ...Object.entries(modules).flatMap(([filePath, load]) => {
    // filePath looks like './Components/<Name>/<File>.ts'. Keep only the main
    // component module: folder name === file basename, and not a `.core.ts`.
    const parts = filePath.split('/')
    const file = parts[parts.length - 1] ?? ''
    const dir = parts[parts.length - 2] ?? ''
    const base = file.replace(/\.ts$/, '')
    if (base !== dir) return [] // sibling file (.core, .test, panel, viz, ...)
    return [[dir, load]] as Array<[string, LazyComponentResolver]>
  }),
  ...Object.entries(vizModules).flatMap(([filePath, load]) => {
    const parts = filePath.split('/')
    const file = parts[parts.length - 1] ?? ''
    const dir = parts[parts.length - 2] ?? ''
    if (file !== `${dir}.viz.tsx`) return []
    return [[`${dir}Debugger`, load]] as Array<[string, LazyComponentResolver]>
  }),
  ...Object.entries(panelModules).flatMap(([filePath, load]) => {
    const parts = filePath.split('/')
    const file = parts[parts.length - 1] ?? ''
    const dir = parts[parts.length - 2] ?? ''
    if (file !== `${dir}.panel.tsx`) return []
    return [[`${dir}Panel`, load]] as Array<[string, LazyComponentResolver]>
  }),
])
