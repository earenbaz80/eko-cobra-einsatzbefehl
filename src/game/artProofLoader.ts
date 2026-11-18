/**
 * Carga diferida del pase de arte (`?art=proof`).
 *
 * El canal de arte —tileset, sprites, buffer de 640x360 y su hash— es una
 * herramienta de desarrollo y del humo: quien juega no lo necesita. Por eso vive
 * en su propio chunk y sólo se pide cuando la URL pide la prueba; el arranque
 * normal no paga sus ~47 kB.
 *
 * Las dos raíces que antes lo importaban de forma estática (el motor, para
 * dibujar, y el hook E2E, para hashear) leen de aquí: si alguna volviera a
 * importar `./artProof` directamente, Rollup lo devolvería al JS de entrada y el
 * split dejaría de existir.
 */
import type * as PaseDeArte from './artProof';

let solicitado: boolean | null = null;
let evaluado: typeof PaseDeArte | null = null;
let descarga: Promise<void> | null = null;

/** True si la URL pide la prueba de arte. Sólo lee la query, no carga nada. */
export function paseDeArtePedido(): boolean {
  if (solicitado === null) {
    solicitado =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('art') === 'proof';
  }
  return solicitado;
}

/**
 * Pide el chunk una sola vez. Fuera de `?art=proof` no hace nada, así el juego
 * normal nunca descarga el pase de arte.
 */
export function precargarPaseDeArte(): void {
  if (!paseDeArtePedido() || descarga) return;
  descarga = import('./artProof')
    .then((modulo) => {
      evaluado = modulo;
    })
    .catch(() => {
      // Si el chunk no llega, el juego sigue con el pase normal.
      descarga = null;
    });
}

/** El módulo ya evaluado, o null mientras viaja (o si la prueba no se pidió). */
export function paseDeArteCargado(): typeof PaseDeArte | null {
  return evaluado;
}
