/**
 * Prueba de humo en navegador para el build de GitHub Pages.
 *
 * Sirve dist/ bajo el mismo base que usa Pages, abre la página con Chromium y comprueba:
 *   1. que el canvas se ha renderizado (no está en blanco),
 *   2. que ninguna petición del propio sitio devuelve 404/5xx,
 *   3. que la Misión 1 arranca y muestra el HUD en juego,
 *   4. que los metadatos sociales, los iconos y el manifest están completos,
 *   5. que en viewport móvil con hasTouch aparece el joystick y mueve de verdad al operador,
 *   6. que el JS de entrada y los assets críticos no superan sus topes de peso,
 *   7. en modo remoto, que lo publicado devuelve los Content-Type y las cabeceras
 *      de caché con las que Pages sirve el juego.
 *
 * Cada bloque vive en su módulo, con nombre propio:
 *   smoke/checks/entrega.mjs     pesos, Content-Type y caché (local y remoto)
 *   smoke/checks/escritorio.mjs  partida, canvas, metadatos, manifest, iconos y favicon
 *   smoke/checks/movil.mjs       audio al primer toque, joystick y franjas del HUD
 * y las piezas comunes en smoke/config, informa, archivos, servidor-local, navegador y canvas.
 *
 * Uso local (lo que corre el CI): VITE_BASE_PATH=/eko-cobra-einsatzbefehl/ npm run build && npm run smoke
 * Uso contra lo publicado:        npm run smoke:prod   (o `node scripts/smoke.mjs <url>`)
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { BASE, DIST, ES_REMOTO, URL_PUBLICADA } from './smoke/config.mjs';
import { fail, fallos } from './smoke/informe.mjs';
import { arrancarServidorLocal } from './smoke/servidor-local.mjs';
import { vigilarPagina } from './smoke/navegador.mjs';
import { comprobarEntrega } from './smoke/checks/entrega.mjs';
import { comprobarEscritorio } from './smoke/checks/escritorio.mjs';
import { comprobarMovil } from './smoke/checks/movil.mjs';

if (!ES_REMOTO && !existsSync(DIST)) {
  console.error('No existe dist/. Compila antes: VITE_BASE_PATH=... npm run build');
  process.exit(1);
}

const { server, origin } = ES_REMOTO
  ? { server: null, origin: new URL(URL_PUBLICADA).origin }
  : await arrancarServidorLocal();
const url = `${origin}${BASE}`;
console.log(ES_REMOTO ? `comprobando lo publicado en ${url}` : `sirviendo dist/ en ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Listas compartidas: las tres secciones apuntan aquí sus fallos de red y consola.
const badRequests = [];
const consoleErrors = [];
const contexto = { url, origin, badRequests, consoleErrors };
vigilarPagina(page, { origin, badRequests, consoleErrors });

try {
  await comprobarEntrega(contexto);
  await comprobarEscritorio(page, contexto);
  await comprobarMovil(browser, contexto);
} catch (error) {
  fail(`navegación/interacción: ${error.message}`);
} finally {
  if (badRequests.length) fail(`peticiones fallidas (${badRequests.length}):\n  ${badRequests.slice(0, 10).join('\n  ')}`);
  if (consoleErrors.length) fail(`errores en consola (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 10).join('\n  ')}`);
  await browser.close();
  server?.close();
}

if (fallos.length) {
  console.error(`\n✗ Prueba de humo fallida:\n- ${fallos.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `\n✓ Prueba de humo correcta${ES_REMOTO ? ' (URL publicada)' : ''}: canvas pintado, sin 404, Misión 1 en marcha, móvil con joystick y pesos dentro de tope.`
);
