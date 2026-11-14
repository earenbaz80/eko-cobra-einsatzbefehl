import { describe, expect, it } from 'vitest';
import {
  applyZoneWound,
  selectHitZone,
  trainingScoreForZone,
  type HitZoneSelection,
} from './ballistics';

const healthy = { torso: 100, arms: 100, legs: 100 };

describe('selectHitZone', () => {
  it('deliberate limb targeting ignores the geometry of the impact', () => {
    const config: HitZoneSelection = {
      shooterIsPlayerSide: true,
      aimZoneMode: 'EXTREMITIES',
      offsetRatio: 0,
      roll: 0,
    };
    expect(selectHitZone({ ...config, roll: 0.1 })).toBe('LEGS');
    expect(selectHitZone({ ...config, roll: 0.9 })).toBe('ARMS');
  });

  it('torso aim maps the offset from the centre of mass to a zone', () => {
    const config: HitZoneSelection = {
      shooterIsPlayerSide: true,
      aimZoneMode: 'TORSO',
      roll: 0,
    };
    expect(selectHitZone({ ...config, offsetRatio: 0.2 })).toBe('TORSO');
    expect(selectHitZone({ ...config, offsetRatio: 0.6 })).toBe('ARMS');
    expect(selectHitZone({ ...config, offsetRatio: 0.95 })).toBe('LEGS');
  });

  it('respects the exact 0.48 and 0.78 boundaries', () => {
    const config: HitZoneSelection = {
      shooterIsPlayerSide: true,
      aimZoneMode: 'TORSO',
      roll: 0,
    };
    expect(selectHitZone({ ...config, offsetRatio: 0.48 })).toBe('TORSO');
    expect(selectHitZone({ ...config, offsetRatio: 0.49 })).toBe('ARMS');
    expect(selectHitZone({ ...config, offsetRatio: 0.78 })).toBe('ARMS');
    expect(selectHitZone({ ...config, offsetRatio: 0.79 })).toBe('LEGS');
  });

  it('hostile fire is weighted towards the torso', () => {
    const config: HitZoneSelection = { shooterIsPlayerSide: false, aimZoneMode: 'TORSO', roll: 0 };
    expect(selectHitZone({ ...config, roll: 0.43 })).toBe('TORSO');
    expect(selectHitZone({ ...config, roll: 0.5 })).toBe('LEGS');
    expect(selectHitZone({ ...config, roll: 0.9 })).toBe('ARMS');
  });
});

describe('applyZoneWound', () => {
  it('a leg hit cripples movement but bleeds less core hp', () => {
    const wound = applyZoneWound('LEGS', 100, healthy, true);
    expect(wound.next.legs).toBe(0);
    expect(wound.hpDamage).toBe(52);
    expect(wound.moraleLoss).toBe(44);
    expect(wound.stunSeconds).toBe(1.3);
    expect(wound.disarmed).toBe(false);
    expect(wound.next.torso).toBe(100);
  });

  it('an arm hit that drops the arm below 50 disarms an armed suspect', () => {
    const wound = applyZoneWound('ARMS', 100, healthy, true);
    expect(wound.next.arms).toBe(0);
    expect(wound.hpDamage).toBe(48);
    expect(wound.moraleLoss).toBe(48);
    expect(wound.disarmed).toBe(true);
  });

  it('the same arm hit cannot disarm an unarmed suspect', () => {
    expect(applyZoneWound('ARMS', 100, healthy, false).disarmed).toBe(false);
  });

  it('a grazing arm hit does not disarm', () => {
    const wound = applyZoneWound('ARMS', 20, healthy, true);
    expect(wound.next.arms).toBe(69);
    expect(wound.disarmed).toBe(false);
  });

  it('a torso hit costs full damage and never disarms', () => {
    const wound = applyZoneWound('TORSO', 60, healthy, true);
    expect(wound.next.torso).toBe(40);
    expect(wound.hpDamage).toBe(60);
    expect(wound.moraleLoss).toBe(35);
    expect(wound.stunSeconds).toBe(0);
    expect(wound.disarmed).toBe(false);
  });

  it('clamps body parts at zero and ignores negative damage', () => {
    const wound = applyZoneWound('LEGS', -50, { torso: 100, arms: 100, legs: 10 }, false);
    expect(wound.next.legs).toBe(10);
    expect(wound.hpDamage).toBe(0);
  });

  it('training score rewards torso hits over limbs', () => {
    expect(trainingScoreForZone('TORSO')).toBe(100);
    expect(trainingScoreForZone('ARMS')).toBe(70);
    expect(trainingScoreForZone('LEGS')).toBe(50);
  });
});
