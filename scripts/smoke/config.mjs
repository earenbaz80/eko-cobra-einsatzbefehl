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
// 479 KiB, dist 1675 KiB): ajustados a propósito para que el tope avise antes de
// una subida real, no sólo de un desastre. Si un asset nuevo es legítimo, se sube
// aquí a mano.
//
// El tope de dist subió a 1780 KiB al crecer el canal de píxeles (+37 KiB de JS de
// entrada, 455 → 490 kB) y volvió a bajar a 1725 KiB al optimizar el emblema del
// título: era el asset más grande del build (106 KiB de SVG de Inkscape) y ahora
// son 56 KiB sin diferencia visible a los 96×112 px en que se muestra. El build
// queda en 1675 KiB: los binarios pesados son sprite 396, tarjeta social 122 y
// textura del battlemap 80. Si un asset crece de verdad, se sube aquí a mano.
export const PRESUPUESTO = {
  entradaJs: 490 * 1024,
  entradaJsGzip: 170 * 1024,
  sprite: 450 * 1024,
  tarjetaSocial: 150 * 1024,
  dist: 1725 * 1024,
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
