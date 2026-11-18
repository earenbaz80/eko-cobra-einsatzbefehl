import { describe, expect, it, vi } from 'vitest';
import {
  C4ChargeSystem,
  C4_CANCEL_DISTANCE,
  C4_PLANT_SECONDS,
  C4_SAFE_RADIUS,
  type C4Dependencies,
  type C4PlantTarget,
} from './c4Charges';
import type { ActiveC4Charge, ActorEntity } from './types';

const DOOR: C4PlantTarget = {
  targetName: 'Puerta de servicio',
  x: 400,
  y: 300,
  doorId: 'DOOR_1',
  isWindow: false,
};

function makeActor(id: string, x: number, y: number): ActorEntity {
  return { id, name: id, role: 'PLAYER', x, y, state: 'ALERTED' } as unknown as ActorEntity;
}

function makeCharge(
  id: string,
  x = DOOR.x,
  y = DOOR.y,
  doorId: string | undefined = DOOR.doorId
): ActiveC4Charge {
  return {
    id,
    targetName: DOOR.targetName,
    x,
    y,
    remainingSeconds: 0,
    maxSeconds: 0,
    doorId,
    isWindow: false,
    phase: 'ARMED',
    safeToDetonate: false,
  };
}

/** Dependencias dobles: el jugador se coloca cerca del objetivo por defecto. */
function makeDeps(overrides: Partial<C4Dependencies> = {}): C4Dependencies {
  return {
    getPlayer: () => makeActor('OPERATOR_1', DOOR.x + 20, DOOR.y),
    getFriendlies: () => [],
    isDoorTargetValid: () => true,
    isTrainingMode: false,
    pushRadio: vi.fn(),
    emitHudSnapshot: vi.fn(),
    playPlantStarted: vi.fn(),
    playArmedWarning: vi.fn(),
    explode: vi.fn(),
    ...overrides,
  };
}

describe('C4ChargeSystem', () => {
  it('cancela el plantado cuando el operador se aleja del objetivo', () => {
    const system = new C4ChargeSystem();
    const player = makeActor('OPERATOR_1', DOOR.x + 20, DOOR.y);
    const deps = makeDeps({ getPlayer: () => player });

    expect(system.beginPlant(DOOR, deps)).toBe(true);
    player.x = DOOR.x + C4_CANCEL_DISTANCE + 1;
    system.updatePlanting(0.5, deps);

    expect(system.planting).toBeUndefined();
    expect(system.charges).toHaveLength(0);
    expect(system.count).toBe(2);
    expect(deps.pushRadio).toHaveBeenCalledWith(
      'KOBRA-1',
      expect.stringContaining('se alejó'),
      'warn'
    );
  });

  it('en la galería de tiro planta a distancia y no consume inventario', () => {
    const system = new C4ChargeSystem();
    const player = makeActor('OPERATOR_1', DOOR.x + 400, DOOR.y);
    const deps = makeDeps({ getPlayer: () => player, isTrainingMode: true });

    expect(system.beginPlant(DOOR, deps)).toBe(true);
    system.updatePlanting(C4_PLANT_SECONDS, deps);

    expect(system.planting).toBeUndefined();
    expect(system.charges).toHaveLength(1);
    expect(system.count).toBe(2);
  });

  it('rechaza una segunda carga en el mismo objetivo', () => {
    const system = new C4ChargeSystem();
    system.charges = [makeCharge('c4_existente')];
    const deps = makeDeps();

    expect(system.beginPlant(DOOR, deps)).toBe(false);

    expect(system.planting).toBeUndefined();
    expect(system.charges).toHaveLength(1);
    expect(deps.pushRadio).toHaveBeenCalledWith(
      'KOBRA-1',
      expect.stringContaining('Ya hay una carga activa'),
      'warn'
    );
  });

  it('bloquea la detonación mientras el binomio siga dentro del radio seguro', () => {
    const system = new C4ChargeSystem();
    const charge = makeCharge('c4_1');
    system.charges = [charge];
    const squad = makeActor('KOBRA-2', charge.x + C4_SAFE_RADIUS - 1, charge.y);
    const deps = makeDeps({ getFriendlies: () => [squad] });

    system.detonate(deps);

    expect(deps.explode).not.toHaveBeenCalled();
    expect(system.charges).toHaveLength(1);
    expect(deps.pushRadio).toHaveBeenCalledWith(
      'KOBRA-1',
      expect.stringContaining('radio de seguridad'),
      'warn'
    );

    // Justo en el borde del radio ya se considera despejado.
    squad.x = charge.x + C4_SAFE_RADIUS;
    system.detonate(deps);

    expect(deps.explode).toHaveBeenCalledTimes(1);
    expect(system.charges).toHaveLength(0);
  });

  it('detona todas las cargas en orden y vacía el inventario', () => {
    const system = new C4ChargeSystem();
    system.charges = [makeCharge('c4_a', 100, 100), makeCharge('c4_b', 300, 300, 'DOOR_2')];
    const detonadas: string[] = [];
    const deps = makeDeps({
      explode: vi.fn((charge: ActiveC4Charge) => detonadas.push(`${charge.id}:${charge.phase}`)),
    });

    system.detonate(deps);

    expect(detonadas).toEqual(['c4_a:DETONATING', 'c4_b:DETONATING']);
    expect(system.charges).toHaveLength(0);
  });
});
