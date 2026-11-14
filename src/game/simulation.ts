/**
 * Simulación compartida con el motor: colisión contra paredes, puertas y muebles,
 * deslizamiento por eje y una partida sin renderizado para probar el movimiento.
 *
 * Las piezas vienen de `TacticalEngine` tal cual —mismo margen de 3 px contra paredes y
 * puertas, misma caja de mueble inflada por el radio—, así que el juego y los tests usan
 * el mismo código: si aquí cambia una distancia, cambia en ambos.
 */
import type { DoorEntity, FurnitureItem, WallSegment } from './types';
import { createGrazApartmentLayout } from './grazMap';
import { createStationLayout } from './stationMap';

/** Datos mínimos de colisión: un muro, una puerta o un mueble del mapa. */
export type Pared = Pick<WallSegment, 'x1' | 'y1' | 'x2' | 'y2'>;
export type Puerta = Pick<DoorEntity, 'x1' | 'y1' | 'x2' | 'y2' | 'isOpen' | 'isDestroyed'>;
export type Mueble = Pick<FurnitureItem, 'x' | 'y' | 'w' | 'h' | 'blocksMovement' | 'isDestroyed'>;

/** Margen extra con el que las paredes frenan al actor, igual que en el motor. */
export const MARGEN_PARED = 3;

