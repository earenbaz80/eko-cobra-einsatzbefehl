import { describe, expect, it } from 'vitest';
import {
  computeMoveSpeedPct,
  computePulseStabilityPct,
  computeAccuracyPct,
  computeVisionStabilityPct,
  computePulseBpm,
} from './hudMetrics';

describe('hudMetrics', () => {
  it('move speed drops with damaged legs', () => {
    const healthy = computeMoveSpeedPct(100, false, 1, 'WALKING', false);
    const injured = computeMoveSpeedPct(40, false, 1, 'WALKING', false);
    expect(injured).toBeLessThan(healthy);
  });

  it('bleeding reduces accuracy', () => {
    const normal = computeAccuracyPct(90, 90, false, 20, false);
    const bleeding = computeAccuracyPct(90, 90, true, 20, false);
    expect(bleeding).toBeLessThan(normal);
  });

  it('focused aim boosts pulse stability', () => {
    const base = computePulseStabilityPct(30, 90, 90, false, false);
    const focused = computePulseStabilityPct(30, 90, 90, false, true);
    expect(focused).toBeGreaterThanOrEqual(base);
  });

  it('vision stability never below 28', () => {
    expect(computeVisionStabilityPct(0, 0, true, 100)).toBeGreaterThanOrEqual(28);
  });

  it('pulse bpm increases with fatigue', () => {
    const rested = computePulseBpm(10, 100, false, 0);
    const tired = computePulseBpm(90, 100, false, 0);
    expect(tired).toBeGreaterThan(rested);
  });
});