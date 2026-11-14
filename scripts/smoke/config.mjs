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
 * Presupuesto de frames: tope del p95 del delta entre frames (ms). Medido en local da
 * 33,4 ms en escritorio y 33,5 ms en móvil emulado, con la Misión 1 y el Laboratorio;
 * los topes dejan aire para un runner más lento sin tapar un juego a 30 fps fijos.
 */
export const PRESUPUESTO_FRAMES = {
  escritorio: 40,
  movil: 55,
};

/** Commit que debe estar sirviendo Pages; el job de deploy lo pasa en SMOKE_EXPECTED_SHA. */
export const SHA_ESPERADO = (process.env.SMOKE_EXPECTED_SHA ?? '').trim().toLowerCase();

// Topes de peso: un asset de varios MB o un salto del bundle no debería pasar el CI.
// Los valores salen de lo que ocupa hoy el build con ~3 % de margen (JS 475 KiB,
// dist 1654 KiB): ajustados a propósito para que el tope avise antes de una subida
// real, no solo de un desastre. Si un asset nuevo es legítimo, se sube aquí a mano.
export const PRESUPUESTO = {
  entradaJs: 490 * 1024,
  entradaJsGzip: 170 * 1024,
  sprite: 450 * 1024,
  tarjetaSocial: 150 * 1024,
  dist: 1700 * 1024,
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
