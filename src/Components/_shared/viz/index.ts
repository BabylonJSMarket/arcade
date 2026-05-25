/**
 * Re-exports of the generic viz infrastructure that now lives in
 * `@babylonjsmarket/ecs/viz`. Kept here so existing arcade .viz.tsx files
 * can keep importing from '../_shared/viz' without churn.
 */
export {
  vizStore,
  VizPanel,
  VizRoot,
  mountVizRoot,
  unmountVizRoot,
  EventBusDebuggerComponent,
  EventBusDebuggerSystem,
  EventBusDebuggerEvents,
  EventBusDebuggerPanel,
} from '@babylonjsmarket/ecs/viz';
export type {
  PanelState,
  PanelConfig,
  VizPanelProps,
  EventBusDebuggerInput,
  EventBusDebuggerPanelProps,
  EventEntry,
  EntityGroup,
} from '@babylonjsmarket/ecs/viz';
export { EntityListPanel, type EntityListPanelProps, type EntityListRow } from './EntityListPanel';
export { mountFpsOverlay, type FpsOverlayHandle } from './FpsOverlay';
export {
  mountArcadeViz,
  type ArcadeVizHandle,
  type MountArcadeVizOptions,
} from './mountArcadeViz';
