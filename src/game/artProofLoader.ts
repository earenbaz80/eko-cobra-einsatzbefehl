/**
 * Carga diferida del pase de arte en píxeles, que es el render por defecto.
 *
 * El canal de arte —tileset, sprites, buffer de 640x360 y su hash— viaja en su
 * propio chunk (~47 kB) para que el documento y el entry queden chicos. El motor
 * lo pide en cuanto dibuja el primer cuadro; mientras viaja, la escena se pinta
 * con el pase clásico, así que nunca queda en blanco y el cambio de canal no
 * depende de la red.
 *
 * `?art=classic` desactiva el pase y deja el render anterior para comparar: en
 * ese caso el chunk no se descarga y el juego se comporta como antes del pase.
 *
 * Las dos raíces que antes lo importaban de forma estática (el motor, para
 * dibujar, y el hook E2E, para hashear) leen de aquí: si alguna volviera a
 * importar `./artProof` directamente, Rollup lo devolvería al JS de entrada y el
 * split dejaría de existir.
 */
import type * as PaseDeArte from './artProof';

let clasicoPedido: boolean | null = null;
let evaluado: typeof PaseDeArte | null = null;
let descarga: Promise<void> | null = null;

/** True si la URL pide el render anterior. Sólo lee la query, no carga nada. */
export function paseClasicoPedido(): boolean {
  if (clasicoPedido === null) {
    clasicoPedido =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('art') === 'classic';
  }
  return clasicoPedido;
}

/**
 * Pide el chunk una sola vez. Con `?art=classic` no hace nada, así la comparación
 * con el render anterior no descarga el pase.
 */
export function precargarPaseDeArte(): void {
  if (paseClasicoPedido() || descarga) return;
  descarga = import('./artProof')
    .then((modulo) => {
      evaluado = modulo;
    })
    .catch(() => {
      // Si el chunk no llega, el juego sigue con el pase clásico.
      descarga = null;
    });
}

/** El módulo ya evaluado, o null mientras viaja (o si se pidió el pase clásico). */
export function paseDeArteCargado(): typeof PaseDeArte | null {
  return evaluado;
}
