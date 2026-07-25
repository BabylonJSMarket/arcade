/**
 * Shared component resolver map for every scene in the arcade.
 *
 * Every component the arcade room uses (MeshPrimitive, Mesh, DirectionalLight,
 * HemisphericLight, Shadow, ArcCamera, ...) is registered by default in
 * @babylonjsmarket/arcade, so you rarely touch this file.
 *
 * It AUTO-DISCOVERS your project's own components: anything you pull with
 * `bjs download <name>` lands in `src/Components/<Name>/<Name>.ts` and is
 * registered here with zero manual wiring — the glob below maps each
 * `Components/<Name>/<Name>.ts` (the main component file, where the folder
 * name matches the file basename) to `<Name>: () => import(...)`. Sibling
 * files in the same folder (`<Name>.core.ts`, `<Name>.test.ts`,
 * `<Name>.panel.tsx`, `<Name>.viz.tsx`, `example.scene.json`, ...) are
 * skipped, so only the entry module is registered.
 *
 * Bundlers tree-shake per component: each lazy `import()` becomes its own
 * chunk, so a scene only pulls in the components it actually references.
 *
 * To add a component by hand, just create `src/Components/MyThing/MyThing.ts`
 * exporting `MyThingComponent` (and optionally `MyThingSystem`) — it is picked
 * up automatically. No edit to this file is required.
 */

export type ComponentModule = Record<string, unknown>
export type LazyComponentResolver = () => Promise<ComponentModule>

// `eager: false` (the default) gives `{ [path]: () => import(path) }`, so each
// component stays a separate lazy chunk. `bjs download` installs to
// `src/Components/` (capital C) and `arcade eject` to `src/components/`; glob
// both so either path is auto-registered. No matches → an empty map.
const modules = {
  ...import.meta.glob('./Components/*/*.ts'),
  ...import.meta.glob('./components/*/*.ts'),
} as Record<string, LazyComponentResolver>

// Debug panels. A `<Name>.viz.tsx` exports `<Name>DebuggerComponent` +
// `<Name>DebuggerSystem`, which is exactly what the key `<Name>Debugger`
// resolves to — so registering them is the same convention, one glob wider.
// Without this a downloaded component ships its tuning panel and nothing can
// ever put it in a scene.
const vizModules = {
  ...import.meta.glob('./Components/*/*.viz.tsx'),
  ...import.meta.glob('./components/*/*.viz.tsx'),
} as Record<string, LazyComponentResolver>

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
])
