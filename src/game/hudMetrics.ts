// Pure, testable helpers extracted from TacticalEngine.emitHudSnapshot

export function computeMoveSpeedPct(
  legs: number,
  bleeding: boolean,
  exhaustionSpeedPenalty: number,
  gait: 'RESTING' | 'WALKING' | 'SPRINTING',
  focusedAimActive: boolean
): number {
  const gaitMult = gait === 'SPRINTING' ? 1.36 : focusedAimActive ? 0.78 : 1.0;
  return Math.round((0.42 + 0.58 * (legs / 100)) * (bleeding ? 0.88 : 1) * exhaustionSpeedPenalty * gaitMult * 100);
}

export function computePulseStabilityPct(
  fatigue: number,
  torso: number,
  arms: number,
  bleeding: boolean,
  focusedAimActive: boolean
): number {
  const raw =
    (100 - fatigue * 0.62 - (100 - torso) * 0.22 - (100 - arms) * 0.16) *
      (bleeding ? 0.82 : 1) +
    (focusedAimActive ? 8 : 0);
  return Math.min(100, Math.max(20, Math.round(raw)));
}

export function computeAccuracyPct(
  arms: number,
  torso: number,
  bleeding: boolean,
  fatigue: number,
  focusedAimActive: boolean
): number {
  const fatigueRatio = fatigue / 100;
  const raw =
    (arms * 0.82 + torso * 0.18) * (bleeding ? 0.78 : 1) * (1 - fatigueRatio * 0.44) +
    (focusedAimActive ? 12 : 0);
  return Math.min(100, Math.max(22, Math.round(raw)));
}

export function computeVisionStabilityPct(
  torso: number,
  arms: number,
  bleeding: boolean,
  fatigue: number
): number {
  const fatigueRatio = fatigue / 100;
  const raw = (torso * 0.7 + arms * 0.3) * (bleeding ? 0.72 : 1) * (1 - fatigueRatio * 0.28);
  return Math.max(28, Math.round(raw));
}

export function computePulseBpm(
  fatigue: number,
  torso: number,
  bleeding: boolean,
  elapsedSeconds: number
): number {
  const fatigueRatio = fatigue / 100;
  const raw =
    68 +
    fatigueRatio * 78 +
    ((100 - torso) / 100) * 22 +
    (bleeding ? 18 : 0) +
    Math.sin(elapsedSeconds * 4.2) * 2;
  return Math.round(raw);
}