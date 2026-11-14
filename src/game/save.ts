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

/** Versión actual del esquema de guardado. Cámbiala al modificar la forma del estado. */
export const SCHEMA_VERSION = 1;
export const VERSION_ESQUEMA = SCHEMA_VERSION;
export const SAVE_SCHEMA_VERSION = SCHEMA_VERSION;
export const VERSION_GUARDADO = SCHEMA_VERSION;

/** Clave usada en `localStorage` para la partida en curso. */
export const SAVE_KEY = 'eko_cobra_partida_en_curso';
export const CLAVE_GUARDADO = SAVE_KEY;
export const SAVE_STORAGE_KEY = SAVE_KEY;

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
  /** Cualquier dato adicional de la partida. */
  [key: string]: unknown;
}

export interface SerializedSave {
  version: number;
  savedAt: number;
  state: SaveState;
}

export interface SaveResult {
  ok: boolean;
  reason?: 'incompatible' | 'invalid' | 'storage' | 'empty';
}

export interface LoadResult {
  ok: boolean;
  version?: number;
  state?: SaveState;
  reason?: 'incompatible' | 'invalid' | 'storage' | 'empty';
}

/** Devuelve true si la versión del dato guardado es compatible con la actual. */
export function isCompatibleVersion(version: unknown): boolean {
  return version === SCHEMA_VERSION;
}

export function esVersionCompatible(version: unknown): boolean {
  return isCompatibleVersion(version);
}

export function esCompatible(datos: unknown): boolean {
  if (!datos || typeof datos !== 'object') return false;
  const v = (datos as { version?: unknown }).version;
  return isCompatibleVersion(v);
}

export function esEstadoCompatible(datos: unknown): boolean {
  return esCompatible(datos);
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

export function deserializarPartida(raw: unknown): SerializedSave | null {
  return parseSave(raw);
}

export function deserializeSave(raw: unknown): SerializedSave | null {
  return parseSave(raw);
}

export function leerPartida(raw: unknown): SerializedSave | null {
  return parseSave(raw);
}

/** Serializa un estado a cadena JSON con la versión de esquema. */
export function serializeState(state: SaveState, now: number = Date.now()): string {
  const payload: SerializedSave = { version: SCHEMA_VERSION, savedAt: now, state };
  return JSON.stringify(payload);
}

export function serializarPartida(state: SaveState, now: number = Date.now()): string {
  return serializeState(state, now);
}

export function serializarEstado(state: SaveState, now: number = Date.now()): string {
  return serializeState(state, now);
}

export function stringifySave(state: SaveState, now: number = Date.now()): string {
  return serializeState(state, now);
}

/** Crea el payload (objeto) sin serializar. */
export function crearPayload(state: SaveState, now: number = Date.now()): SerializedSave {
  return { version: SCHEMA_VERSION, savedAt: now, state };
}

export function buildSavePayload(state: SaveState, now: number = Date.now()): SerializedSave {
  return crearPayload(state, now);
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

export function guardarPartida(state: SaveState, storage: StorageLike | null = defaultStorage()): boolean {
  return saveGame(state, storage);
}

export function guardarPartidaEnCurso(state: SaveState, storage: StorageLike | null = defaultStorage()): boolean {
  return saveGame(state, storage);
}

export function persistSave(state: SaveState, storage: StorageLike | null = defaultStorage()): boolean {
  return saveGame(state, storage);
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

export function cargarPartida(storage: StorageLike | null = defaultStorage()): SaveState | null {
  return loadGame(storage);
}

export function cargarPartidaEnCurso(storage: StorageLike | null = defaultStorage()): SaveState | null {
  return loadGame(storage);
}

export function restoreSave(storage: StorageLike | null = defaultStorage()): SaveState | null {
  return loadGame(storage);
}

export function readSave(storage: StorageLike | null = defaultStorage()): SaveState | null {
  return loadGame(storage);
}

/** Resultado detallado de la carga. */
export function loadGameDetailed(storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { ok: false, reason: 'storage' };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: 'storage' };
  }
  if (raw === null) return { ok: false, reason: 'empty' };
  const parsed = parseSave(raw);
  if (!parsed) {
    // distinguir incompatible vs inválido: re-parsear sin validar versión
    let obj: unknown;
    try { obj = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid' }; }
    if (obj && typeof obj === 'object' && !isCompatibleVersion((obj as { version?: unknown }).version)) {
      return { ok: false, reason: 'incompatible', version: (obj as { version?: number }).version };
    }
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, version: parsed.version, state: parsed.state };
}

export function cargarPartidaDetallada(storage: StorageLike | null = defaultStorage()): LoadResult {
  return loadGameDetailed(storage);
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

export function borrarPartida(storage: StorageLike | null = defaultStorage()): boolean {
  return clearSave(storage);
}

export function borrarPartidaEnCurso(storage: StorageLike | null = defaultStorage()): boolean {
  return clearSave(storage);
}

export function deleteSave(storage: StorageLike | null = defaultStorage()): boolean {
  return clearSave(storage);
}

/** Indica si hay una partida guardada compatible. */
export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  return loadGame(storage) !== null;
}

export function hayPartidaGuardada(storage: StorageLike | null = defaultStorage()): boolean {
  return hasSave(storage);
}

export function tienePartidaGuardada(storage: StorageLike | null = defaultStorage()): boolean {
  return hasSave(storage);
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
export function crearStorageEnMemoria(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

export function createMemoryStorage(): StorageLike {
  return crearStorageEnMemoria();
}

export function createInMemoryStorage(): StorageLike {
  return crearStorageEnMemoria();
}
