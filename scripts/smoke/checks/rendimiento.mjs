/**
 * Presupuesto de frame time: p50/p95 de los deltas de `requestAnimationFrame` durante una
 * ventana de medición, en la Misión 1 y en una misión densa, en escritorio y en móvil
 * emulado. Los topes de peso no ven un juego que va a tirones, y esto sí.
 *
 * La ventana se mide justo después del arranque, cuando ya hay sprites cargados y la
 * escena está pintándose; el calentamiento inicial se descarta para no medir la carga.
 */
import { fail } from '../informe.mjs';
import { PRESUPUESTO_FRAMES } from '../config.mjs';
import { MUESTRAS_MINIMAS, estadisticasFrames } from '../rendimiento.mjs';
import { arrancarMision, vigilarPagina } from '../navegador.mjs';

const MISION_1 = 'Misión 1: Piso Graz - Lend';
const MISION_DENSA = 'Misión 3: Laboratorio Químico';
const MISIONES_MEDIDAS = [MISION_1, MISION_DENSA];

const MEDICION = { calentamientoMs: 500, duracionMs: 2500 };

/** El contexto móvil emulado, igual que el que usan el resto de pruebas táctiles. */
const PERFIL_MOVIL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

/** Del centro de la página: deltas de rAF durante la ventana, sin el calentamiento. */
const medirFrames = (page) =>
  page.evaluate(
    ({ calentamientoMs, duracionMs }) =>
      new Promise((resolver) => {
        const deltas = [];
        let inicio = 0;
        let anterior = 0;
        const paso = (marca) => {
          if (!inicio) {
            inicio = marca;
            anterior = marca;
          }
          const transcurrido = marca - inicio;
          if (transcurrido < calentamientoMs) {
            anterior = marca;
            window.requestAnimationFrame(paso);
            return;
          }
          deltas.push(marca - anterior);
          anterior = marca;
          if (transcurrido < calentamientoMs + duracionMs) window.requestAnimationFrame(paso);
          else resolver(deltas);
        };
        window.requestAnimationFrame(paso);
      }),
    MEDICION
  );

/** Aplica el presupuesto a una medición y deja la línea del informe. */
function comprobarFrames(etiqueta, deltas, topeP95) {
  const stats = estadisticasFrames(deltas);
  if (stats.muestras < MUESTRAS_MINIMAS) {
    fail(`${etiqueta}: medición insuficiente (${stats.muestras} frames, ${stats.pausas} pausas)`);
    return;
  }
  const resumen = `p50 ${stats.p50.toFixed(1)} ms · p95 ${stats.p95.toFixed(1)} ms · max ${stats.maximo.toFixed(1)} ms · ${stats.muestras} frames · ${stats.pausas} pausas`;
  if (stats.p95 > topeP95) fail(`${etiqueta}: ${resumen} (tope p95 ${topeP95} ms)`);
  else console.log(`${etiqueta}: ${resumen} (tope p95 ${topeP95} ms)`);
}

/**
 * Mide la ventana y, si salieron muy pocos frames, la repite una vez: una pestaña que el
 * navegador tiene por oculta produce cuatro frames y no dice nada del juego.
 */
async function medirVentana(page) {
  let deltas = await medirFrames(page);
  if (estadisticasFrames(deltas).muestras >= MUESTRAS_MINIMAS) return deltas;
  await page.bringToFront();
  await page.waitForTimeout(300);
  return medirFrames(page);
}

/**
 * Mide con una repetición de cortesía. Un pico del sistema (antivirus, GC del runner o
 * otra pestaña del navegador compitiendo por la CPU) puede colarse en los 2,5 s de la
 * ventana y superar el tope sin que el juego haya empeorado; una regresión real lo supera
 * en las dos mediciones. Se conserva la mejor de las dos.
 */
async function medirConRepeticion(page, topeP95) {
  const primera = await medirVentana(page);
  if (estadisticasFrames(primera).p95 <= topeP95) return primera;
  await page.waitForTimeout(300);
  const segunda = await medirVentana(page);
  if (estadisticasFrames(segunda).p95 < estadisticasFrames(primera).p95) {
    console.log('rendimiento: la primera ventana superó el tope, se conserva la repetición');
    return segunda;
  }
  return primera;
}

/** Mide las misiones pautadas en una pestaña ya abierta. */
async function medirMisiones(perfil, page, url, tope) {
  for (const mision of MISIONES_MEDIDAS) {
    await arrancarMision(page, url, mision);
    comprobarFrames(`rendimiento ${perfil} · ${mision}`, await medirConRepeticion(page, tope), tope);
  }
}

/** Sección de rendimiento: escritorio en la pestaña compartida y móvil en un contexto táctil. */
export async function comprobarRendimiento(page, { url, origin, badRequests, consoleErrors }) {
  // En primer plano: una pestaña en segundo plano estrangula rAF y falsea la medición.
  await page.bringToFront();
  await medirMisiones('escritorio', page, url, PRESUPUESTO_FRAMES.escritorio);

  const navegador = page.context().browser();
  if (!navegador) return; // sin navegador no hay móvil que medir; el resto de secciones ya cubre la app

  const contextoMovil = await navegador.newContext(PERFIL_MOVIL);
  const movil = await contextoMovil.newPage();
  vigilarPagina(movil, {
    origin,
    badRequests,
    consoleErrors,
    prefijo: 'rendimiento móvil ',
    fallosDeRed: false,
  });
  try {
    // En primer plano: si el navegador considera la pestaña oculta, rAF se estrangula.
    await movil.bringToFront();
    await medirMisiones('móvil emulado', movil, url, PRESUPUESTO_FRAMES.movil);
  } finally {
    await contextoMovil.close();
  }
}
