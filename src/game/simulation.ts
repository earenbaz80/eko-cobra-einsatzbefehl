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
export type Puerta = Pick<DoorEntity, 'x1' | 'y1' | 'x2' | 'y2' | 'isOpen' | 'isDestroyed'> &
  Partial<Pick<DoorEntity, 'hingeX' | 'hingeY' | 'currentAngle'>>;
export type Mueble = Pick<FurnitureItem, 'x' | 'y' | 'w' | 'h' | 'blocksMovement' | 'isDestroyed'>;

/** Segmento que ocupa la hoja de una puerta en su ángulo actual. */
export type HojaPuerta = { x1: number; y1: number; x2: number; y2: number };

/**
 * La puerta no es un hueco: su hoja sigue ocupando espacio al abrirse.
 * Cuando el mapa aporta bisagra y ángulo, se usa la hoja girada; si no,
 * se conserva la semántica antigua para los escenarios mínimos de simulación.
 */
export function segmentoHojaPuerta(puerta: Puerta): HojaPuerta | null {
  if (puerta.isDestroyed) return null;

  const tieneBisagra =
    Number.isFinite(puerta.hingeX) &&
    Number.isFinite(puerta.hingeY) &&
    Number.isFinite(puerta.currentAngle);
  if (tieneBisagra) {
    const longitud = Math.hypot(puerta.x2 - puerta.x1, puerta.y2 - puerta.y1);
    return {
      x1: puerta.hingeX as number,
      y1: puerta.hingeY as number,
      x2: (puerta.hingeX as number) + Math.cos(puerta.currentAngle as number) * longitud,
      y2: (puerta.hingeY as number) + Math.sin(puerta.currentAngle as number) * longitud,
    };
  }

  // Sin datos de giro, una puerta abierta deja libre el hueco; una cerrada
  // sigue bloqueando el segmento original.
  if (puerta.isOpen) return null;
  return { x1: puerta.x1, y1: puerta.y1, x2: puerta.x2, y2: puerta.y2 };
}

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
    const hoja = segmentoHojaPuerta(puerta);
    if (hoja && distanciaASegmento(x, y, hoja.x1, hoja.y1, hoja.x2, hoja.y2) < radio + MARGEN_PARED) {
      return true;
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
 * Recorre el tramo hasta el sondeo, no solo su extremo. En un vano el codo del
 * marco queda entre el actor y el punto lejano: el sondeo cae ya dentro de la
 * habitación y parece libre mientras el paso de este fotograma sigue frenado, y
 * el actor se queda clavado con el rumbo recto para siempre. Se muestrea con el
 * mismo paso de 8 px que usa el deslizamiento con colisión.
 */
export function isPathClear(
  origin: { x: number; y: number },
  angle: number,
  distance: number,
  colisionaEn: (x: number, y: number) => boolean,
  step = 8
): boolean {
  const samples = Math.max(1, Math.ceil(distance / Math.max(1, step)));
  for (let i = 1; i <= samples; i += 1) {
    const ahead = (distance * i) / samples;
    if (colisionaEn(origin.x + Math.cos(angle) * ahead, origin.y + Math.sin(angle) * ahead)) {
      return false;
    }
  }
  return true;
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
  const dx = siguienteX - actor.x;
  const dy = siguienteY - actor.y;
  const distancia = Math.hypot(dx, dy);
  // Los actores rápidos no deben saltar una puerta o un mueble fino en un
  // solo frame: se parte el desplazamiento en tramos cortos.
  const pasos = Math.max(1, Math.ceil(distancia / 8));
  const pasoX = dx / pasos;
  const pasoY = dy / pasos;

  for (let i = 0; i < pasos; i++) {
    if (!colisionaEn(actor.x + pasoX, actor.y)) actor.x += pasoX;
    if (!colisionaEn(actor.x, actor.y + pasoY)) actor.y += pasoY;
  }
}

/**
 * Desvíos que prueba un actor sin IA de navegación cuando el rumbo recto no está
 * libre. Llegan a ±143°: en un rincón de 90° (la hoja abierta de una puerta
 * contra el marco, por ejemplo) el único paso libre es casi el inverso, así que
 * apartarse un poco del obstáculo no alcanza.
 */
export const DESVIOS_DE_ESQUINA = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5] as const;

/** Rumbo elegido la última vez: lado del desvío y su magnitud (0 = recto). */
export interface DesvioDeEsquina {
  lado: 1 | -1;
  desvio: number;
  /** Ancla del último avance real, para detectar que el actor se quedó oscilando. */
  anclaX?: number;
  anclaY?: number;
  /** Fotogramas seguidos sin alejarse del ancla. */
  quietos?: number;
}

/** Fotogramas sin progreso tras los que un actor encajado cambia de lado. */
const FOTOGRAMAS_QUIETO = 20;
/** Avance que cuenta como progreso y mueve el ancla. */
const PROGRESO_MINIMO = 6;

/**
 * Avanza un actor que se mueve sin navegación propia (un civil que huye, un
 * sospechoso que busca cobertura): sondea el tramo del rumbo y, si está tapado,
 * prueba un desvío. Mantiene el desvío que ya venía usando mientras el rumbo
 * recto siga tapado; sin esa memoria el actor cambia de lado en cada fotograma
 * y se queda oscilando en el mismo bolsillo. Devuelve el desvío para el paso
 * siguiente. Sin nada de esto empuja el mismo codo para siempre, como le pasaba
 * al binomio en el vano.
 */
