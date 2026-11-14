/**
 * Presupuesto de frames: los topes de peso no dicen si el juego va fluido. Aquí se
 * resumen los deltas de `requestAnimationFrame` de una ventana de medición, que es lo
 * que de verdad paga quien juega.
 *
 * Ojo con lo que se descarta: una pestaña en segundo plano produce saltos de cientos de
 * milisegundos que no son culpa del juego, así que se cuentan aparte como pausas y no
 * entran en los percentiles.
 */

/** Un delta mayor que esto es una pausa del navegador, no un frame lento. */
export const PAUSA_MS = 500;

/** Sin suficientes frames la medición no dice nada y no debe pasar como buena. */
export const MUESTRAS_MINIMAS = 30;

/** Percentil por rango más cercano (q entre 0 y 1) sobre una lista ya ordenada. */
export function percentil(ordenados, q) {
  if (!ordenados.length) return 0;
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(q * ordenados.length) - 1));
  return ordenados[indice];
}

/** p50, p95 y máximo de los deltas, separando los que son pausas del navegador. */
export function estadisticasFrames(deltas) {
  const validos = [];
  let pausas = 0;
  for (const delta of deltas) {
    if (!Number.isFinite(delta) || delta <= 0) continue;
    if (delta > PAUSA_MS) {
      pausas += 1;
      continue;
    }
    validos.push(delta);
  }
  validos.sort((a, b) => a - b);
  return {
    muestras: validos.length,
    pausas,
    p50: percentil(validos, 0.5),
    p95: percentil(validos, 0.95),
    maximo: validos.length ? validos[validos.length - 1] : 0,
  };
}
