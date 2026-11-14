import { describe, expect, it } from 'vitest';
import { estadisticasFrames, MUESTRAS_MINIMAS, PAUSA_MS, percentil } from './rendimiento.mjs';

describe('percentil', () => {
  it('devuelve los extremos y la mediana de una lista ordenada', () => {
    const ordenados = [1, 2, 3, 4, 5];
    expect(percentil(ordenados, 0.5)).toBe(3);
    expect(percentil(ordenados, 0.95)).toBe(5);
    expect(percentil(ordenados, 0)).toBe(1);
  });

  it('con 100 valores 1..100 el p95 es 95', () => {
    const ordenados = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(ordenados, 0.5)).toBe(50);
    expect(percentil(ordenados, 0.95)).toBe(95);
  });

  it('una lista vacía devuelve 0', () => {
    expect(percentil([], 0.95)).toBe(0);
  });
});

describe('estadisticasFrames', () => {
  it('resume una secuencia de 60 fps', () => {
    const deltas = Array.from({ length: 60 }, () => 16.7);
    expect(estadisticasFrames(deltas)).toEqual({ muestras: 60, pausas: 0, p50: 16.7, p95: 16.7, maximo: 16.7 });
  });

  it('el p95 refleja el frame lento del 5 % superior sin que el pico lo tape', () => {
    // 18 frames a 60 fps y 2 lentos de 20: el p95 cae en 33,4 y no en el pico de 60.
    const deltas = [...Array.from({ length: 18 }, () => 16.7), 33.4, 60];
    const stats = estadisticasFrames(deltas);
    expect(stats.muestras).toBe(20);
    expect(stats.p50).toBe(16.7);
    expect(stats.p95).toBe(33.4);
    expect(stats.maximo).toBe(60);
  });

  it('con casi todo rápido el p95 se queda en el frame rápido', () => {
    // 39 rápidos y 1 lento: el percentil 95 sigue en 16,7 aunque haya un pico.
    const deltas = [...Array.from({ length: 39 }, () => 16.7), 120];
    const stats = estadisticasFrames(deltas);
    expect(stats.p95).toBe(16.7);
    expect(stats.maximo).toBe(120);
  });

  it('descarta las pausas del navegador y los valores imposibles', () => {
    const stats = estadisticasFrames([16.7, 0, -5, Number.NaN, PAUSA_MS + 1, 900, 16.7]);
    expect(stats.muestras).toBe(2);
    expect(stats.pausas).toBe(2);
    expect(stats.p95).toBe(16.7);
  });

  it('una medición vacía no inventa percentiles', () => {
    expect(estadisticasFrames([])).toEqual({ muestras: 0, pausas: 0, p50: 0, p95: 0, maximo: 0 });
  });

  it('exige más muestras que las mínimas para considerar buena la medición', () => {
    const pocas = estadisticasFrames(Array.from({ length: MUESTRAS_MINIMAS - 1 }, () => 16.7));
    const suficientes = estadisticasFrames(Array.from({ length: MUESTRAS_MINIMAS }, () => 16.7));
    expect(pocas.muestras).toBeLessThan(MUESTRAS_MINIMAS);
    expect(suficientes.muestras).toBeGreaterThanOrEqual(MUESTRAS_MINIMAS);
  });
});