export function avanzarConDesvio(
  actor: { x: number; y: number },
  rumbo: number,
  distancia: number,
  colisionaEn: (x: number, y: number) => boolean,
  memoria: DesvioDeEsquina = { lado: 1, desvio: 0 }
): DesvioDeEsquina {
  if (distancia <= 0) return memoria;
  const sonda = Math.max(16, distancia * 2.4);

  // Un actor que lleva un segundo sin alejarse del ancla está oscilando entre
  // dos obstáculos: cambia de lado para intentar el camino espejo.
  let { lado, desvio } = memoria;
  let anclaX = memoria.anclaX ?? NaN;
  let anclaY = memoria.anclaY ?? NaN;
  let quietos = memoria.quietos ?? 0;
  if (!Number.isFinite(anclaX) || !Number.isFinite(anclaY)) {
    anclaX = actor.x;
    anclaY = actor.y;
    quietos = 0;
  } else if (Math.hypot(actor.x - anclaX, actor.y - anclaY) >= PROGRESO_MINIMO) {
    anclaX = actor.x;
    anclaY = actor.y;
    quietos = 0;
  } else if (++quietos >= FOTOGRAMAS_QUIETO) {
    lado = (lado === 1 ? -1 : 1) as 1 | -1;
    desvio = 0;
    anclaX = actor.x;
    anclaY = actor.y;
    quietos = 0;
  }
  const resultado = (siguienteDesvio: number, siguienteLado: 1 | -1 = lado): DesvioDeEsquina => ({
    lado: siguienteLado,
    desvio: siguienteDesvio,
    anclaX,
    anclaY,
    quietos,
  });

  const mover = (angulo: number): boolean => {
    const x = actor.x;
    const y = actor.y;
    deslizarConColision(
      actor,
      x + Math.cos(angulo) * distancia,
      y + Math.sin(angulo) * distancia,
      colisionaEn
    );
    if (Math.hypot(actor.x - x, actor.y - y) > 0.05) return true;
    actor.x = x;
    actor.y = y;
    return false;
  };

  if (isPathClear(actor, rumbo, sonda, colisionaEn) && mover(rumbo)) {
    return resultado(0);
  }

  if (desvio !== 0) {
    const angulo = rumbo + desvio * lado;
    if (isPathClear(actor, angulo, sonda, colisionaEn) && mover(angulo)) {
      return resultado(desvio);
    }
  }

  for (const intento of DESVIOS_DE_ESQUINA) {
    if (intento === 0) continue;
    const angulo = rumbo + intento * lado;
    if (!isPathClear(actor, angulo, sonda, colisionaEn)) continue;
    if (mover(angulo)) return resultado(intento);
  }
  return resultado(desvio);
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

/** Misiones que puede montar la simulación sin renderizado. */
export type MisionSimulada = 'pasillo' | 'almacen' | 'graz' | 'station';

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

const ESCENARIOS: Record<'pasillo' | 'almacen', Escenario> = { pasillo: PASILLO, almacen: ALMACEN };

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

/** Estado de simulación serializable para reanudar una partida. */
export interface SnapshotSimulacion {
  jugador: { x: number; y: number; angulo: number };
  tick: number;
  tiempo: number;
  mundo: { paredes: WallSegment[]; puertas: DoorEntity[]; muebles: FurnitureItem[] };
}

/** Paso máximo por fotograma, igual que el motor: un frame largo no atraviesa paredes. */
export const PASO_MAXIMO = 0.05;

type LayoutReal = ReturnType<typeof createGrazApartmentLayout>;

/** Convierte un layout real en el mundo mínimo de la simulación. */
function escenarioDeLayout(layout: LayoutReal, inicio: { x: number; y: number }): Escenario {
  return {
    paredes: layout.walls.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })),
    puertas: layout.doors.map(({ x1, y1, x2, y2, isOpen, isDestroyed }) => ({ x1, y1, x2, y2, isOpen, isDestroyed })),
    muebles: layout.furniture.map(({ x, y, w, h, blocksMovement, isDestroyed }) => ({
      x,
      y,
      w,
      h,
      blocksMovement,
      isDestroyed,
    })),
    inicio,
  };
}

const REALES: Record<'graz' | 'station', () => Escenario> = {
  // Entrada A de cada mapa: el spawn del operador en el motor.
  graz: () => escenarioDeLayout(createGrazApartmentLayout(), { x: 185, y: 410 }),
  station: () => escenarioDeLayout(createStationLayout(), { x: 130, y: 115 }),
};

/**
 * Crea una partida sin renderizado y determinista. La semilla fija la orientación inicial
 * (y queda en `azar` para los eventos aleatorios), así que la misma misión con la misma
 * semilla se comporta igual en cada ejecución.
 */
export function crearPartida(mision: MisionSimulada, semilla: number): Partida {
  let escenario: Escenario;
  if (mision === 'graz' || mision === 'station') escenario = REALES[mision]();
  else if (mision === 'pasillo' || mision === 'almacen') escenario = ESCENARIOS[mision];
  else throw new Error(`misión desconocida: ${mision}`);

  const mundo = {
    paredes: escenario.paredes.map((pared) => ({ ...pared })),
    puertas: escenario.puertas.map((puerta) => ({ ...puerta })),
    muebles: escenario.muebles.map((mueble) => ({ ...mueble })),
  };
  return crearPartidaDesdeMundo(mision, mundo, escenario.inicio, semilla);
}

/** Crea una partida sobre un mundo ya existente (el del motor) sin clonarlo. */
export function crearPartidaDesdeMundo(
  mision: string,
  mundo: Partida['mundo'],
  inicio: { x: number; y: number },
  semilla: number = 0
): Partida {
  const azar = crearAzar(semilla);
  const jugador: JugadorSimulado = {
    x: inicio.x,
    y: inicio.y,
    radio: 9,
    velocidad: 120,
    orientacion: azar() * Math.PI * 2,
  };
  const partida: Partida = {
    mision,
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
