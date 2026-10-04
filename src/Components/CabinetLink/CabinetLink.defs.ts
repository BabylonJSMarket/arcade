/**
 * CabinetLink — definitions.
 *
 * Holds the `CabinetLinkComponent` class and the shapes its data and events
 * travel in. No System lives here, which is the point: another component can
 * name CabinetLink in a query, or type an event it listens for, without
 * pulling CabinetLink's behaviour into its own bundle. Import from here, not
 * from CabinetLink.ts.
 */

import { Component } from '@babylonjsmarket/ecs';
import type { Vec3 } from '@babylonjsmarket/ecs/renderer-types';

export interface CabinetLinkInput {
  /**
   * Key of the game this cabinet fronts, e.g. `'frogger'`. Matches a folder
   * under `src/games/` and the key in that project's GAMES registry.
   */
  game?: string;
  /** Where double-click navigates. Defaults to `/games/<game>/`. */
  route?: string;
  /** Human label, for HUD/overlay use. Defaults to `game`. */
  title?: string;
  /**
   * Where the player is walked to on single click. Omit and the System stands
   * them `standoff` metres out from the cabinet along its facing, which is what
   * you want for a cabinet against a wall.
   */
  standPoint?: [number, number];
  /** Distance in front of the cabinet to stand. Metres. */
  standoff?: number;
  /**
   * The cabinet's facing yaw (radians), used to work out "in front". Should
   * match the Mesh's rotation Y. 0 = facing +Z.
   */
  facing?: number;
  /**
   * Whether a double-click LAUNCHES this machine. False makes it scenery you
   * can still walk up to and look at — clicking always walks you over, on every
   * machine, which is most of what you do in an arcade.
   */
  interactive?: boolean;
  /**
   * How close the PLAYER must already be (XZ metres from the cabinet) for the
   * confirming double-click to launch. Further away, the click reports
   * `cabinetlink.launch.outofrange` and the walk the first click started just
   * carries on — the player arrives, and double-clicks again. Omit for no
   * gate: a double-click launches from anywhere, as it always did.
   */
  launchDistance?: number;
}

export class CabinetLinkComponent extends Component {
  // Declared, not read off the class name: a minified build renames classes,
  // and arcade's built-in CabinetLink must still match a copy in the project.
  static componentType = 'CabinetLink';

  game: string;
  route: string;
  title: string;
  standPoint?: [number, number];
  standoff: number;
  facing: number;
  interactive: boolean;
  launchDistance: number;

  constructor(data: CabinetLinkInput = {}) {
    super();
    this.game = data.game ?? '';
    this.route = data.route ?? (this.game ? `/games/${this.game}/` : '');
    this.title = data.title ?? this.game;
    this.standPoint = data.standPoint ? [data.standPoint[0], data.standPoint[1]] : undefined;
    // ~1.2 m: close enough to read the screen, far enough not to clip into it.
    this.standoff = data.standoff ?? 1.2;
    this.facing = data.facing ?? 0;
    this.interactive = data.interactive ?? true;
    this.launchDistance = data.launchDistance ?? Infinity;
  }

  /**
   * Floor spot the player should stand on, and the yaw that turns them to LOOK
   * at the cabinet, given the cabinet's own position.
   *
   * The player ends up `standoff` metres along the cabinet's facing direction
   * and turned 180° from it — facing back at the machine.
   */
  approachFrom(cabinet: Vec3): { x: number; z: number; yaw: number } {
    const yaw = this.facing + Math.PI; // look back at the cabinet
    if (this.standPoint) {
      return { x: this.standPoint[0], z: this.standPoint[1], yaw };
    }
    return {
      x: cabinet[0] + Math.sin(this.facing) * this.standoff,
      z: cabinet[2] + Math.cos(this.facing) * this.standoff,
      yaw,
    };
  }

  serialize(): CabinetLinkInput {
    return {
      game: this.game,
      route: this.route,
      title: this.title,
      standPoint: this.standPoint ? [this.standPoint[0], this.standPoint[1]] : undefined,
      standoff: this.standoff,
      facing: this.facing,
      interactive: this.interactive,
      // Infinity is the "no gate" default and does not survive JSON, so the
      // key is simply left out — the constructor puts it back.
      ...(Number.isFinite(this.launchDistance) ? { launchDistance: this.launchDistance } : {}),
    };
  }
}
