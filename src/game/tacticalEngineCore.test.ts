import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TacticalEngineCore } from './TacticalEngineCore';
import { C4ChargeSystem } from './c4Charges';
import { createGrazApartmentLayout } from './grazMap';
import { soundEngine } from './soundEngine';
import type { ActorEntity, DoorEntity, LightSwitchEntity, WallSconceLight } from './types';

/**
 * El motor real necesita un canvas para construirse. Para probar su lógica
 * táctica usamos una instancia del prototipo y sustituimos solo las
 * dependencias de navegador/efectos. Así las pruebas ejercitan los métodos
 * reales y no una copia de su lógica.
 */
function createEngine(overrides: Record<string, unknown> = {}): any {
  const { c4Count = 2, activeC4Charges = [], ...rest } = overrides;
  const c4 = new C4ChargeSystem();
  c4.count = c4Count as number;
  c4.charges = activeC4Charges as typeof c4.charges;
  const engine = Object.create(TacticalEngineCore.prototype) as any;
  Object.assign(engine, {
    squadCommand: 'FOLLOW',
    tacticalWaypoint: undefined,
    tacticalMarkers: [],
    impactRings: [],
    impactPopups: [],
    particles: [],
    actors: [],
    evidenceList: [],
    doors: [],
    walls: [],
    furniture: [],
    commandPulseTimer: 0,
    squadHoldAnchorAngle: 0,
    squadScanningTimer: 0,
    squadSteerSide: 1,
    squadDoorCooldown: 0,
    squadDoorWarnCooldown: 0,
    squadFatigue: 0,
    currentMovementGait: 'RESTING',
    reloadTimer: 0,
    c4,
    pushRadio: vi.fn(),
    emitHudSnapshot: vi.fn(),
    ...rest,
  });
  return engine;
}

const player = {
  id: 'OPERATOR_1',
  name: 'Kobra-1',
  role: 'PLAYER',
  x: 185,
  y: 410,
  angle: 0,
} as unknown as ActorEntity;

const squad = {
  id: 'KOBRA_2',
  name: 'Kobra-2',
  role: 'SQUAD',
  x: 160,
  y: 455,
  angle: Math.PI / 3,
  radius: 14,
  state: 'ALERTED',
  investigateTarget: { x: 999, y: 999 },
} as unknown as ActorEntity;

const mainDoor = {
  id: 'DOOR_MAIN_A',
  name: 'Tür A (Haupteingang)',
  x1: 250,
  y1: 375,
  x2: 250,
  y2: 445,
  hingeX: 250,
  hingeY: 375,
  closedAngle: Math.PI / 2,
  openAngle: 0,
  currentAngle: Math.PI / 2,
  isOpen: false,
  isLocked: true,
  isBreached: false,
  mirrored: false,
  roomA: 'STIEGENHAUS',
  roomB: 'VORRAUM',
} as DoorEntity;

const makeSconce = (overrides: Partial<WallSconceLight> = {}): WallSconceLight => ({
  id: 'lamp',
  x: 130,
  y: 100,
  normalAngle: 0,
  color: 'rgba(251, 191, 36, 0.36)',
  coreColor: '#FDE68A',
  radius: 120,
  style: 'WARM_SCONCE',
  isDestroyed: false,
  isOn: true,
  ...overrides,
});

const commandEngine = () => {
  const stack = { x: 212, y: 347 };
  const engine = createEngine({
    getPlayer: vi.fn(() => player),
    getSquadmate: vi.fn(() => squad),
    findNearestClosedDoor: vi.fn(() => mainDoor),
    findTacticalStackPosition: vi.fn(() => stack),
  });
  return { engine, stack };
};

