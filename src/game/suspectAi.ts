// Pure suspect behaviour rules extracted from TacticalEngine (surrender guard, morale break).

import type { SuspectState } from './types';

const TERMINAL_STATES: ReadonlySet<SuspectState> = new Set<SuspectState>([
  'SURRENDERED',
  'ARRESTED',
  'DEAD',
]);

/** Only an active suspect can still give up. */
export function canSurrender(state: SuspectState): boolean {
  return !TERMINAL_STATES.has(state);
}

/** At or below this morale a suspect breaks under a violent entry. */
export const BREACH_MORALE_BREAK = 32;

export type BreachReaction = 'SURRENDER' | 'FLEEING' | 'PANIC' | 'HESITATING';

/**
 * Morale check when a door is kicked, rammed or blown open.
 * Confident suspects hesitate; broken ones give up, flee or panic.
 */
export function resolveBreachReaction(morale: number, roll: number): BreachReaction {
  if (morale > BREACH_MORALE_BREAK) return 'HESITATING';
  if (roll < 0.48) return 'SURRENDER';
  if (roll < 0.78) return 'FLEEING';
  return 'PANIC';
}
