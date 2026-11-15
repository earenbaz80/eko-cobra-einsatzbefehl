import { describe, expect, it } from 'vitest';
import { ejecutarReplay, hashTrayectoria, mismasTrayectorias, type Replay } from './replay';
import { PASO_MAXIMO } from './simulation';

const pasos = (n: number, x: number, y: number) => Array.from({ length: n }, () => ({ x, y, dt: PASO_MAXIMO }));

const derechaPasillo: Replay = { mision: 'pasillo', semilla: 1, pasos: pasos(60, 1, 0) };
const izquierdaGraz: Replay = { mision: 'graz', semilla: 7, pasos: pasos(200, -1, 0) };

describe('replay determinista', () => {
  it('la misma semilla y entradas producen la misma trayectoria completa', () => {
    const a = ejecutarReplay(derechaPasillo);
    const b = ejecutarReplay(derechaPasillo);
    expect(mismasTrayectorias(a, b)).toBe(true);
    expect(a.muestras).toEqual(b.muestras);
    expect(hashTrayectoria(a)).toBe(hashTrayectoria(b));
  });

  it('una entrada distinta cambia la trayectoria y el hash', () => {
    const base = ejecutarReplay(derechaPasillo);
    const otra = ejecutarReplay({ ...derechaPasillo, pasos: pasos(60, 0, 1) });
    expect(mismasTrayectorias(base, otra)).toBe(false);
    expect(hashTrayectoria(base)).not.toBe(hashTrayectoria(otra));
  });

  it('la trayectoria de la puerta cerrada queda fijada (regresión de colisión)', () => {
    const trayectoria = ejecutarReplay(derechaPasillo);
    expect(trayectoria.muestras).toHaveLength(60);
    expect(trayectoria.muestras.at(-1)).toMatchObject({ x: 288, y: 80, tick: 60 });
    expect(hashTrayectoria(trayectoria)).toBe('3e94bfa3');
  });

  it('la trayectoria contra la pared real de Graz queda fijada', () => {
    const trayectoria = ejecutarReplay(izquierdaGraz);
    expect(trayectoria.muestras.at(-1)?.x).toBeLessThanOrEqual(110);
    expect(trayectoria.muestras.at(-1)?.x).toBeGreaterThan(90);
    expect(hashTrayectoria(trayectoria)).toBe('5db34aaa');
  });
});
