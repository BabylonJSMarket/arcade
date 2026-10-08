/**
 * `@babylonjsmarket/arcade/viz` — arcade-specific viz helpers + re-exports
 * of the generic viz infrastructure from `@babylonjsmarket/viz`.
 *
 * Apps import `mountArcadeViz` from here (one-line app boot that mounts the
 * Entities panel + the EventBus debugger). Each component's own debug panel
 * (`<Name>.viz.tsx`) and control panel (`<Name>.panel.tsx`) ship with the
 * component in `src/components/`, not here.
 */

export {
  mountArcadeViz,
  type ArcadeVizHandle,
  type MountArcadeVizOptions,
  EntityListPanel,
  type EntityListPanelProps,
  type EntityListRow,
  mountFpsOverlay,
  type FpsOverlayHandle,
  // Simple control widgets used by component control panels.
  Slider,
  type SliderProps,
  ResetButton,
  type ResetButtonProps,
  Section,
  type SectionProps,
  ColorControl,
  type ColorControlProps,
  // Generic viz primitives, so apps can use a single import root if they prefer.
  vizStore,
  mountVizRoot,
  unmountVizRoot,
  EventBusDebuggerComponent,
  EventBusDebuggerSystem,
  EventBusDebuggerEvents,
  type EventBusDebuggerInput,
} from '@babylonjsmarket/viz';

// Always-on controls key-hint overlay (bottom-left).
export * from './ControlsHud';
