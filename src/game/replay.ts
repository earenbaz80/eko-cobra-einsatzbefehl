/**
 * Replay determinista de la simulación: una semilla más una secuencia de entradas
 * produce siempre la misma trayectoria. El hash compacto permite fijar una
 * trayectoria dorada en los tests y detectar regresiones de física o colisión.
 */
import { crearPartida, PASO_MAXIMO, type MisionSimulada } from './simulation';

export interface EntradaPaso {
  /** Vector de entrada sin normalizar; (0,0) deja al jugador quieto. */
  x: number;
  y: number;
  /** Paso de tiempo; por defecto, el máximo de la simulación. */
  dt?: number;
}

export interface Replay {
  mision: MisionSimulada;
  semilla: number;
  pasos: EntradaPaso[];
}

export interface MuestraTrayectoria {
  x: number;
  y: number;
  tick: number;
  tiempo: number;
}

export interface Trayectoria {
  mision: MisionSimulada;
  semilla: number;
  muestras: MuestraTrayectoria[];
}

/** Ejecuta el replay y devuelve la posición del jugador tras cada paso. */
export function ejecutarReplay(replay: Replay): Trayectoria {
  const partida = crearPartida(replay.mision, replay.semilla);
  const muestras: MuestraTrayectoria[] = [];
  for (const paso of replay.pasos) {
    partida.entrada.x = paso.x;
    partida.entrada.y = paso.y;
    partida.avanzar(paso.dt ?? PASO_MAXIMO);
    muestras.push({
      x: partida.jugador.x,
      y: partida.jugador.y,
      tick: partida.tick,
      tiempo: partida.tiempo,
    });
  }
  return { mision: replay.mision, semilla: replay.semilla, muestras };
}

/** Compara la trayectoria completa (posición, tick y tiempo de cada paso). */
export function mismasTrayectorias(a: Trayectoria, b: Trayectoria): boolean {
  if (a.muestras.length !== b.muestras.length) return false;
  return a.muestras.every((muestra, i) => {
    const otra = b.muestras[i];
    return muestra.x === otra.x && muestra.y === otra.y && muestra.tick === otra.tick && muestra.tiempo === otra.tiempo;
  });
}

/** Hash FNV-1a estable de la trayectoria, con precisión fija de milésimas. */
export function hashTrayectoria(trayectoria: Trayectoria): string {
  const texto = trayectoria.muestras
    .map((m) => `${m.x.toFixed(3)},${m.y.toFixed(3)},${m.tick},${m.tiempo.toFixed(3)}`)
    .join(';');
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
