/**
 * Component resolvers for the top-down shooter scene.
 *
 * Every gameplay component the scene references (TwinStickShooter, Bullet,
 * Enemy, EnemySpawner, plus all the rendering basics) is in arcade's default
 * registry — so the only thing left to wire up is the Scoreboard HUD panel,
 * which lives in `arcade/viz` (it needs the live Solid mount).
 *
 * To add your own custom component (e.g. PowerUp, EnemyBoss), drop it under
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
  LineOfSightDebugger: async () => {
    const m = await import('@babylonjsmarket/arcade/viz')
    return {
      LineOfSightDebuggerComponent: m.LineOfSightDebuggerComponent,
      LineOfSightDebuggerSystem: m.LineOfSightDebuggerSystem,
    }
  },
}
