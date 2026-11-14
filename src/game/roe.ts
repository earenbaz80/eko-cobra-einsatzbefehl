// Pure rules of engagement (WVG §7) helpers extracted from TacticalEngine.

import type { HitZone, SuspectState } from './types';

export interface LethalTargetState {
  isArmed: boolean;
  hasPointedWeaponAtPolice: boolean;
  state: SuspectState;
}

export function isLawfulThreat(target: LethalTargetState): boolean {
  if (!target.isArmed) return false;
  return (
    target.hasPointedWeaponAtPolice ||
    target.state === 'AIMING_WINDUP' ||
    target.state === 'USING_HUMAN_SHIELD' ||
    target.state === 'FIRING'
  );
}

export type LethalShotVerdict = 'UNLAWFUL' | 'LIMB' | 'TORSO';

export const LETHAL_SHOT_POINTS: Record<LethalShotVerdict, number> = {
  UNLAWFUL: -450,
  LIMB: 120,
  TORSO: 50,
};

/**
 * Classifies a player-side bullet that struck a suspect: disproportionate force, a deliberate
 * incapacitating limb shot, or an authorised torso shot.
 */
export function classifyLethalShot(target: LethalTargetState, hitZone: HitZone): LethalShotVerdict {
  const alreadyNeutralised = target.state === 'SURRENDERED' || target.state === 'ARRESTED';
  if (alreadyNeutralised || !isLawfulThreat(target)) return 'UNLAWFUL';
  return hitZone === 'LEGS' || hitZone === 'ARMS' ? 'LIMB' : 'TORSO';
}

export interface RoeEntryInput {
  points: number;
  lawful: boolean;
}

export interface RoeImpact {
  scoreDelta: number;
  violationDelta: number;
  /** Operator XP granted by the entry (65% of a lawful reward). */
  xpAward: number;
  isViolation: boolean;
}

export const ROE_XP_RATIO = 0.65;

export function computeRoeImpact({ points, lawful }: RoeEntryInput): RoeImpact {
  const isViolation = !lawful;
  return {
    scoreDelta: points,
    violationDelta: isViolation ? 1 : 0,
    xpAward: lawful && points > 0 ? Math.round(points * ROE_XP_RATIO) : 0,
    isViolation,
  };
}
