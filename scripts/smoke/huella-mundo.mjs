/**
 * Huella del mundo procedural de una misión.
 *
 * El mobiliario del piso sale sorteado con la semilla del humo, así que dos pasadas
 * con la misma semilla tienen que producir exactamente el mismo mundo. Cuando una
 * comprobación pasa aislada y falla en el perfil completo, la sospecha es el estado
 * heredado (partida guardada, misión retomada, otra pestaña); esta huella separa esa
 * sospecha de un fallo del propio paso: si cambia, el mundo que se está mirando no es
 * el procedural esperado.
 *
 * Se resume con FNV-1a sobre muros, puertas y mobiliario, en el orden del escenario y
 * con las coordenadas redondeadas a la centésima para que el ruido de coma flotante no
 * invento una diferencia.
 */

/** FNV-1a de 32 bits, en hexadecimal de 8 dígitos. */
export function fnv1a(texto) {
  let hash = 0x811c9dc5;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const centesima = (numero) => Math.round(numero * 100) / 100;

/** Texto canónico del mundo: muros, hojas y muebles en el orden del escenario. */
export function canonizarMundo(mundo) {
  const partes = [];
  for (const muro of mundo?.walls ?? []) {
    partes.push(`w|${muro.id}|${centesima(muro.x1)},${centesima(muro.y1)}|${centesima(muro.x2)},${centesima(muro.y2)}`);
  }
  for (const puerta of mundo?.doors ?? []) {
    partes.push(
      `d|${puerta.id}|${centesima(puerta.x1)},${centesima(puerta.y1)}|` +
        `${centesima(puerta.x2)},${centesima(puerta.y2)}|${puerta.isLocked ? 1 : 0}`
    );
  }
  for (const mueble of mundo?.furniture ?? []) {
    partes.push(
      `f|${mueble.id}|${centesima(mueble.x)},${centesima(mueble.y)},` +
        `${centesima(mueble.w)},${centesima(mueble.h)}|` +
        `${mueble.blocksMovement ? 1 : 0}${mueble.blocksSight ? 1 : 0}`
    );
  }
  return partes.join(';');
}

/** Huella del mundo procedural de una instantánea del motor. */
export const huellaDelMundo = (mundo) => fnv1a(canonizarMundo(mundo));

/** Recuento del escenario, para que el mensaje diga qué cambió de tamaño. */
export const contarMundo = (mundo) => ({
  muros: mundo?.walls?.length ?? 0,
  puertas: mundo?.doors?.length ?? 0,
  muebles: mundo?.furniture?.length ?? 0,
});
