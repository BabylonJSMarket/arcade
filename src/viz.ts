/**
 * `@babylonjsmarket/arcade/viz` — arcade-specific viz helpers + re-exports
 * of the generic viz infrastructure from `@babylonjsmarket/viz`.
 *
 * Apps import `mountArcadeViz` from here (one-line app boot that mounts the
 * Entities panel + the EventBus debugger). The other viz/panel files are
 * exported per-component below.
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

// Per-component panels shipped as source.
export * from './Components/MeshPrimitive/MeshPrimitive.viz';
export * from './Components/Movement/Movement.viz';
export * from './Components/KeyboardMover/KeyboardMover.viz';
export * from './Components/PlayerInput/PlayerInput.viz';
export * from './Components/ArcCamera/ArcCamera.viz';
export * from './Components/CameraFollow/CameraFollow.viz';
export * from './Components/DirectionalLight/DirectionalLight.viz';
export * from './Components/HemisphericLight/HemisphericLight.viz';
export * from './Components/Score/Score.viz';
export * from './Components/Scoreboard/Scoreboard.viz';
export * from './Components/Shadow/Shadow.viz';
export * from './Components/Animation/Animation.viz';
export * from './Components/Mesh/Mesh.viz';
export * from './Components/PinballTable/PinballTable.viz';
export * from './Components/PinballBuilder/PinballBuilder.viz';
export * from './Components/Flipper/Flipper.viz';
export * from './Components/LineOfSight/LineOfSight.viz';
