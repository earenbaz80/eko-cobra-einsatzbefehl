/**
 * Configuración de la prueba de humo: contra qué se corre y con qué topes.
 *
 * Modo local (lo que corre el CI): sirve `dist/` bajo `VITE_BASE_PATH`.
 * Modo remoto: `npm run smoke:prod`, `node scripts/smoke.mjs <url>` o `SMOKE_URL=…`.
 * Ahí no se sirve dist/: se comprueba lo publicado, que es donde se ven un base mal
 * puesto, un Content-Type raro o una caché que oculta el último despliegue.
 */
import { resolve } from 'node:path';

const URL_REMOTA = (
  process.argv.slice(2).find((arg) => /^https?:\/\//i.test(arg)) ??
  process.env.SMOKE_URL ??
  ''
).trim();

export const ES_REMOTO = URL_REMOTA.length > 0;
export const URL_PUBLICADA = URL_REMOTA;

const RAW_BASE = ES_REMOTO ? new URL(URL_REMOTA).pathname : process.env.VITE_BASE_PATH ?? '/';
const CLEAN_BASE = RAW_BASE.replace(/^\/+|\/+$/g, '');
export const BASE = CLEAN_BASE ? `/${CLEAN_BASE}/` : '/';
export const DIST = resolve(process.cwd(), 'dist');

/**
 * Presupuesto de frames: tope del p95 del delta entre frames (ms).
 *
 * Medido da 33,4 ms de p95 en escritorio y 50-66,7 ms en móvil emulado (la escena alterna
 * frames de 16,7, 33,4 y 50 ms según el navegador), en la Misión 1 y en el Laboratorio.
 * Los topes están por encima de eso porque un runner cargado mete picos de dos frames sin
 * que el juego tenga un problema; lo que sí falla es un juego a 3+ frames por fotograma
 * (50 ms) o un móvil por debajo de 15 fps (70 ms, con margen para el 66,7 exacto).
 */
export const PRESUPUESTO_FRAMES = {
  escritorio: 50,
  movil: 70,
};

/** Commit que debe estar sirviendo Pages; el job de deploy lo pasa en SMOKE_EXPECTED_SHA. */
export const SHA_ESPERADO = (process.env.SMOKE_EXPECTED_SHA ?? '').trim().toLowerCase();

/** Semilla fija del E2E; `SMOKE_SEED` permite repetir una pasada concreta. */
const SEMILLA_CRUDA = (process.env.SMOKE_SEED ?? '0xE2E0').trim();
const SEMILLA_NUMERO = Number(SEMILLA_CRUDA);
if (!Number.isFinite(SEMILLA_NUMERO)) {
  throw new Error(`SMOKE_SEED inválida: ${SEMILLA_CRUDA}`);
}
export const SEMILLA_E2E = SEMILLA_NUMERO >>> 0;
export const SEMILLA_E2E_TEXTO = `0x${SEMILLA_E2E.toString(16)}`;

// Topes de peso: un asset de varios MB o un salto del bundle no debería pasar el CI.
// Los valores salen de lo que ocupa el build con ~3 % de margen (JS de entrada
// 479 KiB, dist 1725 KiB): ajustados a propósito para que el tope avise antes de
// una subida real, no sólo de un desastre. Si un asset nuevo es legítimo, se sube
// aquí a mano.
//
// El tope de dist se revisó al subir el canal de píxeles: desde que se fijó en
// 1700 KiB el build pasó de 1688 a 1725 KiB y los 37 KiB son todos JS de entrada
// (455 → 490 kB), porque `public/` no cambió, no hay sourcemaps y los binarios
// pesados siguen igual (sprite 396 KiB, tarjeta social 122, emblema del título
// 106, textura del battlemap 80). Recortar 25 KiB de código para no tocar el tope
// habría sido lo caro; lo que estaba mal era el margen, que se calculó sobre una
// medición vieja y dejaba sólo 12 KiB de aire sobre el build real.
export const PRESUPUESTO = {
  entradaJs: 490 * 1024,
  entradaJsGzip: 170 * 1024,
  sprite: 450 * 1024,
  tarjetaSocial: 150 * 1024,
  dist: 1780 * 1024,
};

/** Tipos que usa el servidor local para imitar a GitHub Pages. */
export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
