import { describe, expect, it } from 'vitest';
import {
  classifyLethalShot,
  computeRoeImpact,
  isLawfulThreat,
  LETHAL_SHOT_POINTS,
  type LethalTargetState,
} from './roe';

const armedAlerted: LethalTargetState = {
  isArmed: true,
  hasPointedWeaponAtPolice: false,
  state: 'ALERTED',
};

describe('isLawfulThreat', () => {
  it('an unarmed suspect is never a lawful target, even when aiming', () => {
    expect(isLawfulThreat({ ...armedAlerted, isArmed: false, state: 'FIRING' })).toBe(false);
  });

  it('armed suspects become lawful targets by aiming, firing or holding a shield', () => {
    expect(isLawfulThreat({ ...armedAlerted, state: 'AIMING_WINDUP' })).toBe(true);
    expect(isLawfulThreat({ ...armedAlerted, state: 'FIRING' })).toBe(true);
    expect(isLawfulThreat({ ...armedAlerted, state: 'USING_HUMAN_SHIELD' })).toBe(true);
    expect(isLawfulThreat({ ...armedAlerted, hasPointedWeaponAtPolice: true })).toBe(true);
  });

  it('an armed suspect who is not threatening anyone is not a lawful target', () => {
    expect(isLawfulThreat(armedAlerted)).toBe(false);
  });
});

describe('classifyLethalShot', () => {
  it('torso hits on a lawful threat are authorised', () => {
    expect(classifyLethalShot({ ...armedAlerted, state: 'AIMING_WINDUP' }, 'TORSO')).toBe('TORSO');
    expect(classifyLethalShot({ ...armedAlerted, hasPointedWeaponAtPolice: true }, 'TORSO')).toBe(
      'TORSO'
    );
  });

  it('limb hits on a lawful threat count as incapacitation', () => {
    expect(classifyLethalShot({ ...armedAlerted, state: 'FIRING' }, 'LEGS')).toBe('LIMB');
    expect(classifyLethalShot({ ...armedAlerted, state: 'FIRING' }, 'ARMS')).toBe('LIMB');
  });

  it('firing at an unarmed suspect is always unlawful', () => {
    expect(
      classifyLethalShot({ isArmed: false, hasPointedWeaponAtPolice: true, state: 'FIRING' }, 'TORSO')
    ).toBe('UNLAWFUL');
  });

  it('shooting a surrendered or arrested suspect is unlawful even when armed', () => {
    expect(classifyLethalShot({ ...armedAlerted, state: 'SURRENDERED' }, 'TORSO')).toBe('UNLAWFUL');
    expect(classifyLethalShot({ ...armedAlerted, state: 'ARRESTED' }, 'LEGS')).toBe('UNLAWFUL');
  });

  it('keeps the WVG §7 penalty table', () => {
    expect(LETHAL_SHOT_POINTS.UNLAWFUL).toBe(-450);
    expect(LETHAL_SHOT_POINTS.LIMB).toBe(120);
    expect(LETHAL_SHOT_POINTS.TORSO).toBe(50);
  });
});

describe('computeRoeImpact', () => {
  it('an illegal action subtracts score, counts a violation and grants no xp', () => {
    const impact = computeRoeImpact({ points: -450, lawful: false });
    expect(impact.scoreDelta).toBe(-450);
    expect(impact.violationDelta).toBe(1);
    expect(impact.isViolation).toBe(true);
    expect(impact.xpAward).toBe(0);
  });

  it('a lawful reward grants 65% of its points as operator xp', () => {
    const impact = computeRoeImpact({ points: 120, lawful: true });
    expect(impact.scoreDelta).toBe(120);
    expect(impact.violationDelta).toBe(0);
    expect(impact.isViolation).toBe(false);
    expect(impact.xpAward).toBe(78);
  });

  it('lawful entries without points grant no xp', () => {
    expect(computeRoeImpact({ points: 0, lawful: true }).xpAward).toBe(0);
  });

  it('negative points are always a violation even if flagged lawful', () => {
    const impact = computeRoeImpact({ points: -50, lawful: true });
    expect(impact.xpAward).toBe(0);
    expect(impact.violationDelta).toBe(0);
    expect(impact.scoreDelta).toBe(-50);
  });
});
