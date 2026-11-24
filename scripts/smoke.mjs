/**
 * Prueba de humo en navegador para el build de GitHub Pages.
 *
 * Sirve dist/ bajo el mismo base que usa Pages, abre la página con Chromium y comprueba:
 *   1. que el canvas se ha renderizado (no está en blanco),
 *   2. que ninguna petición del propio sitio devuelve 404/5xx,
 *   3. que la Misión 1 arranca y muestra el HUD en juego, que las siete misiones
 *      pintan una escena con contenido y que, tras mover al operador y recargar, la
 *      partida guardada reanuda la misma posición y el mismo mundo,
 *   4. que los metadatos sociales, los iconos y el manifest están completos, y que la
 *      Misión 1 y una misión densa mantienen el p95 de frame time dentro del presupuesto
 *      en escritorio y en móvil emulado,
 *   5. que en viewport móvil con hasTouch aparece el joystick y mueve de verdad al operador,
 *   6. que el JS de entrada y los assets críticos no superan sus topes de peso,
 *   7. en modo remoto, que lo publicado devuelve los Content-Type y las cabeceras
 *      de caché con las que Pages sirve el juego,
 *   8. y, si algo falla, deja captura y traza de Playwright en `.smoke-fallos/` para
 *      ver la pantalla en el artifact del CI.
 *
 * Cada bloque vive en su módulo, con nombre propio:
 *   smoke/checks/entrega.mjs     pesos, Content-Type y caché (local y remoto)
 *   smoke/checks/misiones.mjs    las siete misiones arrancan y pintan escena
 *   smoke/checks/escritorio.mjs  partida, canvas, metadatos, manifest, iconos y favicon
 *   smoke/checks/ordenes.mjs     ejecución real de brecha, sonda y HOLD de Kobra 2
 *   smoke/checks/rapido.mjs      perfil de PR: peso de arranque, canvas, Misión 1 y transiciones
 *   smoke/checks/transiciones.mjs pausa, reanudación y vuelta al título (rápido y completo)
 *   smoke/checks/persistencia.mjs mover, despejar una sala, autoguardar, reanudar y volver a
 *   contacto al tener dentro un hostil conocido
 *   smoke/checks/rendimiento.mjs p50/p95 de frame time en escritorio y móvil emulado
 *   smoke/checks/movil.mjs       audio al primer toque, joystick y franjas del HUD
 *   smoke/checks/arte.mjs       pase de píxeles por defecto y opt-out clásico (rápido y completo)
 *   smoke/checks/pantallas-de-arte.mjs  pase y buffer 640x360 en título, misión, pausa, EKO-PAD y móvil
 * y las piezas comunes en smoke/config, informa, archivos, servidor-local, navegador y canvas.
 *
 * Perfiles:
 *   npm run smoke        cobertura completa (main, nightly y deploy)
 *   npm run smoke:quick  feedback de PR: peso de arranque, canvas, Misión 1 y transiciones
 *
 * La aleatoriedad se fija con mulberry32 antes de cargar la app. La semilla por
 * defecto es 0xE2E0 y `SMOKE_SEED` permite repetir una pasada concreta. Cada
 * arranque de misión vuelve a sembrar justo antes del clic: el mobiliario
 * procedural sale del mismo mundo en cada pasada y un fallo se reproduce con la
 * misma semilla.
 *
 * Uso local (lo que corre el CI): VITE_BASE_PATH=/eko-cobra-einsatzbefehl/ npm run build && npm run smoke
 * Uso contra lo publicado:        npm run smoke:prod   (o `node scripts/smoke.mjs <url>`)
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { BASE, DIST, ES_REMOTO, SEMILLA_E2E, SEMILLA_E2E_TEXTO, URL_PUBLICADA } from './smoke/config.mjs';
import { instalarAzarDeterminista } from './smoke/determinismo.mjs';
import { fail, fallos } from './smoke/informe.mjs';
import { arrancarServidorLocal } from './smoke/servidor-local.mjs';
import { vigilarPagina } from './smoke/navegador.mjs';
import { arrancarTraza, escribirInforme, guardarDiagnostico, limpiarDiagnostico, DIR_DIAGNOSTICO } from './smoke/diagnostico.mjs';
import { comprobarEntrega } from './smoke/checks/entrega.mjs';
import { comprobarMisiones } from './smoke/checks/misiones.mjs';
import { comprobarEscritorio } from './smoke/checks/escritorio.mjs';
import { comprobarDespeje } from './smoke/checks/despeje.mjs';
import { comprobarOrdenesEscuadron } from './smoke/checks/ordenes.mjs';
import { comprobarRapido } from './smoke/checks/rapido.mjs';
import { comprobarPersistencia } from './smoke/checks/persistencia.mjs';
import { comprobarRendimiento } from './smoke/checks/rendimiento.mjs';
import { comprobarMovil } from './smoke/checks/movil.mjs';
import { comprobarArtProof } from './smoke/checks/arte.mjs';
import { comprobarPantallasDeArte, comprobarPantallasDeArteMovil } from './smoke/checks/pantallas-de-arte.mjs';

const args = process.argv.slice(2);
const perfil = (
  args.includes('--quick')
    ? 'quick'
    : args.includes('--full')
      ? 'full'
      : (process.env.SMOKE_PROFILE ?? 'full')
).trim().toLowerCase();
if (perfil !== 'quick' && perfil !== 'full') {
  console.error(`Perfil de humo desconocido: ${perfil}. Usa quick o full.`);
  process.exit(2);
}
const ES_RAPIDO = perfil === 'quick';

if (!ES_REMOTO && !existsSync(DIST)) {
  console.error('No existe dist/. Compila antes: VITE_BASE_PATH=... npm run build');
  process.exit(1);
}

const { server, origin } = ES_REMOTO
  ? { server: null, origin: new URL(URL_PUBLICADA).origin }
  : await arrancarServidorLocal();
const url = `${origin}${BASE}`;
console.log(ES_REMOTO ? `comprobando lo publicado en ${url}` : `sirviendo dist/ en ${url}`);
console.log(`perfil de humo: ${ES_RAPIDO ? 'rápido (PR)' : 'completo'}`);
console.log(`aleatoriedad determinista: semilla ${SEMILLA_E2E_TEXTO}`);

limpiarDiagnostico();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// La traza se graba durante toda la pasada: solo se guarda si algo falla.
const contextoNavegador = page.context();
// Antes de cualquier navegación: el mobiliario y la IA ya nacen con esta semilla.
await instalarAzarDeterminista(contextoNavegador, SEMILLA_E2E);
await arrancarTraza(contextoNavegador);

// Listas compartidas: las tres secciones apuntan aquí sus fallos de red y consola.
const badRequests = [];
const consoleErrors = [];
const contexto = { url, origin, page, badRequests, consoleErrors, semilla: SEMILLA_E2E };
vigilarPagina(page, { origin, badRequests, consoleErrors });

try {
  if (ES_RAPIDO) {
    await comprobarRapido(page, contexto);
    await comprobarPantallasDeArte(page, contexto);
    await comprobarArtProof(page, contexto);
  } else {
    await comprobarEntrega(contexto);
    await comprobarMisiones(page, contexto);
    await comprobarEscritorio(page, contexto);
    await comprobarDespeje(page, contexto);
    await comprobarOrdenesEscuadron(page, contexto);
    await comprobarRendimiento(page, contexto);
    await comprobarMovil(browser, contexto);
    // Al final: la recarga y los cinco segundos de autoguardado no deben contaminar
    // la medición de frames, que es la comprobación más sensible al ruido del runner.
    await comprobarPersistencia(page, contexto);
    // Recorre cada pantalla con el pase ya caliente: título, misión, pausa y EKO-PAD en
    // escritorio, y las mismas cuatro en un contexto táctil de 390x844.
    await comprobarPantallasDeArte(page, contexto);
    await comprobarPantallasDeArteMovil(browser, contexto);
    // Al final: recarga la página (pase por defecto, opt-out y misiones) y no depende del estado previo.
    await comprobarArtProof(page, contexto);
  }
} catch (error) {
  fail(`navegación/interacción: ${error.message}`);
} finally {
  if (badRequests.length) fail(`peticiones fallidas (${badRequests.length}):\n  ${badRequests.slice(0, 10).join('\n  ')}`);
  if (consoleErrors.length) fail(`errores en consola (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 10).join('\n  ')}`);
  if (fallos.length) {
    escribirInforme(fallos);
    await guardarDiagnostico(contextoNavegador, page, 'escritorio');
    console.error(`captura y traza en ${DIR_DIAGNOSTICO} (el CI las sube como artifact)`);
  }
  await browser.close();
  server?.close();
}

if (fallos.length) {
  console.error(`\n✗ Prueba de humo fallida:\n- ${fallos.join('\n- ')}`);
  process.exit(1);
}
const cobertura = ES_RAPIDO
  ? 'perfil rápido: peso de arranque, canvas, Misión 1, transiciones, pase por pantalla y art proof'
  : 'cobertura completa: misiones, despeje, móvil, persistencia, metadatos, pase por pantalla y rendimiento';
console.log(`\n✓ Prueba de humo correcta${ES_REMOTO ? ' (URL publicada)' : ''}: ${cobertura}.`);
