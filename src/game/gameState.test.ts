import { describe, expect, it } from 'vitest';
import {
  aplicarEvento,
  esTransicionValida,
  estadoDeResultado,
  siguienteEstado,
  type GameEvent,
} from './gameState';
import type { GameState } from './types';

describe('transiciones válidas', () => {
  const casos: Array<[GameState, GameEvent, GameState]> = [
    ['TITLE', 'START', 'PLAYING'],
    ['PLAYING', 'PAUSE', 'PAUSED'],
    ['PAUSED', 'RESUME', 'PLAYING'],
    ['PAUSED', 'START', 'PLAYING'],
    ['PLAYING', 'WIN', 'VICTORY'],
    ['PLAYING', 'LOSE', 'DEFEAT'],
    ['PLAYING', 'RETURN_TO_TITLE', 'TITLE'],
    ['PAUSED', 'RETURN_TO_TITLE', 'TITLE'],
    ['VICTORY', 'START', 'PLAYING'],
    ['DEFEAT', 'START', 'PLAYING'],
    ['VICTORY', 'RETURN_TO_TITLE', 'TITLE'],
    ['DEFEAT', 'RETURN_TO_TITLE', 'TITLE'],
  ];

  it.each(casos)('%s + %s -> %s', (desde, evento, hasta) => {
    expect(siguienteEstado(desde, evento)).toBe(hasta);
    expect(aplicarEvento(desde, evento)).toBe(hasta);
    expect(esTransicionValida(desde, hasta)).toBe(true);
  });

  it('VICTORY y DEFEAT no son intercambiables', () => {
    expect(esTransicionValida('VICTORY', 'DEFEAT' as GameState)).toBe(false);
    expect(esTransicionValida('DEFEAT', 'VICTORY' as GameState)).toBe(false);
  });
});

describe('transiciones inválidas', () => {
  const invalidas: Array<[GameState, GameEvent]> = [
    ['TITLE', 'PAUSE'],
    ['TITLE', 'RESUME'],
    ['TITLE', 'WIN'],
    ['TITLE', 'LOSE'],
    ['PLAYING', 'START'],
    ['PLAYING', 'RESUME'],
    ['PAUSED', 'PAUSE'],
    ['PAUSED', 'WIN'],
    ['PAUSED', 'LOSE'],
    ['VICTORY', 'PAUSE'],
    ['VICTORY', 'WIN'],
    ['VICTORY', 'LOSE'],
    ['DEFEAT', 'PAUSE'],
    ['DEFEAT', 'WIN'],
    ['DEFEAT', 'LOSE'],
  ];

  it.each(invalidas)('%s + %s no cambia el estado', (desde, evento) => {
    expect(siguienteEstado(desde, evento)).toBeNull();
    expect(aplicarEvento(desde, evento)).toBe(desde);
  });
});

describe('estadoDeResultado', () => {
  it('mapea victoria y derrotas a su estado final', () => {
    expect(estadoDeResultado('VICTORY')).toBe('VICTORY');
    expect(estadoDeResultado('ROE_TERMINATED')).toBe('DEFEAT');
    expect(estadoDeResultado('KIA')).toBe('DEFEAT');
    expect(estadoDeResultado('HOSTAGE_LOST')).toBe('DEFEAT');
  });
});