beforeEach(() => {
  squad.investigateTarget = { x: 999, y: 999 };
  squad.gestureKind = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('órdenes de Kobra 2', () => {
  it('BREACH_AND_CLEAR apunta a la posición de acumulación, no al centro de la puerta', () => {
    const { engine, stack } = commandEngine();
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('BREACH_AND_CLEAR');

    expect(engine.findTacticalStackPosition).toHaveBeenCalledWith(mainDoor, player);
    expect(squad.investigateTarget).toEqual(stack);
    expect(squad.investigateTarget).not.toEqual({ x: 250, y: 410 });
    expect(engine.squadCommand).toBe('BREACH_AND_CLEAR');
    expect(squad.gestureKind).toBe('BREACH');
  });

  it('PIE_DOOR apunta a la posición de acumulación para ejecutar la sonda', () => {
    const { engine, stack } = commandEngine();
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('PIE_DOOR');

    expect(engine.findTacticalStackPosition).toHaveBeenCalledWith(mainDoor, player);
    expect(squad.investigateTarget).toEqual(stack);
    expect(engine.squadCommand).toBe('PIE_DOOR');
    expect(squad.gestureKind).toBe('POINT');
  });

  it('confirma la orden con una burbuja de texto', () => {
    const { engine } = commandEngine();
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('RESTRAIN_AND_SECURE');

    expect(squad.speechBubble?.text).toContain('Sichere Verdächtige');
  });

  it('conserva la confirmación de Kobra-2 con la radio silenciada', () => {
    const { engine } = commandEngine();
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});
    soundEngine.setRadioAudioEnabled(false);

    engine.issueSquadCommand('HOLD');

    expect(squad.speechBubble?.text).toBe('Sichere diesen Sektor!');
    expect(engine.pushRadio).toHaveBeenCalledWith(
      'KOBRA-2',
      '[2] Position gehalten, decke Winkel (Cubriendo sector).',
      'info'
    );
  });

  it('abre una puerta sin llave durante el barrido de seguridad', () => {
    const door = {
      ...mainDoor,
      x1: 200,
      y1: 455,
      x2: 220,
      y2: 455,
      isLocked: false,
      isOpen: false,
    };
    const engine = createEngine({ doors: [door] });
    vi.spyOn(soundEngine, 'playDoorAction').mockImplementation(() => {});

    expect(engine.tryOpenSquadDoor(squad, 0)).toBe(true);
    expect(door.isOpen).toBe(true);
    expect(door.currentAngle).toBe(door.openAngle);
  });

  it('HOLD cancela la brecha y el waypoint anteriores y fija el ángulo de cobertura', () => {
    const { engine } = commandEngine();
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});
    squad.investigateTarget = { x: 250, y: 410 };
    engine.tacticalWaypoint = { x: 300, y: 420 };

    engine.issueSquadCommand('HOLD');

    expect(squad.investigateTarget).toBeUndefined();
    expect(engine.tacticalWaypoint).toBeUndefined();
    expect(engine.squadHoldAnchorAngle).toBeCloseTo(player.angle);
    expect(squad.gestureKind).toBe('HALT');
    expect(engine.squadCommand).toBe('HOLD');
    expect(engine.findTacticalStackPosition).not.toHaveBeenCalled();
  });

  it('brecha y sonda ignoran puertas abiertas al elegir el objetivo', () => {
    const openDoor = { ...mainDoor, id: 'DOOR_OPEN', x1: 300, y1: 375, x2: 300, y2: 445, isOpen: true };
    const closedDoor = { ...mainDoor, id: 'DOOR_CLOSED', x1: 500, y1: 375, x2: 500, y2: 445 };
    for (const command of ['BREACH_AND_CLEAR', 'PIE_DOOR'] as const) {
      const engine = createEngine({
        getPlayer: vi.fn(() => player),
        getSquadmate: vi.fn(() => squad),
        doors: [openDoor, closedDoor],
        findTacticalStackPosition: vi.fn(() => ({ x: 462, y: 347 })),
      });
      vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

      engine.issueSquadCommand(command);

      expect(engine.findTacticalStackPosition).toHaveBeenCalledWith(closedDoor, player);
      expect(squad.investigateTarget).toEqual({ x: 462, y: 347 });
    }
  });

  it('la orden apuntada a una puerta usa esa puerta, no la más cercana', () => {
    const targetDoor = { ...mainDoor, id: 'DOOR_TARGET', x1: 500, y1: 375, x2: 500, y2: 445 };
    const wrongDoor = { ...mainDoor, id: 'DOOR_WRONG', x1: 250, y1: 375, x2: 250, y2: 445 };
    const stack = { x: 462, y: 347 };
    const engine = createEngine({
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => squad),
      doors: [targetDoor, wrongDoor],
      findNearestClosedDoor: vi.fn(() => wrongDoor),
      findTacticalStackPosition: vi.fn(() => stack),
    });
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommandTargeted('BREACH_AND_CLEAR', {
      type: 'DOOR',
      id: targetDoor.id,
      name: targetDoor.name,
      x: 500,
      y: 410,
    });

    expect(engine.squadDoorTargetId).toBe(targetDoor.id);
    expect(squad.investigateTarget).toEqual(stack);
    expect(engine.findTacticalStackPosition).toHaveBeenCalledWith(targetDoor, player);
    expect(engine.findNearestClosedDoor).not.toHaveBeenCalled();
  });

  it('mantiene la puerta fijada y ejecuta la brecha después de llegar, no antes', () => {
    const targetDoor = { ...mainDoor, id: 'DOOR_TARGET', x1: 500, y1: 375, x2: 500, y2: 445 };
    const wrongDoor = { ...mainDoor, id: 'DOOR_WRONG', x1: 800, y1: 375, x2: 800, y2: 445 };
    const breachSquad = { ...squad, roomName: 'STIEGENHAUS' } as ActorEntity;
    const engine = createEngine({
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => breachSquad),
      doors: [targetDoor, wrongDoor],
      rooms: [
        { id: 'STIEGENHAUS', x: 0, y: 0, w: 100, h: 100 },
        { id: 'VORRAUM', x: 200, y: 0, w: 100, h: 100 },
      ],
      plan: { squadGear: 'SHIELD' },
      c4Count: 0,
      findNearestDoor: vi.fn(() => wrongDoor),
      detonateGadgetAt: vi.fn(),
      emitNoise: vi.fn(),
    });
    vi.spyOn(soundEngine, 'playGunshotSpatial').mockImplementation(() => {});
    vi.spyOn(soundEngine, 'playBreachPrep').mockImplementation(() => {});
    const executeBreach = vi
      .spyOn(engine, 'executeBreach')
      .mockImplementation((door: unknown) => {
        const breachedDoor = door as DoorEntity;
        breachedDoor.isLocked = false;
        breachedDoor.isOpen = true;
        breachedDoor.isBreached = true;
      });

    engine.squadDoorTargetId = targetDoor.id;
    engine.beginSquadBreach(targetDoor, breachSquad);

    expect(targetDoor.isOpen).toBe(false);
    expect(targetDoor.isLocked).toBe(true);
    expect(engine.squadBreachAction.mode).toBe('SHOOT_LOCK');

    expect(engine.updateSquadBreachAction(0.6, breachSquad)).toBe(true);
    expect(targetDoor.isLocked).toBe(false);
    expect(targetDoor.isOpen).toBe(false);
    expect(engine.squadBreachAction.mode).toBe('KICK');

    expect(engine.updateSquadBreachAction(0.4, breachSquad)).toBe(true);
    expect(executeBreach).toHaveBeenCalledTimes(1);
    expect(executeBreach).toHaveBeenCalledWith(targetDoor, 'KICK', 'KOBRA-2');
    expect(wrongDoor.isOpen).toBe(false);
    expect(engine.findNearestDoor).not.toHaveBeenCalled();
    expect(engine.squadBreachAction).toBeUndefined();
  });

  it('elige el método de brecha según cerradura, blindaje y equipo', () => {
    const engine = createEngine({ plan: { squadGear: 'SHIELD' }, c4Count: 0 });
    const lockedWoodDoor = { ...mainDoor, isLocked: true };
    const lockedHeavyDoor = { ...mainDoor, id: 'DOOR_ARMORED', name: 'Puerta Blindada de Seguridad' };
    const unlockedDoor = { ...mainDoor, isLocked: false };

    expect(engine.chooseSquadBreachMode(unlockedDoor)).toBe('KICK');
    expect(engine.chooseSquadBreachMode(lockedWoodDoor)).toBe('SHOOT_LOCK');

    engine.c4.count = 1;
    expect(engine.chooseSquadBreachMode(lockedHeavyDoor)).toBe('C4');

    engine.plan = { squadGear: 'RAM' };
    expect(engine.chooseSquadBreachMode(lockedHeavyDoor)).toBe('RAM');
  });

  it('sin puertas cerradas, la brecha avanza hacia el sector del operador', () => {
    const openDoor = { ...mainDoor, isOpen: true };
    const engine = createEngine({
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => squad),
      doors: [openDoor],
    });
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('BREACH_AND_CLEAR');

    expect(squad.investigateTarget).toEqual({ x: 345, y: 410 });
  });

  it('SUPPRESS_TARGET elige un sospechoso visible y descarta el bloqueado', () => {
    const blocked = { id: 'BLOCKED', role: 'SUSPECT', state: 'ALERTED', x: 200, y: 410 };
    const visible = { id: 'VISIBLE', role: 'SUSPECT', state: 'ALERTED', x: 280, y: 410 };
    const engine = createEngine({
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => squad),
      actors: [blocked, visible] as unknown as ActorEntity[],
      raycastWallsAndDoors: vi.fn((_x1: number, _y1: number, x2: number) => x2 === blocked.x),
    });
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('SUPPRESS_TARGET');

    expect(squad.investigateTarget).toEqual({ x: visible.x, y: visible.y });
  });

  it('SUPPRESS_TARGET avanza al sector si no hay línea de tiro', () => {
    const blocked = { id: 'BLOCKED', role: 'SUSPECT', state: 'ALERTED', x: 200, y: 410 };
    const engine = createEngine({
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => squad),
      actors: [blocked] as unknown as ActorEntity[],
      raycastWallsAndDoors: vi.fn(() => true),
    });
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});

    engine.issueSquadCommand('SUPPRESS_TARGET');

    expect(squad.investigateTarget).toEqual({ x: 345, y: 410 });
  });

  it('la acumulación vertical se coloca 38 px al costado y fuera del jamb', () => {
    const engine = createEngine({ collidesAt: vi.fn(() => false) });

    const point = engine.findTacticalStackPosition(mainDoor, player);

    expect(point).toEqual({ x: 212, y: 347 });
    expect(Math.hypot(point.x - 250, point.y - 410)).toBeGreaterThan(38);
  });

  it('findNearestClosedDoor ignora abiertas y destruidas', () => {
    const openDoor = { ...mainDoor, id: 'DOOR_OPEN', x1: 300, y1: 375, x2: 300, y2: 445, isOpen: true };
    const destroyedDoor = {
      ...mainDoor,
      id: 'DOOR_DESTROYED',
      x1: 120,
      y1: 375,
      x2: 120,
      y2: 445,
      isDestroyed: true,
    };
    const closedDoor = { ...mainDoor, id: 'DOOR_CLOSED', x1: 500, y1: 375, x2: 500, y2: 445 };
    const engine = createEngine({ doors: [openDoor, destroyedDoor, closedDoor] });

    expect(engine.findNearestClosedDoor(185, 410)).toBe(closedDoor);
  });

  it('sale del jambá cuando el sondeo lejano está libre pero el paso choca', () => {
    // Reproducción del atasco del humo: con la hoja del todo abierta, el binomio
    // quedó pegado al jambá de abajo en 246,428 mirando a la pila del salón. El
    // punto a 24 px ya pasó el codo y estaba libre, pero el primer tramo de 8 px
    // chocaba con la pared, así que el rumbo recto no avanzaba ni un píxel.
    const openDoor = { ...mainDoor, isOpen: true, isLocked: false, currentAngle: 0 } as DoorEntity;
    const atascado = {
      ...squad,
      x: 246.6,
      y: 428.02,
      investigateTarget: { x: 482, y: 493 },
    } as ActorEntity;
    const engine = createEngine({
      squadCommand: 'BREACH_AND_CLEAR',
      walls: [
        { id: 'w4', x1: 250, y1: 100, x2: 250, y2: 375 },
        { id: 'w5', x1: 250, y1: 445, x2: 250, y2: 720 },
      ],
      doors: [openDoor],
      getPlayer: vi.fn(() => player),
      getSquadmate: vi.fn(() => atascado),
      getRoomAt: vi.fn(() => 'STIEGENHAUS'),
      findNearestDoor: vi.fn(() => null),
    });

    for (let frame = 0; frame < 80; frame += 1) engine.updateSquadmateAI(0.05, player);

    expect(atascado.x).toBeGreaterThan(300);
    expect(Math.hypot(atascado.x - 482, atascado.y - 493)).toBeLessThan(10);
  });

  it('la acumulación horizontal también evita el centro de la puerta', () => {
    const engine = createEngine({ collidesAt: vi.fn(() => false) });
    const horizontalDoor = {
      ...mainDoor,
      id: 'DOOR_KITCHEN',
      x1: 355,
      y1: 280,
      x2: 425,
      y2: 280,
      hingeX: 355,
      hingeY: 280,
    } as DoorEntity;
    const belowDoor = { ...player, x: 390, y: 350 } as ActorEntity;

    const point = engine.findTacticalStackPosition(horizontalDoor, belowDoor);

    expect(point).toEqual({ x: 327, y: 318 });
    expect(point.y).not.toBe(280);
  });
});

