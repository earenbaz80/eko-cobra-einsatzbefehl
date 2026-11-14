/**
 * Diagnóstico de un humo fallido: la captura de lo que se estaba viendo y la traza de
 * Playwright del contexto. En local quedan en `.smoke-fallos/`; en CI, el job las sube
 * como artifact, porque en el log solo se ve el mensaje del fallo y no la pantalla.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DIR_DIAGNOSTICO = resolve(process.cwd(), '.smoke-fallos');

/** Deja la carpeta limpia: no se suben trazas de una pasada anterior. */
export const limpiarDiagnostico = () => rmSync(DIR_DIAGNOSTICO, { recursive: true, force: true });

/**
 * Empieza a grabar la traza de un contexto, con snapshots del DOM pero sin captura de
 * cada paso: la pasada recorre siete misiones y con las dos cosas el zip se iba a 37 MB
 * por run; con los snapshots queda en ~0,7 MB y la captura final da la parte visual.
 */
export const arrancarTraza = (contexto) => contexto.tracing.start({ screenshots: false, snapshots: true, sources: false });

/**
 * Deja el informe del fallo por escrito junto a la captura. El log de un job se pierde
 * al terminar el run; este fichero viaja en el artifact y se puede leer después.
 */
export function escribirInforme(fallos) {
  if (!fallos.length) return;
  mkdirSync(DIR_DIAGNOSTICO, { recursive: true });
  writeFileSync(join(DIR_DIAGNOSTICO, 'informe.txt'), `${fallos.map((fallo) => `- ${fallo}`).join('\n')}\n`, 'utf8');
}

/** Captura la pestaña tal como está. Nunca lanza: el fallo original es el que importa. */
export async function capturarPantalla(page, nombre) {
  mkdirSync(DIR_DIAGNOSTICO, { recursive: true });
  try {
    await page.screenshot({ path: join(DIR_DIAGNOSTICO, `captura-${nombre}.png`) });
  } catch (error) {
    console.error(`no se pudo capturar la pantalla (${nombre}): ${error.message.split('\n')[0]}`);
  }
}

/** Guarda captura y traza de un contexto. Nunca lanza. */
export async function guardarDiagnostico(contexto, page, nombre) {
  mkdirSync(DIR_DIAGNOSTICO, { recursive: true });
  await capturarPantalla(page, nombre);
  try {
    await contexto.tracing.stop({ path: join(DIR_DIAGNOSTICO, `traza-${nombre}.zip`) });
  } catch (error) {
    console.error(`no se pudo guardar la traza (${nombre}): ${error.message.split('\n')[0]}`);
  }
}
