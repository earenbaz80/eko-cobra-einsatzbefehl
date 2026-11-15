import type { GameState } from './types';

/** Acciones que pueden cambiar el estado de la partida. */
export type GameEvent = 'START' | 'PAUSE' | 'RESUME' | 'WIN' | 'LOSE' | 'RETURN_TO_TITLE';

/** Resultado final de una misión. */
export type ResultadoMision = 'VICTORY' | 'ROE_TERMINATED' | 'KIA' | 'HOSTAGE_LOST';

/**
 * Única tabla de transiciones: el motor y la UI no asignan `gameState` a mano.
 * Un evento sin entrada es inválido y deja el estado como está.
 */
const TRANSICIONES: Record<GameState, Partial<Record<GameEvent, GameState>>> = {
  TITLE: { START: 'PLAYING' },
  PLAYING: { PAUSE: 'PAUSED', WIN: 'VICTORY', LOSE: 'DEFEAT', RETURN_TO_TITLE: 'TITLE' },
  PAUSED: { RESUME: 'PLAYING', START: 'PLAYING', RETURN_TO_TITLE: 'TITLE' },
  VICTORY: { START: 'PLAYING', RETURN_TO_TITLE: 'TITLE' },
  DEFEAT: { START: 'PLAYING', RETURN_TO_TITLE: 'TITLE' },
};

/** Estado al que llevaría el evento, o null si la transición no es válida. */
export function siguienteEstado(actual: GameState, evento: GameEvent): GameState | null {
  return TRANSICIONES[actual][evento] ?? null;
}

/** Aplica el evento; si no es válido para el estado actual, no cambia nada. */
export function aplicarEvento(actual: GameState, evento: GameEvent): GameState {
  return siguienteEstado(actual, evento) ?? actual;
}

/** Indica si existe una transición directa entre dos estados. */
export function esTransicionValida(desde: GameState, hasta: GameState): boolean {
  return Object.values(TRANSICIONES[desde]).includes(hasta);
}

/** Estado final según el resultado de la misión. */
export function estadoDeResultado(resultado: ResultadoMision): GameState {
  return resultado === 'VICTORY' ? 'VICTORY' : 'DEFEAT';
}
