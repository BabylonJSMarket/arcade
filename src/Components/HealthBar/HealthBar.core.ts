/**
 * HealthBar — pure core.
 *
 * Data-only definition for the 3D billboarded health bar. Runtime mesh
 * handles (`bgHandle`, `fillHandle`) and the `initialized` one-shot flag
 * live in a WeakMap on `HealthBarSystem` — they're renderer state, not
 * serializable data.
 */
import { Component } from '@babylonjsmarket/ecs'

export interface HealthBarInput {
  /** World-space width of the bar at full HP. */
  width?: number
  /** World-space height (thin axis). */
  height?: number
  /** Vertical offset above the parent mesh's origin. */
  offsetY?: number
  /** Color of the filled portion (RGB 0..1). */
  color?: [number, number, number]
  /** Color of the empty/background portion. */
  backgroundColor?: [number, number, number]
  /** Hide the entire bar at full HP. */
  hideAtFullHp?: boolean
  /** If true, fill shrinks from the RIGHT side (HP burns down from R→L). */
  fillFromLeft?: boolean
}

export class HealthBarComponent extends Component {
  width: number
  height: number
  offsetY: number
  color: [number, number, number]
  backgroundColor: [number, number, number]
  hideAtFullHp: boolean
  fillFromLeft: boolean

  constructor(data: HealthBarInput = {}) {
    super()
    this.width = data.width ?? 1.2
    this.height = data.height ?? 0.14
    this.offsetY = data.offsetY ?? 1.0
    this.color = data.color ?? [0.35, 0.95, 0.45]
    this.backgroundColor = data.backgroundColor ?? [0.12, 0.06, 0.08]
    this.hideAtFullHp = data.hideAtFullHp ?? true
    this.fillFromLeft = data.fillFromLeft ?? true
  }

  serialize(): HealthBarInput {
    return {
      width: this.width,
      height: this.height,
      offsetY: this.offsetY,
      color: this.color,
      backgroundColor: this.backgroundColor,
      hideAtFullHp: this.hideAtFullHp,
      fillFromLeft: this.fillFromLeft,
    }
  }
}
