import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  SAVE_KEY,
  serializeState,
  parseSave,
  saveGame,
  loadGame,
  clearSave,
  hasSave,
  createMemoryStorage,
} from './save';

describe('guardado: serialización', () => {
  it('serializa con la versión de esquema y la carga de vuelta', () => {
    const storage = createMemoryStorage();
    const estado = { gameState: 'PLAYING', score: 42, elapsedSeconds: 12.5 };
    expect(saveGame(estado, storage)).toBe(true);
    const cargado = loadGame(storage);
    expect(cargado).toEqual(estado);
    expect(hasSave(storage)).toBe(true);

    const raw = storage.getItem(SAVE_KEY)!;
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(SCHEMA_VERSION);
    expect(parsed.state).toEqual(estado);
    expect(typeof parsed.savedAt).toBe('number');

    const reparse = parseSave(raw);
    expect(reparse).not.toBeNull();
    expect(reparse!.state).toEqual(estado);
  });

  it('round-trip de serializar/deserializar', () => {
    const estado = { gameState: 'PAUSED', missionMode: 'STATION', tick: 100 };
    const texto = serializeState(estado);
    const parsed = parseSave(texto);
    expect(parsed).not.toBeNull();
    expect(parsed!.state).toEqual(estado);
    expect(parsed!.version).toBe(SCHEMA_VERSION);
  });

  it('borra la partida guardada', () => {
    const storage = createMemoryStorage();
    saveGame({ gameState: 'PLAYING' }, storage);
    expect(clearSave(storage)).toBe(true);
    expect(loadGame(storage)).toBeNull();
    expect(hasSave(storage)).toBe(false);
  });
});

describe('guardado: estado incompatible', () => {
  it('rechaza un esquema con versión distinta', () => {
    const storage = createMemoryStorage();
    const incompatible = JSON.stringify({ version: SCHEMA_VERSION + 99, savedAt: 1, state: { gameState: 'PLAYING' } });
    storage.setItem(SAVE_KEY, incompatible);
    expect(loadGame(storage)).toBeNull();
    expect(hasSave(storage)).toBe(false);
  });

  it('rechaza JSON inválido o sin estado', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadGame(storage)).toBeNull();

    storage.setItem(SAVE_KEY, JSON.stringify({ version: SCHEMA_VERSION }));
    expect(loadGame(storage)).toBeNull();
  });

  it('parseSave devuelve null para versión incompatible', () => {
    expect(parseSave({ version: 0, state: { x: 1 } })).toBeNull();
    expect(parseSave(JSON.stringify({ version: 0, state: { x: 1 } }))).toBeNull();
  });

  it('storage nulo no rompe', () => {
    expect(saveGame({ gameState: 'PLAYING' }, null)).toBe(false);
    expect(loadGame(null)).toBeNull();
    expect(clearSave(null)).toBe(false);
  });
});
