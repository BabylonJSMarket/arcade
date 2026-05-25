/**
 * Component resolvers for the pinball scene.
 *
 * Every gameplay component the scene references (Plunger, Flipper, Bumper,
 * Spinner, MouseHole, PinballTable, PinballLayout, PinballCamera, plus
 * PinballBuilder + PinballBuilderInput) is in arcade's default registry.
 * Only the HUD-panel components below need explicit wiring — they live in
 * `arcade/viz` rather than the main registry, since they depend on the
 * live Solid mount.
 *
 * To add your own custom component (e.g. a Spinner variant), drop it under
 * `src/components/MyThing.ts` exporting `MyThingComponent` (and optionally
 * `MyThingSystem`), then add an entry below:
 *
 *   MyThing: () => import('./components/MyThing'),
 */
export const REGISTRY = {
  ScoreboardDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      ScoreboardDebuggerComponent: m.ScoreboardDebuggerComponent,
      ScoreboardDebuggerSystem: m.ScoreboardDebuggerSystem,
    }
  },
  ArcCameraDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      ArcCameraDebuggerComponent: m.ArcCameraDebuggerComponent,
      ArcCameraDebuggerSystem: m.ArcCameraDebuggerSystem,
    }
  },
  PinballTableDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      PinballTableDebuggerComponent: m.PinballTableDebuggerComponent,
      PinballTableDebuggerSystem: m.PinballTableDebuggerSystem,
    }
  },
  PinballBuilderDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      PinballBuilderDebuggerComponent: m.PinballBuilderDebuggerComponent,
      PinballBuilderDebuggerSystem: m.PinballBuilderDebuggerSystem,
    }
  },
  FlipperColliderDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      FlipperColliderDebuggerComponent: m.FlipperColliderDebuggerComponent,
      FlipperColliderDebuggerSystem: m.FlipperColliderDebuggerSystem,
    }
  },
}
