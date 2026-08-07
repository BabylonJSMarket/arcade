/**
 * CabinetLink.core.ts — pure data Component marking an entity as a clickable
 * arcade cabinet that fronts a game.
 *
 * Two gestures, deliberately different in weight:
 *   • single click — walk me over there (cheap, reversible, no commitment)
 *   • double click — start the game (the real navigation)
 *
 * That split is what lets one pointer serve both "let me look at that machine"
 * and "put the coin in", which is how a real arcade floor works.
 *
 * Zero imports from @babylonjs, three, or the DOM. The System does the picking.
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
  /** Set false to make a cabinet purely scenery. */
  interactive?: boolean;
}

export class CabinetLinkComponent extends Component {
  game: string;
  route: string;
  title: string;
  standPoint?: [number, number];
  standoff: number;
  facing: number;
  interactive: boolean;

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
    };
  }
}
