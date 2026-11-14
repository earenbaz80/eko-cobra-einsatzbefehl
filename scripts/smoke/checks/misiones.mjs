/**
 * Siete misiones: cada una tiene que arrancar, llegar al HUD de partida y pintar
 * una escena con contenido. Es la cobertura barata de los escenarios (estación,
 * metro, laboratorio, chalet, aeropuerto, estación nocturna), donde un fallo de
 * renderizado no lo ve ninguna otra comprobación.
 *
 * El resto de pruebas profundas —audio, joystick y franjas del HUD— se quedan en
 * la Misión 1 para que la pasada completa no crezca siete veces.
 */
import { fail } from '../informe.mjs';
import { estadisticasCanvas } from '../canvas.mjs';
import { arrancarMision } from '../navegador.mjs';

/** Nombre accesible de cada botón del menú de misiones, en el orden del menú. */
export const MISIONES = [
  'Misión 1: Piso Graz - Lend',
  'Misión 2: Estación de Trenes',
  'Misión 2B: Estación Nocturna',
  'Misión 6: Metro U3 (Incidente)',
  'Misión 3: Laboratorio Químico',
  'Misión 4: Chalet Alpino (Tirol)',
  'Misión 5: Aeropuerto Wien-Schwechat',
];

/** Arranca una misión desde cero y devuelve las estadísticas del canvas. */
async function arrancarYmedir(page, url, nombre) {
  // Se recarga en vez de volver al menú: cada misión empieza con el estado limpio.
  await arrancarMision(page, url, nombre);
  return estadisticasCanvas(page);
}

/** Sección de misiones: siete arranques seguidos, con las mismas exigencias que el escritorio. */
export async function comprobarMisiones(page, { url }) {
  for (const nombre of MISIONES) {
    const etiqueta = `misiones ${nombre}`;
    let canvas = null;
    try {
      canvas = await arrancarYmedir(page, url, nombre);
    } catch (error) {
      fail(`${etiqueta}: no arranca (${error.message.split('\n')[0]})`);
      continue;
    }

    if (!canvas || canvas.error) {
      fail(`${etiqueta}: ${canvas ? canvas.error : 'no existe el canvas'}`);
      continue;
    }
    const proporcion = canvas.visibles / canvas.muestras;
    if (canvas.width < 320 || canvas.height < 240) {
      fail(`${etiqueta}: canvas con tamaño raro ${canvas.width}x${canvas.height}`);
      continue;
    }
    if (canvas.tonos < 8) {
      fail(`${etiqueta}: canvas prácticamente liso (${canvas.tonos} tonos)`);
    } else if (proporcion < 0.05) {
      fail(`${etiqueta}: canvas casi negro (${(proporcion * 100).toFixed(1)} % de píxeles visibles)`);
    } else {
      console.log(`${etiqueta}: canvas ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(0)} % de píxeles visibles`);
    }
  }
}
