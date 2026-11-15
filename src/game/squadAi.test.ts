import { describe, expect, it } from 'vitest';
import {
  chooseSquadSteeringAngle,
  computeSquadNavTarget,
  SQUAD_OVERWATCH_LEAD,
  SQUAD_STAGGERED_DISTANCE,
  SQUAD_STAGGERED_OFFSET,
  SQUAD_TAIL_DISTANCE,
  SQUAD_WEDGE_DISTANCE,
  SQUAD_WEDGE_OFFSET,
  type SquadNavInput,
} from './squadAi';
import type { SquadCommand } from './types';

const player = { x: 100, y: 200, angle: 0 };

const base: SquadNavInput = {
  command: 'FOLLOW',
  player,
  playerReloadingOrBleeding: false,
  doorBlocking: false,
};

describe('computeSquadNavTarget', () => {
  it('trails the operator by default when following', () => {
    const target = computeSquadNavTarget(base);
    expect(target).not.toBeNull();
    expect(target!.x).toBeCloseTo(player.x - SQUAD_TAIL_DISTANCE);
    expect(target!.y).toBeCloseTo(player.y);
  });

  it('walks to the rally point when one is marked', () => {
    expect(computeSquadNavTarget({ ...base, rallyPoint: { x: 500, y: 300 } })).toEqual({
      x: 500,
      y: 300,
    });
  });

  it('takes overwatch in front while the operator reloads or bleeds', () => {
    const target = computeSquadNavTarget({ ...base, playerReloadingOrBleeding: true });
    expect(target!.x).toBeCloseTo(player.x + SQUAD_OVERWATCH_LEAD);
    expect(target!.y).toBeCloseTo(player.y);
  });

  it('the rally point wins over the overwatch move', () => {
    const target = computeSquadNavTarget({
      ...base,
      playerReloadingOrBleeding: true,
      rallyPoint: { x: 10, y: 20 },
    });
    expect(target).toEqual({ x: 10, y: 20 });
  });

  it('stacks beside a closed door instead of following', () => {
    const target = computeSquadNavTarget({
      ...base,
      doorBlocking: true,
      stackPosition: { x: 250, y: 250 },
    });
    expect(target).toEqual({ x: 250, y: 250 });
  });

  it('ignores the stack position once the door is open', () => {
    const target = computeSquadNavTarget({
      ...base,
      doorBlocking: false,
      stackPosition: { x: 250, y: 250 },
    });
    expect(target!.x).toBeCloseTo(player.x - SQUAD_TAIL_DISTANCE);
  });

  it('flanks left in wedge and right in staggered formation', () => {
    const wedge = computeSquadNavTarget({ ...base, command: 'FORM_WEDGE' });
    expect(wedge!.x).toBeCloseTo(player.x + Math.cos(SQUAD_WEDGE_OFFSET) * SQUAD_WEDGE_DISTANCE);
    expect(wedge!.y).toBeCloseTo(player.y + Math.sin(SQUAD_WEDGE_OFFSET) * SQUAD_WEDGE_DISTANCE);

    const staggered = computeSquadNavTarget({ ...base, command: 'FORM_STAGGERED' });
    expect(staggered!.x).toBeCloseTo(
      player.x + Math.cos(SQUAD_STAGGERED_OFFSET) * SQUAD_STAGGERED_DISTANCE
    );
    expect(staggered!.y).toBeCloseTo(
      player.y + Math.sin(SQUAD_STAGGERED_OFFSET) * SQUAD_STAGGERED_DISTANCE
    );
  });

  it('keeps the direct bearing when the probe is clear', () => {
    expect(chooseSquadSteeringAngle(0.4, () => false)).toBe(0.4);
  });

  it('steers around an obstacle and reuses the preferred side', () => {
    const blocked = new Set([0, 0.55, -0.55]);
    const isBlocked = (angle: number) => blocked.has(Number(angle.toFixed(2)));

    expect(chooseSquadSteeringAngle(0, isBlocked)).toBeCloseTo(1.05);
    expect(chooseSquadSteeringAngle(0, isBlocked, -1)).toBeCloseTo(-1.05);
  });

  it('returns the desired bearing when every probe is blocked', () => {
    expect(chooseSquadSteeringAngle(1.2, () => true)).toBe(1.2);
  });

  it('holds the sector for hold, breach and support orders', () => {
    const holdingOrders: SquadCommand[] = [
      'HOLD',
      'BREACH_AND_CLEAR',
      'PIE_DOOR',
      'DEPLOY_CS_GAS',
      'SUPPRESS_TARGET',
      'REGROUP_HEAL',
    ];
    for (const command of holdingOrders) {
      expect(computeSquadNavTarget({ ...base, command })).toBeNull();
    }
  });
});
