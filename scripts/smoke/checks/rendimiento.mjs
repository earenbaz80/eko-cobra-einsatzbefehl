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
  const resumen = `p50 ${stats.p50.toFixed(1)} ms · p95 ${stats.p95.toFixed(1)} ms · max ${stats.maximo.toFixed(1)} ms · ${stats.muestras} frames`;
  if (stats.p95 > topeP95) fail(`${etiqueta}: ${resumen} (tope p95 ${topeP95} ms)`);
  else console.log(`${etiqueta}: ${resumen} (tope p95 ${topeP95} ms)`);
}

/** Mide las misiones pautadas en una pestaña ya abierta. */
async function medirMisiones(perfil, page, url, tope) {
  for (const mision of MISIONES_MEDIDAS) {
    await arrancarMision(page, url, mision);
    comprobarFrames(`rendimiento ${perfil} · ${mision}`, await medirFrames(page), tope);
  }
}

/** Sección de rendimiento: escritorio en la pestaña compartida y móvil en un contexto táctil. */
export async function comprobarRendimiento(page, { url, origin, badRequests, consoleErrors }) {
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
