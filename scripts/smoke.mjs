/**
 * Prueba de humo en navegador para el build de GitHub Pages.
 *
 * Sirve dist/ bajo el mismo base que usa Pages, abre la página con Chromium y comprueba:
 *   1. que el canvas se ha renderizado (no está en blanco),
 *   2. que ninguna petición del propio sitio devuelve 404/5xx,
 *   3. que la Misión 1 arranca y muestra el HUD en juego.
 *
 * Uso: VITE_BASE_PATH=/eko-cobra-einsatzbefehl/ npm run build && npm run smoke
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const RAW_BASE = process.env.VITE_BASE_PATH ?? '/';
const CLEAN_BASE = RAW_BASE.replace(/^\/+|\/+$/g, '');
const BASE = CLEAN_BASE ? `/${CLEAN_BASE}/` : '/';
const DIST = resolve(process.cwd(), 'dist');

const CONTENT_TYPES = {
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

/** Ancho y alto de un PNG o JPEG a partir de sus cabeceras. */
const imageSize = (buffer) => {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), tipo: 'png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marcador = buffer[offset + 1];
      if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), tipo: 'jpeg' };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
};

const failures = [];
const fail = (mensaje) => failures.push(mensaje);

if (!existsSync(DIST)) {
  console.error('No existe dist/. Compila antes: VITE_BASE_PATH=... npm run build');
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('fuera del base');
  }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const abs = normalize(join(DIST, rel));
  if (!abs.startsWith(DIST + sep) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('no encontrado');
  }
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(abs).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}${BASE}`;
console.log(`sirviendo dist/ en ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const badRequests = [];
const consoleErrors = [];
page.on('response', (response) => {
  const target = response.url();
  if (!target.startsWith(origin)) return; // las fuentes de Google no son parte del build
  if (target.endsWith('/favicon.ico')) return;
  if (response.status() >= 400) badRequests.push(`${response.status()} ${target}`);
});
page.on('requestfailed', (request) => {
  if (request.url().startsWith(origin)) badRequests.push(`FALLO ${request.url()} (${request.failure()?.errorText})`);
});
page.on('pageerror', (error) => consoleErrors.push(`excepción: ${error.message}`));
page.on('console', (message) => {
  // El favicon lo pide el navegador por su cuenta y no forma parte del build.
  if (message.type() === 'error' && !/favicon/i.test(message.text())) consoleErrors.push(message.text());
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  const mision = page.getByRole('button', { name: 'Misión 1: Piso Graz - Lend' });
  await mision.waitFor({ timeout: 15000 });
  await mision.click();

  // El HUD en partida solo existe con la simulación arrancada.
  await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500); // deja cargar sprites y pintar varios frames

  const canvas = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    if (!el) return null;
    const ctx = el.getContext('2d');
    if (!ctx) return { error: 'sin contexto 2d' };
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    const tonos = new Set();
    let visibles = 0;
    let muestras = 0;
    for (let i = 0; i < data.length; i += 4 * 13) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      tonos.add(`${r >> 4},${g >> 4},${b >> 4}`);
      if (r + g + b > 30) visibles++;
      muestras++;
    }
    return { width: el.width, height: el.height, tonos: tonos.size, visibles, muestras };
  });

  if (!canvas || canvas.error) {
    fail(`canvas: ${canvas ? canvas.error : 'no existe'}`);
  } else {
    if (canvas.width < 320 || canvas.height < 240) fail(`canvas con tamaño raro: ${canvas.width}x${canvas.height}`);
    if (canvas.tonos < 8) fail(`canvas prácticamente liso (${canvas.tonos} tonos): posible pantalla en blanco`);
    const proporcion = canvas.visibles / canvas.muestras;
    if (proporcion < 0.05) fail(`canvas casi negro: solo ${(proporcion * 100).toFixed(1)} % de píxeles visibles`);
    console.log(
      `canvas ${canvas.width}x${canvas.height}: ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(1)} % de píxeles visibles`
    );
  }
  // --- Metadatos sociales: una ruta de assets rota aquí no rompe el juego, pero
  // deja el enlace compartido sin imagen y nadie se enteraría.
  const social = await page.evaluate(() => {
    const contenido = (selector) => document.querySelector(selector)?.getAttribute('content') ?? null;
    return {
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      ogImage: contenido('meta[property="og:image"]'),
      ogImageWidth: contenido('meta[property="og:image:width"]'),
      ogImageHeight: contenido('meta[property="og:image:height"]'),
      twitterImage: contenido('meta[name="twitter:image"]'),
    };
  });

  const esAbsoluta = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
  if (!social.canonical) fail('metadatos: falta <link rel="canonical">');
  else if (!esAbsoluta(social.canonical)) fail(`metadatos: canonical no es una URL absoluta (${social.canonical})`);

  if (social.ogImageWidth && social.ogImageWidth !== '1200') fail(`metadatos: og:image:width es ${social.ogImageWidth}, se esperaba 1200`);
  if (social.ogImageHeight && social.ogImageHeight !== '630') fail(`metadatos: og:image:height es ${social.ogImageHeight}, se esperaba 630`);

  const revisadas = new Map();
  for (const [nombre, valor] of [
    ['og:image', social.ogImage],
    ['twitter:image', social.twitterImage],
  ]) {
    if (!valor) {
      fail(`metadatos: falta ${nombre}`);
      continue;
    }
    if (!esAbsoluta(valor)) {
      fail(`metadatos: ${nombre} no es una URL absoluta (${valor})`);
      continue;
    }
    const ruta = new URL(valor).pathname;
    if (!ruta.startsWith(BASE)) {
      fail(`metadatos: ${nombre} apunta fuera del base (${ruta}, base ${BASE})`);
      continue;
    }
    if (!revisadas.has(ruta)) {
      const respuesta = await fetch(`${origin}${ruta}`);
      if (respuesta.status !== 200) {
        revisadas.set(ruta, `responde ${respuesta.status}`);
      } else {
        const tipo = respuesta.headers.get('content-type') ?? '';
        const medidas = imageSize(Buffer.from(await respuesta.arrayBuffer()));
        if (!/^image\//.test(tipo)) revisadas.set(ruta, `no es una imagen (${tipo})`);
        else if (!medidas) revisadas.set(ruta, 'no se pudo leer el tamaño');
        else if (medidas.width !== 1200 || medidas.height !== 630) {
          revisadas.set(ruta, `mide ${medidas.width}x${medidas.height}, se esperaba 1200x630`);
        } else revisadas.set(ruta, null);
      }
    }
    const problema = revisadas.get(ruta);
    if (problema) fail(`metadatos: ${nombre} -> ${ruta} ${problema}`);
    else if (nombre === 'og:image') console.log(`${nombre} -> ${ruta} (200, 1200x630)`);
  }
} catch (error) {
  fail(`navegación/interacción: ${error.message}`);
} finally {
  if (badRequests.length) fail(`peticiones fallidas (${badRequests.length}):\n  ${badRequests.slice(0, 10).join('\n  ')}`);
  if (consoleErrors.length) fail(`errores en consola (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 10).join('\n  ')}`);
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n✗ Prueba de humo fallida:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n✓ Prueba de humo correcta: canvas pintado, sin 404 y Misión 1 en marcha.');
