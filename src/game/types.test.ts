import { describe, expect, it } from 'vitest';
import { computePlayerMissionRank } from './types';

describe('computePlayerMissionRank', () => {
  it('returns suspended rank for negative score', () => {
    const rank = computePlayerMissionRank(-100);
    expect(rank.isDemoted).toBe(true);
    expect(rank.badgeCode).toBe('SUS');
  });

  it('returns first tier at score 0', () => {
    const rank = computePlayerMissionRank(0);
    expect(rank.badgeCode).toBe('ASP');
    expect(rank.isDemoted).toBe(false);
  });

  it('returns max rank at high score', () => {
    const rank = computePlayerMissionRank(5000);
    expect(rank.isMaxRank).toBe(true);
    expect(rank.badgeCode).toBe('ELT');
  });
});