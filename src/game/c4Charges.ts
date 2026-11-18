import type { ActiveC4Charge, ActorEntity, Vec2 } from './types';

export const C4_PLANT_SECONDS = 1.7;
export const C4_SAFE_RADIUS = 190;

export interface C4PlantTarget {
  targetName: string;
  x: number;
  y: number;
  doorId?: string;
  windowId?: string;
  isWindow: boolean;
  /** Dirección del objetivo hacia el operador que coloca la carga. */
  face?: Vec2;
}

export interface C4PlantingState extends C4PlantTarget {
  progress: number;
  maxProgress: number;
}

/** Estado serializable del subsistema C4 para reanudar una partida guardada. */
export interface C4SaveState {
  count: number;
  charges: ActiveC4Charge[];
  planting?: C4PlantingState;
}

/**
 * Dependencias externas del subsistema: mundo, radio, audio, HUD y resolución
 * de la explosión. La lógica de plantado y detonación vive en este módulo.
 */
export interface C4Dependencies {
  getPlayer(): ActorEntity | undefined;
  getFriendlies(): ActorEntity[];
  isDoorTargetValid(doorId: string): boolean;
  isTrainingMode: boolean;
  pushRadio(speaker: string, text: string, tone: 'info' | 'warn' | 'alert' | 'ok'): void;
  emitHudSnapshot(): void;
  playPlantStarted(): void;
  playArmedWarning(seconds: number): void;
  explode(charge: ActiveC4Charge): void;
}

/**
 * Máquina de estado de las cargas C4: colocación, armado, comprobación de
 * seguridad y detonación. El mundo, la radio, el audio y el HUD se reciben
 * como dependencias; este módulo no conoce el motor táctico.
 */
export class C4ChargeSystem {
  count = 2;
  charges: ActiveC4Charge[] = [];
  planting?: C4PlantingState;

  /**
   * Coloca una carga con un tiempo visible. La carga no se arma ni consume
   * inventario hasta que el proceso termina; si el operador se aleja, se cancela.
   */
  beginPlant(target: C4PlantTarget, deps: C4Dependencies): boolean {
    if (this.planting) return false;
    if (this.count <= 0) {
      deps.pushRadio('KOBRA-1', 'Keine Sprengladungen (C4) mehr verfügbar!', 'warn');
      return false;
    }
    const alreadyPlaced = this.charges.some((charge) =>
      target.doorId ? charge.doorId === target.doorId : charge.windowId === target.windowId
    );
    if (alreadyPlaced) {
      deps.pushRadio('KOBRA-1', `Ya hay una carga activa en ${target.targetName}.`, 'warn');
      return false;
    }

    const player = deps.getPlayer();
    const reach = player ? Math.hypot(player.x - target.x, player.y - target.y) : 0;
    const face =
      player && reach > 1
        ? { x: (player.x - target.x) / reach, y: (player.y - target.y) / reach }
        : undefined;

    this.planting = {
      ...target,
      face,
      progress: 0,
      maxProgress: C4_PLANT_SECONDS,
    };
    deps.playPlantStarted();
    deps.pushRadio(
      'KOBRA-1',
      `Colocando C4 en ${target.targetName}... mantén la posición [${C4_PLANT_SECONDS.toFixed(1)}s].`,
      'warn'
    );
    deps.emitHudSnapshot();
    return true;
  }

