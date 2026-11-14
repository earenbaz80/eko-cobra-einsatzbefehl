import { describe, expect, it } from 'vitest';
import { BREACH_MORALE_BREAK, canSurrender, resolveBreachReaction } from './suspectAi';

describe('canSurrender', () => {
  it('blocks suspects that are already neutralised', () => {
    expect(canSurrender('SURRENDERED')).toBe(false);
    expect(canSurrender('ARRESTED')).toBe(false);
    expect(canSurrender('DEAD')).toBe(false);
  });

  it('allows an active suspect to give up', () => {
    expect(canSurrender('UNAWARE')).toBe(true);
    expect(canSurrender('ALERTED')).toBe(true);
    expect(canSurrender('FIRING')).toBe(true);
    expect(canSurrender('FEIGNING_SURRENDER')).toBe(true);
  });
});

describe('resolveBreachReaction', () => {
  it('keeps confident suspects merely hesitating', () => {
    expect(resolveBreachReaction(100, 0.1)).toBe('HESITATING');
    expect(resolveBreachReaction(BREACH_MORALE_BREAK + 1, 0.99)).toBe('HESITATING');
  });

  it('breaks morale at the threshold with weighted outcomes', () => {
    expect(resolveBreachReaction(BREACH_MORALE_BREAK, 0.47)).toBe('SURRENDER');
    expect(resolveBreachReaction(10, 0.5)).toBe('FLEEING');
    expect(resolveBreachReaction(0, 0.9)).toBe('PANIC');
  });

  it('surrender and flight are the most likely reactions of a broken suspect', () => {
    const outcomes = Array.from({ length: 100 }, (_, i) => resolveBreachReaction(0, i / 100));
    const surrenders = outcomes.filter((o) => o === 'SURRENDER').length;
    const flights = outcomes.filter((o) => o === 'FLEEING').length;
    expect(surrenders).toBe(48);
    expect(flights).toBe(30);
    expect(outcomes.filter((o) => o === 'PANIC').length).toBe(22);
  });
});
