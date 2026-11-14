// Pure Kobra-2 (binomio) navigation rules extracted from TacticalEngine.updateSquadmateAI.

import type { SquadCommand } from './types';

export interface Point2 {
  x: number;
  y: number;
}

export interface SquadNavInput {
  command: SquadCommand;
  player: { x: number; y: number; angle: number };
  rallyPoint?: Point2;
  /** The operator is reloading or applying medical aid: cover the front. */
  playerReloadingOrBleeding: boolean;
  /** A closed door is close by, so the squadmate should stack instead of following. */
  doorBlocking: boolean;
  stackPosition?: Point2;
}

/** How far ahead of the operator Kobra-2 takes overwatch. */
export const SQUAD_OVERWATCH_LEAD = 48;
/** Default trailing distance while following. */
export const SQUAD_TAIL_DISTANCE = 85;
export const SQUAD_WEDGE_DISTANCE = 95;
export const SQUAD_STAGGERED_DISTANCE = 125;

/** Offset (radians) of the wedge and staggered formations from the operator's facing. */
export const SQUAD_WEDGE_OFFSET = 2.5;
export const SQUAD_STAGGERED_OFFSET = -2.5;

function offsetFrom(player: { x: number; y: number; angle: number }, angle: number, distance: number): Point2 {
  return {
    x: player.x + Math.cos(angle) * distance,
    y: player.y + Math.sin(angle) * distance,
  };
}

/**
 * Resolves where Kobra-2 should walk to for the current order.
 * Returns null when the order means "hold this sector".
 */
export function computeSquadNavTarget(input: SquadNavInput): Point2 | null {
  const { command, player, rallyPoint, playerReloadingOrBleeding, doorBlocking, stackPosition } = input;

  if (command === 'FOLLOW') {
    if (rallyPoint) return { x: rallyPoint.x, y: rallyPoint.y };
    if (playerReloadingOrBleeding) {
      return offsetFrom(player, player.angle, SQUAD_OVERWATCH_LEAD);
    }
    if (doorBlocking && stackPosition) return { x: stackPosition.x, y: stackPosition.y };
    return offsetFrom(player, player.angle + Math.PI, SQUAD_TAIL_DISTANCE);
  }

  if (command === 'FORM_WEDGE') {
    return offsetFrom(player, player.angle + SQUAD_WEDGE_OFFSET, SQUAD_WEDGE_DISTANCE);
  }

  if (command === 'FORM_STAGGERED') {
    return offsetFrom(player, player.angle + SQUAD_STAGGERED_OFFSET, SQUAD_STAGGERED_DISTANCE);
  }

  return null;
}
