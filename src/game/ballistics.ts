// Pure ballistics helpers extracted from TacticalEngine (hit zones, zone wounds, training score).

import type { HitZone } from './types';

export type AimZoneMode = 'TORSO' | 'EXTREMITIES';

export interface HitZoneSelection {
  /** True for the operator and the Kobra-2 squadmate, false for hostile fire. */
  shooterIsPlayerSide: boolean;
  aimZoneMode: AimZoneMode;
  /** Distance from the target's centre of mass divided by its radius (0 = dead centre). */
  offsetRatio?: number;
  /** Random value in [0, 1), injected so the distribution is testable. */
  roll: number;
}

/**
 * Resolves which body zone a bullet lands in.
 * Player-side shots are geometric: the further from the centre of mass, the more peripheral
 * the wound. Hostile fire is spread by a weighted roll instead.
 */
export function selectHitZone({
  shooterIsPlayerSide,
  aimZoneMode,
  offsetRatio = 0,
  roll,
}: HitZoneSelection): HitZone {
  if (shooterIsPlayerSide) {
    if (aimZoneMode === 'EXTREMITIES') {
      return roll < 0.54 ? 'LEGS' : 'ARMS';
    }
    if (offsetRatio > 0.78) return 'LEGS';
    if (offsetRatio > 0.48) return 'ARMS';
    return 'TORSO';
  }

  if (roll < 0.44) return 'TORSO';
  if (roll < 0.74) return 'LEGS';
  return 'ARMS';
}

export const TRAINING_ZONE_POINTS: Record<HitZone, number> = {
  TORSO: 100,
  ARMS: 70,
  LEGS: 50,
};

export function trainingScoreForZone(zone: HitZone): number {
  return TRAINING_ZONE_POINTS[zone];
}

export interface BodyZoneState {
  torso: number;
  arms: number;
  legs: number;
}

export interface ZoneWound {
  /** Body-part health after the hit (never negative). */
  next: BodyZoneState;
  /** Damage dealt to overall hit points, already scaled by the zone. */
  hpDamage: number;
  moraleLoss: number;
  stunSeconds: number;
  /** Limb hits can shoot the weapon out of a suspect's hands. */
  disarmed: boolean;
}

/** Below this arm health the suspect drops the weapon. */
export const DISARM_ARM_THRESHOLD = 50;

const LEG_DAMAGE_MULT = 1.45;
const LEG_HP_MULT = 0.52;
const LEG_MORALE_LOSS = 44;
const LEG_STUN_SECONDS = 1.3;

const ARM_DAMAGE_MULT = 1.55;
const ARM_HP_MULT = 0.48;
const ARM_MORALE_LOSS = 48;

const TORSO_MORALE_LOSS = 35;

/**
 * Applies a ballistic wound to a body-zone state.
 * Limbs take amplified part damage but bleed less overall HP than a torso hit.
 */
export function applyZoneWound(
  zone: HitZone,
  damage: number,
  current: BodyZoneState,
  isArmed: boolean
): ZoneWound {
  const safeDamage = Math.max(0, damage);

  if (zone === 'LEGS') {
    return {
      next: { ...current, legs: Math.max(0, current.legs - Math.round(safeDamage * LEG_DAMAGE_MULT)) },
      hpDamage: Math.round(safeDamage * LEG_HP_MULT),
      moraleLoss: LEG_MORALE_LOSS,
      stunSeconds: LEG_STUN_SECONDS,
      disarmed: false,
    };
  }

  if (zone === 'ARMS') {
    const arms = Math.max(0, current.arms - Math.round(safeDamage * ARM_DAMAGE_MULT));
    return {
      next: { ...current, arms },
      hpDamage: Math.round(safeDamage * ARM_HP_MULT),
      moraleLoss: ARM_MORALE_LOSS,
      stunSeconds: 0,
      disarmed: arms <= DISARM_ARM_THRESHOLD && isArmed,
    };
  }

  return {
    next: { ...current, torso: Math.max(0, current.torso - safeDamage) },
    hpDamage: safeDamage,
    moraleLoss: TORSO_MORALE_LOSS,
    stunSeconds: 0,
    disarmed: false,
  };
}