/** Distancia de un punto al segmento más cercano (paredes y puertas son segmentos). */
export function distanciaASegmento(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/** ¿Choca un círculo de este radio en (x, y) con paredes, puertas cerradas o muebles? */
export function colisiona(x: number, y: number, radio: number, paredes: Pared[], puertas: Puerta[], muebles: Mueble[]): boolean {
  for (const pared of paredes) {
    if (distanciaASegmento(x, y, pared.x1, pared.y1, pared.x2, pared.y2) < radio + MARGEN_PARED) return true;
  }
  for (const puerta of puertas) {
    if (!puerta.isOpen && !puerta.isDestroyed) {
      if (distanciaASegmento(x, y, puerta.x1, puerta.y1, puerta.x2, puerta.y2) < radio + MARGEN_PARED) return true;
    }
  }
  for (const mueble of muebles) {
    if (mueble.blocksMovement && !mueble.isDestroyed) {
      const cx = Math.max(mueble.x, Math.min(x, mueble.x + mueble.w));
      const cy = Math.max(mueble.y, Math.min(y, mueble.y + mueble.h));
      if (Math.hypot(x - cx, y - cy) < radio) return true;
    }
  }
  return false;
}

/**
 * Mueve el actor al destino probando cada eje por separado: contra una pared se desliza
 * por el eje libre en vez de quedarse clavado.
 */
export function deslizarConColision(
  actor: { x: number; y: number },
  siguienteX: number,
  siguienteY: number,
  colisionaEn: (x: number, y: number) => boolean
): void {
  if (!colisionaEn(siguienteX, actor.y)) actor.x = siguienteX;
  if (!colisionaEn(actor.x, siguienteY)) actor.y = siguienteY;
}

/** Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma partida. */
export function crearAzar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escenarios mínimos que hoy usa la simulación sin renderizado. */
export type MisionSimulada =
  | 'pasillo'
  | 'almacen'
  | 'graz'
  | 'grazApartment'
  | 'graz-apartment'
  | 'apartment'
  | 'station'
  | (string & {});

interface Escenario {
  paredes: Pared[];
  puertas: Puerta[];
  muebles: Mueble[];
  inicio: { x: number; y: number };
}

/** Pasillo de 400×160 con una puerta cerrada a 300 px del inicio. */
const PASILLO: Escenario = {
  paredes: [
    { x1: 0, y1: 0, x2: 400, y2: 0 },
    { x1: 0, y1: 160, x2: 400, y2: 160 },
  ],
  puertas: [{ x1: 300, y1: 0, x2: 300, y2: 160, isOpen: false }],
  muebles: [],
  inicio: { x: 60, y: 80 },
};

/** Almacén de 400×300 con una caja que corta el paso a 150 px del inicio. */
const ALMACEN: Escenario = {
  paredes: [
    { x1: 0, y1: 0, x2: 400, y2: 0 },
    { x1: 0, y1: 300, x2: 400, y2: 300 },
    { x1: 0, y1: 0, x2: 0, y2: 300 },
    { x1: 400, y1: 0, x2: 400, y2: 300 },
  ],
  puertas: [],
  muebles: [{ x: 150, y: 100, w: 60, h: 60, blocksMovement: true }],
  inicio: { x: 80, y: 130 },
};

const ESCENARIOS: Record<string, Escenario> = { pasillo: PASILLO, almacen: ALMACEN };

export interface JugadorSimulado {
  x: number;
  y: number;
  radio: number;
  velocidad: number;
  orientacion: number;
}

export interface Partida {
  mision: string;
  semilla: number;
  tick: number;
  tiempo: number;
  mundo: { paredes: Pared[]; puertas: Puerta[]; muebles: Mueble[] };
  jugador: JugadorSimulado;
  /** Dirección deseada, sin normalizar; (0,0) deja al jugador quieto. */
  entrada: { x: number; y: number };
  azar: () => number;
  avanzar: (dt: number) => void;
}

/** Paso máximo por fotograma, igual que el motor: un frame largo no atraviesa paredes. */
export const PASO_MAXIMO = 0.05;

/**
 * Crea una partida sin renderizado y determinista. La semilla fija la orientación inicial
 * (y queda en `azar` para los eventos aleatorios), así que la misma misión con la misma
 * semilla se comporta igual en cada ejecución.
 */
const LAYOUTS_REALES: Record<string, () => { walls: any[]; doors: any[]; furniture: any[]; rooms?: any[] }> = {
  graz: () => createGrazApartmentLayout(),
  grazApartment: () => createGrazApartmentLayout(),
  'graz-apartment': () => createGrazApartmentLayout(),
  apartment: () => createGrazApartmentLayout(),
  station: () => createStationLayout(),
};

const SPAWNS_REALES: Record<string, { x: number; y: number }> = {
  graz: { x: 185, y: 410 },
  grazApartment: { x: 185, y: 410 },
  'graz-apartment': { x: 185, y: 410 },
  apartment: { x: 185, y: 410 },
  station: { x: 130, y: 115 },
};

function layoutAEscenario(layout: any, spawn?: { x: number; y: number }): Escenario {
  const paredes: Pared[] = (layout?.walls ?? layout?.paredes ?? []).map((w: any) => ({
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
  }));
  const puertas: Puerta[] = (layout?.doors ?? layout?.puertas ?? []).map((d: any) => ({
    x1: d.x1,
    y1: d.y1,
    x2: d.x2,
    y2: d.y2,
    isOpen: !!d.isOpen,
    isDestroyed: !!d.isDestroyed,
  }));
  const muebles: Mueble[] = (layout?.furniture ?? layout?.muebles ?? []).map((f: any) => ({
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    blocksMovement: !!f.blocksMovement,
    isDestroyed: !!f.isDestroyed,
  }));
  let inicio = spawn ?? layout?.inicio ?? layout?.spawn;
  if (!inicio) {
    const rooms = layout?.rooms;
    if (Array.isArray(rooms) && rooms.length) {
      inicio = { x: rooms[0].x + 20, y: rooms[0].y + 20 };
    } else {
      inicio = { x: 60, y: 60 };
    }
  }
  return { paredes, puertas, muebles, inicio };
}

export function crearPartida(
  mision: MisionSimulada | any,
  semillaOrSpawn: number | { x: number; y: number } = 1,
  spawnOrSemilla?: { x: number; y: number } | number
): Partida {
  let semilla = 1;
  let spawn: { x: number; y: number } | undefined;
  if (typeof semillaOrSpawn === 'number') semilla = semillaOrSpawn;
  else if (semillaOrSpawn && typeof semillaOrSpawn === 'object') {
    spawn = semillaOrSpawn as { x: number; y: number };
    if (typeof spawnOrSemilla === 'number') semilla = spawnOrSemilla;
  }
  if (typeof spawnOrSemilla === 'object' && spawnOrSemilla) {
    spawn = spawnOrSemilla as { x: number; y: number };
  }

  let nombreMision = typeof mision === 'string' ? mision : 'mapa-real';
  let escenario: Escenario;
  if (typeof mision === 'string') {
    const factory = LAYOUTS_REALES[mision];
    if (factory) {
      const layout = factory();
      escenario = layoutAEscenario(layout, spawn ?? SPAWNS_REALES[mision]);
    } else if (ESCENARIOS[mision]) {
      escenario = ESCENARIOS[mision];
    } else {
      throw new Error(`misión desconocida: ${mision}`);
    }
  } else if (mision && typeof mision === 'object') {
    escenario = layoutAEscenario(mision, spawn);
  } else {
    throw new Error(`misión desconocida: ${mision}`);
  }

  const azar = crearAzar(semilla);
  const mundo = {
    paredes: escenario.paredes.map((pared) => ({ ...pared })),
    puertas: escenario.puertas.map((puerta) => ({ ...puerta })),
    muebles: escenario.muebles.map((mueble) => ({ ...mueble })),
  };
  const jugador: JugadorSimulado = {
    x: escenario.inicio.x,
    y: escenario.inicio.y,
    radio: 9,
    velocidad: 120,
    orientacion: azar() * Math.PI * 2,
  };
  const partida: Partida = {
    mision: nombreMision,
    semilla,
    tick: 0,
    tiempo: 0,
    mundo,
    jugador,
    entrada: { x: 0, y: 0 },
    azar,
    avanzar: (dt: number) => avanzar(partida, dt),
  };
  return partida;
}

/** Avanza la simulación un paso: normaliza la entrada, mueve con colisión y suma el tiempo. */
export function avanzar(partida: Partida, dt: number): void {
  const paso = Math.min(Math.max(dt, 0), PASO_MAXIMO);
  const { entrada, jugador, mundo } = partida;
  const longitud = Math.hypot(entrada.x, entrada.y);
  if (longitud > 0) {
    const distancia = jugador.velocidad * paso;
    const dx = (entrada.x / longitud) * distancia;
    const dy = (entrada.y / longitud) * distancia;
    deslizarConColision(jugador, jugador.x + dx, jugador.y + dy, (x, y) =>
      colisiona(x, y, jugador.radio, mundo.paredes, mundo.puertas, mundo.muebles)
    );
  }
  partida.tick += 1;
  partida.tiempo += paso;
}