  /** Avanza la colocación y arma la carga sólo al terminar el gesto. */
  updatePlanting(dt: number, deps: C4Dependencies): void {
    const planting = this.planting;
    if (!planting) return;

    const player = deps.getPlayer();
    if (!player || player.state === 'DEAD') {
      this.planting = undefined;
      deps.emitHudSnapshot();
      return;
    }

    if (planting.doorId && !deps.isDoorTargetValid(planting.doorId)) {
      this.planting = undefined;
      deps.pushRadio('KOBRA-1', 'C4 cancelada: la puerta dejó de ser un objetivo válido.', 'warn');
      deps.emitHudSnapshot();
      return;
    }

    // En la galería de tiro el control [C] coloca la carga de forma remota para
    // poder practicar la secuencia completa sin recorrer el pasillo.
    if (!deps.isTrainingMode && Math.hypot(player.x - planting.x, player.y - planting.y) > 100) {
      this.planting = undefined;
      deps.pushRadio('KOBRA-1', 'C4 cancelada: el operador se alejó antes de terminar la colocación.', 'warn');
      deps.emitHudSnapshot();
      return;
    }

    planting.progress += dt;
    if (planting.progress < planting.maxProgress) return;

    this.planting = undefined;
    if (!deps.isTrainingMode) {
      this.count = Math.max(0, this.count - 1);
    }
    this.charges.push({
      id: 'c4_' + Math.random().toString(36).substring(2, 9),
      targetName: planting.targetName,
      x: planting.x,
      y: planting.y,
      remainingSeconds: 0,
      maxSeconds: 0,
      doorId: planting.doorId,
      windowId: planting.windowId,
      isWindow: planting.isWindow,
      face: planting.face,
      phase: 'ARMED',
      safeToDetonate: false,
    });
    deps.playArmedWarning(1.1);
    deps.pushRadio(
      'KOBRA-1',
      `C4 ARMADA en ${planting.targetName}. Ordena despejar la zona [J]; la detonación queda bloqueada hasta que el binomio esté a distancia segura.`,
      'warn'
    );
    deps.emitHudSnapshot();
  }

  /** Comprueba que ningún agente propio quede dentro del radio de la explosión. */
  isBlastAreaClear(charge: ActiveC4Charge, friendlies: ActorEntity[]): boolean {
    return friendlies.every(
      (actor) => Math.hypot(actor.x - charge.x, actor.y - charge.y) >= C4_SAFE_RADIUS
    );
  }

  detonate(deps: C4Dependencies): void {
    if (this.planting) {
      deps.pushRadio('KOBRA-1', 'La carga todavía se está colocando; espera a que quede armada.', 'warn');
      return;
    }
    if (this.charges.length === 0) return;

    const friendlies = deps.getFriendlies();
    const unsafeCharge = this.charges.find((charge) => !this.isBlastAreaClear(charge, friendlies));
    if (unsafeCharge) {
      deps.pushRadio(
        'KOBRA-1',
        `Detonación bloqueada: el binomio sigue dentro del radio de seguridad de ${unsafeCharge.targetName}. Usa [J] para despejar la zona y aléjate.`,
        'warn'
      );
      deps.emitHudSnapshot();
      return;
    }

    for (const charge of [...this.charges]) {
      charge.phase = 'DETONATING';
      deps.explode(charge);
    }
    this.charges = [];
    deps.emitHudSnapshot();
  }

  /** Copia inventario, cargas y plantado a un objeto plano para el guardado. */
  snapshot(): C4SaveState {
    return {
      count: this.count,
      charges: this.charges.map((charge) => ({ ...charge })),
      planting: this.planting ? { ...this.planting } : undefined,
    };
  }

  /**
   * Reconstruye el subsistema desde el guardado. Los datos vienen de
   * `localStorage`, así que se validan y se copian a objetos propios. Una carga
   * restaurada vuelve armada y sin permiso de detonación: el radio seguro lo
   * vuelve a comprobar el motor en cada tick.
   */
  restore(saved: C4SaveState | undefined): void {
    this.planting = undefined;
    this.charges = [];
    if (!saved || typeof saved !== 'object') return;

    if (Number.isFinite(saved.count)) this.count = Math.max(0, Math.floor(saved.count));
    const charges = Array.isArray(saved.charges) ? saved.charges : [];
    this.charges = charges
      .filter((charge) => Number.isFinite(charge?.x) && Number.isFinite(charge?.y))
      .map(
        (charge): ActiveC4Charge => ({
          ...charge,
          remainingSeconds: 0,
          maxSeconds: 0,
          phase: 'ARMED',
          safeToDetonate: false,
        })
      );

    const planting = saved.planting;
    if (!planting || !Number.isFinite(planting.x) || !Number.isFinite(planting.y)) return;
    const maxProgress =
      Number.isFinite(planting.maxProgress) && planting.maxProgress > 0
        ? planting.maxProgress
        : C4_PLANT_SECONDS;
    this.planting = {
      ...planting,
      maxProgress,
      progress: Math.min(Math.max(0, planting.progress || 0), maxProgress),
    };
  }
}
