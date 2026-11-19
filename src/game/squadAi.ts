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

/**
 * Recorre el tramo hasta el sondeo, no solo su extremo. En un vano el codo del
 * marco queda entre el binomio y el punto lejano: el sondeo cae ya dentro de la
 * habitación y parece libre mientras el paso de este fotograma sigue frenado, y
 * el actor se queda clavado con el rumbo recto para siempre. Se muestrea con el
 * mismo paso de 8 px que usa el deslizamiento con colisión.
 */
export function isPathClear(
  origin: Point2,
  angle: number,
  distance: number,
  collides: (x: number, y: number) => boolean,
  step = 8
): boolean {
  const samples = Math.max(1, Math.ceil(distance / Math.max(1, step)));
  for (let i = 1; i <= samples; i += 1) {
    const ahead = (distance * i) / samples;
    if (collides(origin.x + Math.cos(angle) * ahead, origin.y + Math.sin(angle) * ahead)) {
      return false;
    }
  }
  return true;
}

/**
 * Local steering for Kobra-2. The operator order gives the desired bearing, but a
 * binomio cannot walk through walls or furniture: probe a few deviations and take
 * the closest clear one. Keeping the choice deterministic avoids side-to-side
 * jitter when a corner blocks the direct line.
 */
export function chooseSquadSteeringAngle(
  desiredAngle: number,
  isBlocked: (angle: number) => boolean,
  preferredSide: 1 | -1 = 1
): number {
  const deviations = [0, 0.55, -0.55, 1.05, -1.05, 1.55, -1.55];
  for (const deviation of deviations) {
    const candidate = desiredAngle + deviation * preferredSide;
    if (!isBlocked(candidate)) return candidate;
  }
  return desiredAngle;
}