describe('luces e interruptores', () => {
  it('el interruptor apaga y vuelve a encender la lámpara', () => {
    const sconce = makeSconce({ isOn: true });
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_lamp',
      sconceId: sconce.id,
      x: 150,
      y: 100,
    };
    const engine = createEngine({ wallSconces: [sconce], impactPopups: [] });
    const playLightSwitch = vi.spyOn(soundEngine, 'playLightSwitch').mockImplementation(() => {});

    engine.toggleLightSwitch(lightSwitch);

    expect(sconce.isOn).toBe(false);
    expect(playLightSwitch).toHaveBeenLastCalledWith(false);
    expect(engine.impactPopups.at(-1)?.text).toBe('LUZ APAGADA');

    engine.toggleLightSwitch(lightSwitch);

    expect(sconce.isOn).toBe(true);
    expect(playLightSwitch).toHaveBeenLastCalledWith(true);
    expect(engine.impactPopups.at(-1)?.text).toBe('LUZ ENCENDIDA');
  });

  it('sin layout, el interruptor queda en el muro donde está la lámpara', () => {
    const sconce = makeSconce({ x: 100, y: 100, normalAngle: Math.PI / 2 });
    const engine = createEngine();

    expect(engine.createLightSwitches([sconce])).toEqual([
      {
        id: 'switch_lamp',
        sconceId: 'lamp',
        sconceIds: ['lamp'],
        x: 100,
        y: 100,
        normalAngle: Math.PI / 2,
      },
    ]);
  });

  it('agrupa las lámparas por estancia y monta un solo interruptor en el muro', () => {
    const rooms = [
      { id: 'A', nameDe: 'A', nameEs: 'A', x: 100, y: 100, w: 200, h: 120, floorColor: '#000', cleared: false },
      { id: 'B', nameDe: 'B', nameEs: 'B', x: 400, y: 100, w: 200, h: 120, floorColor: '#000', cleared: false },
    ];
    const walls = [
      { id: 'a_top', x1: 100, y1: 100, x2: 300, y2: 100 },
      { id: 'a_bottom', x1: 100, y1: 220, x2: 300, y2: 220 },
      { id: 'a_left', x1: 100, y1: 100, x2: 100, y2: 220 },
      { id: 'a_right', x1: 300, y1: 100, x2: 300, y2: 220 },
      { id: 'b_top', x1: 400, y1: 100, x2: 600, y2: 100 },
      { id: 'b_bottom', x1: 400, y1: 220, x2: 600, y2: 220 },
      { id: 'b_left', x1: 400, y1: 100, x2: 400, y2: 220 },
      { id: 'b_right', x1: 600, y1: 100, x2: 600, y2: 220 },
    ];
    const sconces = [
      makeSconce({ id: 'a1', x: 120, y: 120, normalAngle: Math.PI / 2 }),
      makeSconce({ id: 'a2', x: 200, y: 120, normalAngle: Math.PI / 2 }),
      makeSconce({ id: 'b1', x: 500, y: 120, normalAngle: Math.PI / 2 }),
    ];
    const engine = createEngine();

    const switches = engine.createLightSwitches(sconces, rooms, walls);

    expect(switches).toHaveLength(2);
    expect(switches.find((item: LightSwitchEntity) => item.id === 'switch_a')).toMatchObject({
      sconceId: 'a2',
      sconceIds: ['a1', 'a2'],
      x: 200,
      y: 102,
      normalAngle: Math.PI / 2,
    });
    expect(switches.find((item: LightSwitchEntity) => item.id === 'switch_b')).toMatchObject({
      sconceIds: ['b1'],
      x: 500,
      y: 102,
    });
  });

  it('la Misión 1 deja un interruptor por estancia iluminada sobre el muro y fuera del radio de puertas', () => {
    const layout = createGrazApartmentLayout();
    const engine = createEngine();
    const switches = engine.createLightSwitches(
      layout.wallSconces,
      layout.rooms,
      layout.walls,
      layout.doors
    );

    expect(switches).toHaveLength(4);
    expect(switches.flatMap((item: LightSwitchEntity) => item.sconceIds ?? []).sort()).toEqual(
      layout.wallSconces.map((sconce) => sconce.id).sort()
    );

    const distanceToSegment = (px: number, py: number, wall: (typeof layout.walls)[number]) => {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const lengthSq = dx * dx + dy * dy;
      if (!lengthSq) return Math.hypot(px - wall.x1, py - wall.y1);
      const t = Math.min(1, Math.max(0, ((px - wall.x1) * dx + (py - wall.y1) * dy) / lengthSq));
      return Math.hypot(px - (wall.x1 + dx * t), py - (wall.y1 + dy * t));
    };

    for (const lightSwitch of switches) {
      expect(
        layout.walls.some(
          (wall) => !wall.isWindow && distanceToSegment(lightSwitch.x, lightSwitch.y, wall) <= 3
        )
      ).toBe(true);
      for (const door of layout.doors) {
        const dx = door.x2 - door.x1;
        const dy = door.y2 - door.y1;
        const lengthSq = dx * dx + dy * dy;
        const t = lengthSq
          ? Math.min(
              1,
              Math.max(
                0,
                ((lightSwitch.x - door.x1) * dx + (lightSwitch.y - door.y1) * dy) / lengthSq
              )
            )
          : 0;
        expect(
          Math.hypot(
            lightSwitch.x - (door.x1 + dx * t),
            lightSwitch.y - (door.y1 + dy * t)
          )
        ).toBeGreaterThanOrEqual(72);
      }
    }
  });

  it('el interruptor de la estancia acciona todas sus lámparas', () => {
    const first = makeSconce({ id: 'lamp_a', isOn: true });
    const second = makeSconce({ id: 'lamp_b', isOn: true });
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_room',
      sconceId: first.id,
      sconceIds: [first.id, second.id],
      x: 150,
      y: 100,
    };
    const engine = createEngine({ wallSconces: [first, second], impactPopups: [] });
    vi.spyOn(soundEngine, 'playLightSwitch').mockImplementation(() => {});

    engine.toggleLightSwitch(lightSwitch);

    expect(first.isOn).toBe(false);
    expect(second.isOn).toBe(false);

    engine.toggleLightSwitch(lightSwitch);

    expect(first.isOn).toBe(true);
    expect(second.isOn).toBe(true);
  });

  it('un interruptor roto no vuelve a encender una lámpara destruida', () => {
    const sconce = makeSconce({ isDestroyed: true, isOn: false });
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_lamp',
      sconceId: sconce.id,
      x: 150,
      y: 100,
    };
    const engine = createEngine({ wallSconces: [sconce], impactPopups: [] });
    vi.spyOn(soundEngine, 'playUiClick').mockImplementation(() => {});

    engine.toggleLightSwitch(lightSwitch);

    expect(sconce.isOn).toBe(false);
    expect(engine.impactPopups.at(-1)?.text).toBe('INTERRUPTOR SIN LUZ');
  });

  it('un taser no rompe la lámpara', () => {
    const sconce = makeSconce({ x: 130, y: 100 });
    const engine = createEngine({
      wallSconces: [sconce],
      actors: [],
      pointLights: [],
      particles: [],
      decals: [],
      traces: [],
      impactPopups: [],
      plan: { primaryWeapon: 'AUG_PARA' },
      emitNoise: vi.fn(),
      propagateGunshotAlert: vi.fn(),
      spawnSurfaceDebrisEffects: vi.fn(),
      raycastSurface: vi.fn(() => null),
      getPlayer: vi.fn(() => null),
    });
    const shooter = {
      id: 'OPERATOR_1',
      role: 'PLAYER',
      x: 100,
      y: 100,
      angle: 0,
      radius: 14,
    } as unknown as ActorEntity;

    engine.castProjectile(shooter, 0, 260, 0, true);

    expect(sconce.isDestroyed).toBe(false);
    expect(sconce.isOn).toBe(true);
  });

  it('un disparo real rompe la lámpara y la apaga', () => {
    const sconce = makeSconce({ x: 130, y: 100 });
    const engine = createEngine({
      wallSconces: [sconce],
      actors: [],
      pointLights: [],
      particles: [],
      decals: [],
      traces: [],
      impactPopups: [],
      plan: { primaryWeapon: 'AUG_PARA' },
      emitNoise: vi.fn(),
      propagateGunshotAlert: vi.fn(),
      spawnSurfaceDebrisEffects: vi.fn(),
      raycastSurface: vi.fn(() => null),
      getPlayer: vi.fn(() => null),
    });
    const shooter = {
      id: 'OPERATOR_1',
      role: 'PLAYER',
      x: 100,
      y: 100,
      angle: 0,
      radius: 14,
    } as unknown as ActorEntity;

    engine.castProjectile(shooter, 0, 260, 26, false);

    expect(sconce.isDestroyed).toBe(true);
    expect(sconce.isOn).toBe(false);
    expect(engine.impactPopups.some((popup: { text: string }) => popup.text === 'LUZ ROTA')).toBe(
      true
    );
    expect(engine.traces[0].x2).toBeLessThan(sconce.x);
  });

  it('un raycast de IA atraviesa la lámpara sin romperla', () => {
    const sconce = makeSconce();
    const engine = createEngine({
      wallSconces: [sconce],
      walls: [{ id: 'wall', x1: 160, y1: 0, x2: 160, y2: 200 }],
      doors: [],
      furniture: [],
    });

    const hit = engine.raycastSurface(0, 100, 200, 100);

    expect(hit?.kind).toBe('WALL');
    expect(sconce.isDestroyed).toBe(false);
    expect(sconce.isOn).toBe(true);
  });

  it('un actor interactuable cercano oculta el cartel del interruptor', () => {
    const sconce = makeSconce();
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_lamp',
      sconceId: sconce.id,
      x: 150,
      y: 100,
    };
    const surrendered = {
      id: 'SUSPECT',
      role: 'SUSPECT',
      state: 'SURRENDERED',
      x: 150,
      y: 100,
    } as unknown as ActorEntity;
    const engine = createEngine({
      wallSconces: [sconce],
      lightSwitches: [lightSwitch],
      actors: [surrendered],
    });

    expect(engine.getInteractableLightSwitch(150, 100)).toBeNull();
  });

  it('la evidencia cercana oculta el cartel del interruptor', () => {
    const sconce = makeSconce();
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_lamp',
      sconceId: sconce.id,
      x: 150,
      y: 100,
    };
    const engine = createEngine({
      wallSconces: [sconce],
      lightSwitches: [lightSwitch],
      evidenceList: [{ id: 'EV_1', label: 'Kurzwaffe', x: 150, y: 100, secured: false }],
    });

    expect(engine.getInteractableLightSwitch(150, 100)).toBeNull();
  });

  it('una puerta cercana tiene prioridad sobre el interruptor', () => {
    const sconce = makeSconce();
    const lightSwitch: LightSwitchEntity = {
      id: 'switch_lamp',
      sconceId: sconce.id,
      x: 226,
      y: 330,
    };
    const engine = createEngine({
      wallSconces: [sconce],
      lightSwitches: [lightSwitch],
      doors: [mainDoor],
    });

    // A mitad de camino entre el interruptor y la puerta, ambos están en rango.
    expect(engine.getInteractableLightSwitch(236, 365)).toBeNull();
    // Junto al interruptor, pero fuera del alcance de la puerta.
    expect(engine.getInteractableLightSwitch(226, 330)).toBe(lightSwitch);
  });
});

