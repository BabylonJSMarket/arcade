/**
 * LineOfSight debug panel. Builds a declarative spec and EMITS it via the free
 * PanelHost base (@babylonjsmarket/viz) — no viz/solid import, so arcade stays decoupled from
 * the (private, dev-only) renderer. Sliders tune every LineOfSightComponent in
 * the scene live (read first, write all — pooled enemies included), so you can
 * dial FOV / range / ray count / block radius / check interval to find the
 * sweet spot. The "show rays" toggle emits `lineofsight.debugrays.set`, which
 * LineOfSightSystem consumes to draw the per-robot sight rays.
 */
import type { World, EventBus } from '@babylonjsmarket/ecs'
import {
  definePanel,
  PanelHostComponent,
  PanelHostSystem,
  type PanelHostInput,
  type PanelSpec,
} from '@babylonjsmarket/viz'
import { LineOfSightComponent, LineOfSightInputEvents } from './LineOfSight.core'

const PANEL_ID = 'line-of-sight'

export class LineOfSightDebuggerComponent extends PanelHostComponent {
  constructor(data: PanelHostInput = {}) {
    super({
      panelId: PANEL_ID,
      activationKey: data.activationKey,
      position: data.position ?? 'top-right',
      visible: data.visible,
    })
  }
}

export class LineOfSightDebuggerSystem extends PanelHostSystem<LineOfSightDebuggerComponent> {
  private drawRays = false

  constructor(eventBus: EventBus) {
    super(eventBus, LineOfSightDebuggerComponent)
  }

  protected buildSpec(world: World): PanelSpec {
    // Query live each call so the bindings cover pooled enemies created after
    // the panel registered (read the first component, write to all of them).
    const all = (): LineOfSightComponent[] =>
      world
        .getEntitiesWithComponent(LineOfSightComponent)
        .map((e) => e.get(LineOfSightComponent))
        .filter((c): c is LineOfSightComponent => c != null)
    const first = <T,>(read: (c: LineOfSightComponent) => T, fallback: T): T => {
      const c = all()[0]
      return c ? read(c) : fallback
    }
    const setAll = (write: (c: LineOfSightComponent) => void): void => {
      for (const c of all()) write(c)
    }

    return definePanel({
      id: PANEL_ID,
      title: 'Line of Sight',
      titleColor: '#7fd0ff',
      sections: [
        {
          title: 'Vision',
          controls: [
            {
              kind: 'slider',
              label: 'FOV (deg)',
              min: 20,
              max: 360,
              step: 5,
              bind: {
                persist: 'fov',
                get: () => first((c) => c.fov, 220),
                set: (v) => setAll((c) => { c.fov = v }),
              },
            },
            {
              kind: 'slider',
              label: 'range',
              min: 5,
              max: 60,
              step: 1,
              bind: {
                persist: 'range',
                get: () => first((c) => c.range, 32),
                set: (v) => setAll((c) => { c.range = v }),
              },
            },
            {
              kind: 'slider',
              label: 'ray count',
              min: 1,
              max: 7,
              step: 1,
              bind: {
                persist: 'rayCount',
                get: () => first((c) => c.rayCount, 3),
                set: (v) => setAll((c) => { c.rayCount = Math.round(v) }),
              },
            },
            {
              kind: 'slider',
              label: 'block radius',
              min: 0.1,
              max: 2,
              step: 0.1,
              bind: {
                persist: 'blockRadius',
                get: () => first((c) => c.blockRadius, 0.6),
                set: (v) => setAll((c) => { c.blockRadius = v }),
              },
            },
            {
              kind: 'slider',
              label: 'check interval (s)',
              min: 0.2,
              max: 4,
              step: 0.1,
              bind: {
                persist: 'interval',
                get: () => first((c) => c.interval, 1.5),
                set: (v) => setAll((c) => { c.interval = v }),
              },
            },
          ],
        },
        {
          title: 'Debug',
          controls: [
            {
              kind: 'toggle',
              label: 'show rays',
              bind: {
                persist: 'showRays',
                get: () => this.drawRays,
                set: (v) => {
                  this.drawRays = v
                  this.eventBus.emit(LineOfSightInputEvents.SET_DEBUG_RAYS, { enabled: v })
                },
              },
            },
          ],
        },
      ],
    })
  }
}
