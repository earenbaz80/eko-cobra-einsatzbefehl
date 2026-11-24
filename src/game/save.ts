/**
 * Guardado de la partida en curso.
 *
 * La partida se serializa a JSON y se guarda en `localStorage` bajo una clave fija,
 * con un campo `version` (versión de esquema) que permite detectar y rechazar
 * estados guardados por una versión anterior/incompatible del juego.
 *
 * El módulo es puro en lo posible: la serialización y la validación no tocan el
 * almacenamiento; las funciones de E/S aceptan un `Storage` inyectable para que los
 * tests puedan usar un doble en memoria.
 */

import type { SnapshotSimulacion } from './simulation';
import type { C4SaveState } from './c4Charges';

/** Versión actual del esquema de guardado. Cámbiala al modificar la forma del estado. */
export const SCHEMA_VERSION = 2;

/** Clave usada en `localStorage` para la partida en curso. */
export const SAVE_KEY = 'eko_cobra_partida_en_curso';

export interface SaveState {
  /** Estado del juego en el momento del guardado. */
  gameState?: string;
  /** Plan de misión activo. */
  plan?: unknown;
  /** Modo de misión. */
  missionMode?: string;
  /** Segundos transcurridos. */
  elapsedSeconds?: number;
  /** Puntuación. */
  score?: number;
  /** Tick del motor. */
  tick?: number;
  /** Posición, mundo y puertas de la simulación para reanudar sin reiniciar. */
  simulacion?: SnapshotSimulacion;
  /** Inventario, cargas armadas y plantado en curso del C4. */
  c4?: C4SaveState;
  /**
   * Estancias ya despejadas (ids del layout) para que el objetivo primario no
   * vuelva a marcarlas pendientes al reanudar. Campo opcional: un guardado
   * anterior sin él se reanuda igual y reconstruye la memoria con lo que vea.
   */
  estanciasDespejadas?: string[];
  /** Cualquier dato adicional de la partida. */
  [key: string]: unknown;
}

export interface SerializedSave {
  version: number;
  savedAt: number;
  state: SaveState;
}

/** Devuelve true si la versión del dato guardado es compatible con la actual. */
function isCompatibleVersion(version: unknown): boolean {
  return version === SCHEMA_VERSION;
}

/** Valida y normaliza un objeto guardado; devuelve null si es inválido o incompatible. */
export function parseSave(raw: unknown): SerializedSave | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  if (!isCompatibleVersion(rec.version)) return null;
  if (!rec.state || typeof rec.state !== 'object') return null;
  const savedAt = typeof rec.savedAt === 'number' ? rec.savedAt : Date.now();
  return { version: rec.version as number, savedAt, state: rec.state as SaveState };
}

/** Serializa un estado a cadena JSON con la versión de esquema. */
export function serializeState(state: SaveState, now: number = Date.now()): string {
  return JSON.stringify({ version: SCHEMA_VERSION, savedAt: now, state });
}

/** Guarda la partida en el storage dado. Devuelve true si se guardó. */
export function saveGame(state: SaveState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}

/** Carga y valida la partida guardada. Devuelve el estado o null si no hay/incompatible. */
export function loadGame(storage: StorageLike | null = defaultStorage()): SaveState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const parsed = parseSave(raw);
    if (!parsed) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

/** Borra la partida guardada. */
export function clearSave(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Indica si hay una partida guardada compatible. */
export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  return loadGame(storage) !== null;
}

/** Tipo mínimo de storage para inyección en tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    const g = globalThis as { localStorage?: StorageLike };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Crea un storage en memoria (útil para tests). */
export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}