describe('colisión de la hoja de puerta', () => {
  it('una puerta abierta no deja pasar balas por su hoja, pero sí por el hueco', () => {
    const openDoor = { ...mainDoor, currentAngle: 0, isOpen: true } as DoorEntity;
    const engine = createEngine({ walls: [], doors: [openDoor], furniture: [] });

    const leafHit = engine.raycastSurface(200, 300, 400, 450);
    expect(leafHit?.kind).toBe('DOOR');
    // Por debajo de la hoja, el hueco de la puerta sigue siendo transitable.
    expect(engine.raycastSurface(200, 410, 400, 410)).toBeNull();
  });
});

describe('secuencia de plantado y despeje de C4', () => {
  const makeCharge = () => ({
    id: 'c4_test',
    targetName: mainDoor.name,
    x: 250,
    y: 410,
    remainingSeconds: 0,
    maxSeconds: 0,
    doorId: mainDoor.id,
    isWindow: false,
    phase: 'ARMED' as const,
    safeToDetonate: false,
  });

  it('muestra el proceso de plantado sin consumir ni armar la carga antes de terminar', () => {
    const localPlayer = { ...player, x: 250, y: 430, state: 'ALERTED' } as ActorEntity;
    const engine = createEngine({
      getPlayer: vi.fn(() => localPlayer),
      findNearestDoor: vi.fn(() => mainDoor),
      doors: [mainDoor],
      c4Count: 2,
      activeC4Charges: [],
    });
    vi.spyOn(soundEngine, 'playBreachPrep').mockImplementation(() => {});

    engine.handleDoorBreachC4();

    expect(engine.c4.planting).toMatchObject({
      targetName: mainDoor.name,
      progress: 0,
      maxProgress: 1.7,
    });
    expect(engine.c4.charges).toHaveLength(0);
    expect(engine.c4.count).toBe(2);
  });

  it('arma la carga al completar el plantado, sin abrir la puerta ni detonar automáticamente', () => {
    const localPlayer = { ...player, x: 250, y: 430, state: 'ALERTED' } as ActorEntity;
    const engine = createEngine({
      getPlayer: vi.fn(() => localPlayer),
      findNearestDoor: vi.fn(() => mainDoor),
      doors: [mainDoor],
      c4Count: 2,
      activeC4Charges: [],
    });
    vi.spyOn(soundEngine, 'playBreachPrep').mockImplementation(() => {});
    vi.spyOn(soundEngine, 'playC4WarningBeep').mockImplementation(() => {});
    const trigger = vi.spyOn(engine, 'triggerC4Explosion').mockImplementation(() => {});

    engine.handleDoorBreachC4();
    engine.c4.updatePlanting(1.0, engine.c4Dependencies);
    expect(engine.c4.charges).toHaveLength(0);

    engine.c4.updatePlanting(0.8, engine.c4Dependencies);

    expect(engine.c4.planting).toBeUndefined();
    expect(engine.c4.count).toBe(1);
    expect(mainDoor.isOpen).toBe(false);
    expect(engine.c4.charges).toHaveLength(1);
    expect(engine.c4.charges[0]).toMatchObject({ phase: 'ARMED', safeToDetonate: false });
    expect(trigger).not.toHaveBeenCalled();
  });

  it('permite practicar el plantado remoto en la galería de tiro', () => {
    const localPlayer = { ...player, x: 190, y: 250, state: 'ALERTED' } as ActorEntity;
    const engine = createEngine({
      getPlayer: vi.fn(() => localPlayer),
      findNearestDoor: vi.fn(() => mainDoor),
      doors: [mainDoor],
      c4Count: 2,
      activeC4Charges: [],
      isTrainingMode: true,
    });
    vi.spyOn(soundEngine, 'playBreachPrep').mockImplementation(() => {});
    vi.spyOn(soundEngine, 'playC4WarningBeep').mockImplementation(() => {});

    engine.handleDoorBreachC4();
    engine.c4.updatePlanting(1.7, engine.c4Dependencies);

    expect(engine.c4.charges).toHaveLength(1);
    expect(engine.c4.count).toBe(2);
  });

  it('cancela el plantado si el operador se aleja antes de terminar', () => {
    const localPlayer = { ...player, x: 250, y: 430, state: 'ALERTED' } as ActorEntity;
    const engine = createEngine({
      getPlayer: vi.fn(() => localPlayer),
      findNearestDoor: vi.fn(() => mainDoor),
      doors: [mainDoor],
      c4Count: 2,
      activeC4Charges: [],
    });
    vi.spyOn(soundEngine, 'playBreachPrep').mockImplementation(() => {});

    engine.handleDoorBreachC4();
    localPlayer.x = 500;
    engine.c4.updatePlanting(0.5, engine.c4Dependencies);

    expect(engine.c4.planting).toBeUndefined();
    expect(engine.c4.charges).toHaveLength(0);
    expect(engine.c4.count).toBe(2);
  });

  it('bloquea la detonación mientras un agente propio sigue dentro del radio', () => {
    const localPlayer = { ...player, x: 250, y: 430, state: 'ALERTED' } as ActorEntity;
    const localSquad = { ...squad, x: 500, y: 500, state: 'ALERTED' } as ActorEntity;
    const charge = makeCharge();
    const engine = createEngine({
      activeC4Charges: [charge],
      actors: [localPlayer, localSquad],
      getPlayer: vi.fn(() => localPlayer),
      getSquadmate: vi.fn(() => localSquad),
    });
    const trigger = vi.spyOn(engine, 'triggerC4Explosion').mockImplementation(() => {});

    engine.detonateActiveC4();

    expect(trigger).not.toHaveBeenCalled();
    expect(engine.c4.charges).toHaveLength(1);
    expect(engine.pushRadio).toHaveBeenCalledWith(
      'KOBRA-1',
      expect.stringContaining('Detonación bloqueada'),
      'warn'
    );
  });

  it('ordena a Kobra-2 despejar y permite detonar cuando el binomio está a distancia segura', () => {
    const localPlayer = { ...player, x: 250, y: 430, state: 'ALERTED' } as ActorEntity;
    const localSquad = { ...squad, x: 300, y: 410, state: 'ALERTED' } as ActorEntity;
    const charge = makeCharge();
    const engine = createEngine({
      activeC4Charges: [charge],
      actors: [localPlayer, localSquad],
      getPlayer: vi.fn(() => localPlayer),
      getSquadmate: vi.fn(() => localSquad),
      doors: [mainDoor],
      walls: [],
      furniture: [],
    });
    vi.spyOn(soundEngine, 'playOpticCam').mockImplementation(() => {});
    const trigger = vi.spyOn(engine, 'triggerC4Explosion').mockImplementation(() => {});

    engine.orderBlastAreaClear();

    expect(engine.squadCommand).toBe('CLEAR_BLAST_AREA');
    expect(localSquad.investigateTarget).toBeDefined();
    expect(
      Math.hypot(localSquad.investigateTarget!.x - charge.x, localSquad.investigateTarget!.y - charge.y)
    ).toBeGreaterThanOrEqual(190);

    localPlayer.x = 600;
    localPlayer.y = 600;
    localSquad.x = 600;
    localSquad.y = 600;
    engine.detonateActiveC4();

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(engine.c4.charges).toHaveLength(0);
  });

  it('reanuda el inventario y las cargas armadas desde el guardado', () => {
    const engine = createEngine({ activeC4Charges: [makeCharge()], c4Count: 1 });
    const guardado = engine.capturarC4();
    const reanudado = createEngine({ activeC4Charges: [] });

    reanudado.restaurarC4(guardado);

    expect(reanudado.c4.count).toBe(1);
    expect(reanudado.c4.charges).toHaveLength(1);
    expect(reanudado.c4.charges[0]).toMatchObject({ phase: 'ARMED', targetName: mainDoor.name });
  });
});
