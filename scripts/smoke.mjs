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
 * Uso local (lo que corre el CI): VITE_BASE_PATH=/eko-cobra-einsatzbefehl/ npm run build && npm run smoke
 * Uso contra lo publicado:        npm run smoke:prod   (o `node scripts/smoke.mjs <url>`)
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

// Modo remoto opcional: `npm run smoke:prod` o `node scripts/smoke.mjs <url>`.
// Ahí no se sirve dist/: se comprueba lo que hay publicado, que es donde se ven un
// base mal puesto, un Content-Type raro o una caché que oculta el último despliegue.
const URL_REMOTA = (
  process.argv.slice(2).find((arg) => /^https?:\/\//i.test(arg)) ??
  process.env.SMOKE_URL ??
  ''
).trim();
const ES_REMOTO = URL_REMOTA.length > 0;
const RAW_BASE = ES_REMOTO ? new URL(URL_REMOTA).pathname : process.env.VITE_BASE_PATH ?? '/';
const CLEAN_BASE = RAW_BASE.replace(/^\/+|\/+$/g, '');
const BASE = CLEAN_BASE ? `/${CLEAN_BASE}/` : '/';
const DIST = resolve(process.cwd(), 'dist');

// Topes de peso: un asset de varios MB o un salto del bundle no debería pasar el CI.
// Los valores salen de lo que ocupa hoy el build, con ~20 % de margen.
const PRESUPUESTO = {
  entradaJs: 600 * 1024,
  entradaJsGzip: 170 * 1024,
  sprite: 450 * 1024,
  tarjetaSocial: 150 * 1024,
  dist: 2.6 * 1024 * 1024,
};

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

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Content-Type sin charset y en minúsculas ("application/javascript; charset=utf-8"). */
const tipoDe = (respuesta) => (respuesta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

const exigirTipo = (etiqueta, respuesta, esperados) => {
  const cabecera = respuesta.headers.get('content-type') ?? '';
  if (!esperados.includes(tipoDe(respuesta))) {
    fail(`${etiqueta}: Content-Type ${cabecera || '(ninguno)'}, se esperaba ${esperados.join(' o ')}`);
  } else console.log(`${etiqueta}: ${tipoDe(respuesta)}`);
};

const exigirCache = (etiqueta, respuesta, maximoSegundos) => {
  const cache = respuesta.headers.get('cache-control') ?? '';
  const maxAge = Number(cache.match(/max-age=(\d+)/)?.[1] ?? NaN);
  if (!cache) fail(`${etiqueta}: no envía Cache-Control`);
  else if (/immutable/i.test(cache)) fail(`${etiqueta}: Cache-Control ${cache} dejaría el próximo despliegue sin verse hasta caducar`);
  else if (Number.isFinite(maxAge) && maxAge > maximoSegundos) fail(`${etiqueta}: Cache-Control ${cache} caduca en más de ${maximoSegundos}s`);
  else console.log(`caché ${etiqueta}: ${cache}`);
};

/** Suma recursiva del tamaño de dist/, para vigilar el peso total publicado. */
const pesoDirectorio = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((total, entrada) => {
    const ruta = join(dir, entrada.name);
    return total + (entrada.isDirectory() ? pesoDirectorio(ruta) : statSync(ruta).size);
  }, 0);

/** Firma de 32x32 luminancias del canvas: sirve para ver si la escena se mueve. */
const firmaCanvas = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return null;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    const celdas = 32;
    const firma = [];
    for (let cy = 0; cy < celdas; cy += 1) {
      for (let cx = 0; cx < celdas; cx += 1) {
        const x = Math.floor(((cx + 0.5) / celdas) * el.width);
        const y = Math.floor(((cy + 0.5) / celdas) * el.height);
        const i = (y * el.width + x) * 4;
        firma.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
    }
    return firma;
  });

/** Porcentaje de celdas cuya luminancia cambia más de `umbral` niveles. */
const cambioEntreFirmas = (a, b, umbral = 12) => {
  if (!a || !b || a.length !== b.length) return 1;
  let distintas = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > umbral) distintas += 1;
  return distintas / a.length;
};

if (!ES_REMOTO && !existsSync(DIST)) {
  console.error('No existe dist/. Compila antes: VITE_BASE_PATH=... npm run build');
  process.exit(1);
}

const server = ES_REMOTO ? null : createServer((req, res) => {
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

if (server) await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = server ? `http://127.0.0.1:${server.address().port}` : new URL(URL_REMOTA).origin;
const url = `${origin}${BASE}`;
console.log(ES_REMOTO ? `comprobando lo publicado en ${url}` : `sirviendo dist/ en ${url}`);

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
  // --- Pesos: en local salen de dist/; en remoto se descargan de la URL publicada,
  // que es donde se ven el base, los Content-Type y la caché real de Pages.
  if (ES_REMOTO) {
    const pedir = async (destino, etiqueta) => {
      const respuesta = await fetch(destino, { headers: { 'cache-control': 'no-cache' } });
      if (respuesta.status !== 200) {
        fail(`${etiqueta}: responde ${respuesta.status} en ${destino}`);
        return null;
      }
      return respuesta;
    };

    const htmlRemoto = await pedir(url, 'index.html');
    if (htmlRemoto) {
      exigirTipo('index.html', htmlRemoto, ['text/html']);
      exigirCache('index.html', htmlRemoto, 3600);
      const entradaSrc = (await htmlRemoto.text()).match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
      if (!entradaSrc) {
        fail('pesos: no se encuentra el JS de entrada en index.html');
      } else {
        const entrada = await pedir(new URL(entradaSrc, url).href, 'JS de entrada');
        if (entrada) {
          exigirTipo('JS de entrada', entrada, ['application/javascript', 'text/javascript']);
          exigirCache('JS de entrada', entrada, 3600);
          const crudo = Buffer.from(await entrada.arrayBuffer());
          const gzip = gzipSync(crudo, { level: 6 }).length;
          if (crudo.length > PRESUPUESTO.entradaJs) fail(`pesos: el JS de entrada ocupa ${kb(crudo.length)} (tope ${kb(PRESUPUESTO.entradaJs)})`);
          if (gzip > PRESUPUESTO.entradaJsGzip) fail(`pesos: el JS de entrada pesa ${kb(gzip)} comprimido (tope ${kb(PRESUPUESTO.entradaJsGzip)})`);
          console.log(`JS de entrada: ${kb(crudo.length)} (${kb(gzip)} gzip)`);
        }
      }
    }

    for (const [etiqueta, relativa, tipo, tope] of [
      ['sprite', 'assets/aistudio/operador-8dir.webp', 'image/webp', PRESUPUESTO.sprite],
      ['tarjeta social', 'social-card.jpg', 'image/jpeg', PRESUPUESTO.tarjetaSocial],
    ]) {
      const respuesta = await pedir(new URL(relativa, url).href, etiqueta);
      if (!respuesta) continue;
      exigirTipo(etiqueta, respuesta, [tipo]);
      exigirCache(etiqueta, respuesta, 3600);
      const peso = Buffer.from(await respuesta.arrayBuffer()).length;
      if (peso > tope) fail(`pesos: la ${etiqueta} ocupa ${kb(peso)} (tope ${kb(tope)})`);
      else console.log(`${etiqueta}: ${kb(peso)}`);
    }
    console.log('dist total: no aplica en modo remoto');
  } else {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const entradaSrc = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
    if (!entradaSrc) {
      fail('pesos: no se encuentra el JS de entrada en index.html');
    } else {
      const entrada = join(DIST, entradaSrc.replace(BASE, ''));
      if (!existsSync(entrada)) {
        fail(`pesos: no existe el JS de entrada (${entradaSrc})`);
      } else {
        const crudo = statSync(entrada).size;
        const gzip = gzipSync(readFileSync(entrada), { level: 6 }).length;
        if (crudo > PRESUPUESTO.entradaJs) fail(`pesos: el JS de entrada ocupa ${kb(crudo)} (tope ${kb(PRESUPUESTO.entradaJs)})`);
        if (gzip > PRESUPUESTO.entradaJsGzip) fail(`pesos: el JS de entrada pesa ${kb(gzip)} comprimido (tope ${kb(PRESUPUESTO.entradaJsGzip)})`);
        console.log(`JS de entrada: ${kb(crudo)} (${kb(gzip)} gzip)`);
      }
    }

    const sprite = join(DIST, 'assets', 'aistudio', 'operador-8dir.webp');
    if (!existsSync(sprite)) {
      fail('pesos: falta el sprite del operador (operador-8dir.webp)');
    } else {
      const peso = statSync(sprite).size;
      if (peso > PRESUPUESTO.sprite) fail(`pesos: el sprite ocupa ${kb(peso)} (tope ${kb(PRESUPUESTO.sprite)})`);
      else console.log(`sprite: ${kb(peso)}`);
    }

    const tarjeta = join(DIST, 'social-card.jpg');
    if (!existsSync(tarjeta)) {
      fail('pesos: falta social-card.jpg');
    } else {
      const peso = statSync(tarjeta).size;
      if (peso > PRESUPUESTO.tarjetaSocial) fail(`pesos: la tarjeta social ocupa ${kb(peso)} (tope ${kb(PRESUPUESTO.tarjetaSocial)})`);
      else console.log(`tarjeta social: ${kb(peso)}`);
    }

    const totalDist = pesoDirectorio(DIST);
    if (totalDist > PRESUPUESTO.dist) fail(`pesos: dist/ ocupa ${kb(totalDist)} (tope ${kb(PRESUPUESTO.dist)})`);
    else console.log(`dist total: ${kb(totalDist)} (tope ${kb(PRESUPUESTO.dist)})`);
  }

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
  // --- Iconos y manifest: sin ellos el navegador pide /favicon.ico, recibe 404 y
  // el juego deja de poder instalarse en pantalla completa.
  const manifestUrl = `${origin}${BASE}manifest.webmanifest`;
  const respuestaManifest = await fetch(manifestUrl);
  if (respuestaManifest.status !== 200) {
    fail(`manifest: responde ${respuestaManifest.status} en ${BASE}manifest.webmanifest`);
  } else {
    if (ES_REMOTO) exigirTipo('manifest', respuestaManifest, ['application/manifest+json', 'application/json']);
    let manifest = null;
    try {
      manifest = await respuestaManifest.json();
    } catch {
      fail('manifest: no es JSON válido');
    }
    if (manifest) {
      const displays = [manifest.display, ...(Array.isArray(manifest.display_override) ? manifest.display_override : [])];
      if (!displays.includes('fullscreen') && !displays.includes('standalone')) {
        fail(`manifest: display ${JSON.stringify(manifest.display)} no permite pantalla completa`);
      }
      const iconos = Array.isArray(manifest.icons) ? manifest.icons : [];
      const grandes = iconos.filter((icono) => icono.sizes === '512x512');
      if (!iconos.some((icono) => icono.sizes === '192x192')) fail('manifest: falta un icono de 192×192');
      if (!grandes.length) fail('manifest: falta un icono de 512×512');
      if (!iconos.some((icono) => icono.purpose === 'maskable')) fail('manifest: falta un icono maskable');
      for (const icono of iconos) {
        const ruta = new URL(icono.src, manifestUrl).pathname;
        const respuesta = await fetch(`${origin}${ruta}`);
        if (respuesta.status !== 200) {
          fail(`manifest: ${icono.src} responde ${respuesta.status}`);
          continue;
        }
        if (ES_REMOTO) exigirTipo(`manifest ${icono.src}`, respuesta, ['image/png']);
        const medidas = imageSize(Buffer.from(await respuesta.arrayBuffer()));
        if (!medidas) fail(`manifest: ${icono.src} no es una imagen legible`);
        else if (`${medidas.width}x${medidas.height}` !== icono.sizes) {
          fail(`manifest: ${icono.src} mide ${medidas.width}x${medidas.height}, declara ${icono.sizes}`);
        }
      }
      console.log(`manifest -> ${manifest.display}, ${iconos.length} iconos`);
    }
  }

  const favicon = await fetch(`${origin}${BASE}favicon.ico`);
  if (favicon.status !== 200) fail(`favicon.ico: responde ${favicon.status}`);
  else {
    if (ES_REMOTO) exigirTipo('favicon.ico', favicon, ['image/x-icon', 'image/vnd.microsoft.icon']);
    const bytes = Buffer.from(await favicon.arrayBuffer());
    if (bytes.length < 22 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) {
      fail('favicon.ico: no es un ICO válido');
    } else console.log(`favicon.ico -> ${bytes.readUInt16LE(4)} tamaños`);
  }

  // --- Móvil: los controles táctiles solo existen con hasTouch, y que el joystick
  // pinte no significa que mueva al operador: se comprueba contra el canvas.
  const contextoMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  // Instrumenta el AudioContext: así se puede comprobar que el primer gesto lo deja
  // sonando (en iOS/Android nace suspendido y solo un toque lo reanuda).
  await contextoMovil.addInitScript(() => {
    const Original = window.AudioContext;
    if (!Original) return;
    window.__ekoAudio = [];
    window.__ekoResumes = 0;
    const resumeOriginal = Original.prototype.resume;
    Original.prototype.resume = function (...args) {
      window.__ekoResumes += 1;
      return resumeOriginal.apply(this, args);
    };
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        window.__ekoAudio.push(this);
      }
    };
  });
  const movil = await contextoMovil.newPage();
  movil.on('response', (response) => {
    const target = response.url();
    if (!target.startsWith(origin) || target.endsWith('/favicon.ico')) return;
    if (response.status() >= 400) badRequests.push(`móvil ${response.status()} ${target}`);
  });
  movil.on('pageerror', (error) => consoleErrors.push(`móvil excepción: ${error.message}`));
  movil.on('console', (message) => {
    if (message.type() === 'error' && !/favicon/i.test(message.text())) consoleErrors.push(`móvil ${message.text()}`);
  });

  // La pestaña móvil tiene que estar en primer plano: si el navegador la considera
  // oculta, rAF se estrangula y los fotogramas saltan (ruido enorme al comparar).
  await movil.bringToFront();
  await movil.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await movil.waitForSelector('canvas', { timeout: 20000 });

  // Audio: se fuerza el estado real de un móvil (contexto suspendido) y se toca la
  // pantalla; ese primer contacto tiene que dejarlo en running.
  const audioAntes = await movil.evaluate(async () => {
    const contextos = window.__ekoAudio ?? [];
    for (const contexto of contextos) await contexto.suspend().catch(() => {});
    return contextos.map((contexto) => contexto.state);
  });
  await movil.touchscreen.tap(195, 120);
  await movil.waitForTimeout(500);
  const audioDespues = await movil.evaluate(() => ({
    estados: (window.__ekoAudio ?? []).map((contexto) => contexto.state),
    resumes: window.__ekoResumes ?? 0,
  }));
  if (!audioDespues.estados.length) {
    fail('audio: el primer toque no creó ningún AudioContext');
  } else if (audioDespues.estados.some((estado) => estado !== 'running')) {
    fail(`audio: tras el primer toque el AudioContext sigue en ${audioDespues.estados.join('/')}`);
  } else {
    console.log(`audio: ${audioAntes[0] ?? 'sin contexto'} -> running tras el primer toque (${audioDespues.resumes} resume)`);
  }

  await movil.getByRole('button', { name: 'Misión 1: Piso Graz - Lend' }).click();
  await movil.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  await movil.waitForTimeout(1800);

  const joystick = movil.getByLabel('Joystick de movimiento');
  if (!(await joystick.isVisible())) fail('móvil: el joystick no aparece con hasTouch');
  if (!(await movil.getByLabel('Disparar').isVisible())) fail('móvil: falta el botón de fuego con hasTouch');

  // Posición del pomo en píxeles, leída de la matriz ya resuelta (-50 % incluido).
  const leerPalanca = () =>
    movil.evaluate(() => {
      const base = document.querySelector('[aria-label="Joystick de movimiento"]');
      const knob = base ? [...base.querySelectorAll('div')].find((el) => (el.style.transform ?? '').includes('translate(calc(')) : null;
      if (!knob) return null;
      const matriz = getComputedStyle(knob).transform.match(/matrix\(([^)]+)\)/);
      if (!matriz) return null;
      const valores = matriz[1].split(',').map(Number);
      return { x: Math.round(valores[4]), y: Math.round(valores[5]) };
    });
  const distanciaAPomo = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);

  const caja = await joystick.boundingBox();
  if (!caja) {
    fail('móvil: el joystick no tiene área pulsable');
  } else {
    const centroX = caja.x + caja.width / 2;
    const centroY = caja.y + caja.height / 2;
    const reposo = await leerPalanca();

    // La palanca tiene que seguir al dedo (captura de puntero), no quedarse quieta.
    await movil.mouse.move(centroX, centroY);
    await movil.mouse.down();
    await movil.mouse.move(centroX, centroY - 70, { steps: 6 });
    const arrastrada = await leerPalanca();
    await movil.mouse.up();
    const recorrido = distanciaAPomo(arrastrada, reposo);
    if (recorrido < 20) fail(`móvil: la palanca no responde al arrastre (recorrido ${recorrido.toFixed(0)} px)`);
    await movil.waitForTimeout(400);
    const suelta = await leerPalanca();
    if (distanciaAPomo(suelta, reposo) > 1) fail(`móvil: la palanca no vuelve al centro al soltar (${JSON.stringify(suelta)})`);

    // Los primeros segundos de misión todavía tienen la entrada de la cámara y a K2
    // moviéndose: dejamos que asiente antes de medir el ruido de fondo.
    await movil.waitForTimeout(3000);

    // Ruido de fondo de la escena quieta (flicker de linterna, partículas).
    const quietoA = await firmaCanvas(movil);
    await movil.waitForTimeout(1200);
    const quietoB = await firmaCanvas(movil);
    const ruido = cambioEntreFirmas(quietoA, quietoB);

    // Empujamos, soltamos y esperamos a que se pare. Comparar dos fotogramas quietos
    // evita confundir la animación con el desplazamiento: si se ha movido, la escena
    // bajo la cámara es otra. Se prueban dos sentidos por si uno choca con una pared.
    const empujar = async (desplazamiento) => {
      await movil.mouse.move(centroX, centroY);
      await movil.mouse.down();
      await movil.mouse.move(centroX, centroY + desplazamiento, { steps: 6 });
      await movil.waitForTimeout(900);
      await movil.mouse.up();
      await movil.waitForTimeout(600);
    };
    await empujar(-70);
    const trasArriba = await firmaCanvas(movil);
    await empujar(70);
    const trasAbajo = await firmaCanvas(movil);
    const movimiento = Math.max(cambioEntreFirmas(quietoB, trasArriba), cambioEntreFirmas(trasArriba, trasAbajo));

    if (movimiento < 0.15 || movimiento < ruido * 4) {
      fail(
        `móvil: el joystick no mueve al operador (desplazamiento ${(movimiento * 100).toFixed(1)} %, ruido en reposo ${(ruido * 100).toFixed(1)} %)`
      );
    } else {
      console.log(
        `móvil: joystick OK, la escena cambia un ${(movimiento * 100).toFixed(0)} % tras moverse (${(ruido * 100).toFixed(0)} % en reposo)`
      );
    }
  }

  // --- Franjas del HUD: joystick, botones, subtítulos y barra inferior no se pisan.
  try {
    await movil.waitForFunction(
      () => [...document.querySelectorAll('div')].some((el) => (el.className || '').includes('radio-subtitles')),
      null,
      { timeout: 12000 }
    );
  } catch {
    // Sin mensaje de radio no hay subtítulo que medir; los controles se comprueban igual.
  }

  const comprobarFranjas = async (etiqueta) => {
    const cajas = await movil.evaluate(() => {
      const caja = (el) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), bottom: Math.round(b.bottom) };
      };
      const footer = [...document.querySelectorAll('div')].find((el) => (el.className || '').includes('flex-row flex-wrap'));
      const joystick = document.querySelector('[aria-label="Joystick de movimiento"]');
      const disparar = document.querySelector('[aria-label="Disparar"]');
      const subtitulos = [...document.querySelectorAll('div')].find((el) => (el.className || '').includes('radio-subtitles'));
      const hijosCortados = footer
        ? [...footer.children].filter((hijo) => {
            const b = hijo.getBoundingClientRect();
            return b.width > 0 && b.right > footer.getBoundingClientRect().right + 1;
          }).length
        : 0;
      return {
        footer: footer ? caja(footer) : null,
        joystick: joystick ? caja(joystick) : null,
        acciones: disparar?.parentElement ? caja(disparar.parentElement) : null,
        subtitulos: subtitulos ? caja(subtitulos) : null,
        hijosCortados,
        stack: getComputedStyle(document.documentElement).getPropertyValue('--eko-hud-stack-h').trim(),
      };
    });
    const solapa = (a, b) => Boolean(a && b && !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y));
    const pisados = [
      solapa(cajas.joystick, cajas.acciones) && 'joystick/botones',
      solapa(cajas.joystick, cajas.footer) && 'joystick/HUD',
      solapa(cajas.acciones, cajas.footer) && 'botones/HUD',
      solapa(cajas.subtitulos, cajas.joystick) && 'subtítulos/joystick',
      solapa(cajas.subtitulos, cajas.acciones) && 'subtítulos/botones',
      solapa(cajas.subtitulos, cajas.footer) && 'subtítulos/HUD',
    ].filter(Boolean);
    if (pisados.length) fail(`${etiqueta}: se pisan ${pisados.join(', ')} (${JSON.stringify(cajas)})`);
    if (cajas.hijosCortados > 0) fail(`${etiqueta}: la barra inferior corta ${cajas.hijosCortados} bloque(s) por la derecha`);
    if (!pisados.length && cajas.hijosCortados === 0) {
      console.log(`${etiqueta}: sin solapes (HUD ${cajas.stack}, subtítulos ${cajas.subtitulos ? 'medidos' : 'sin mensaje'})`);
    }
  };

  // El viewport vertical de partida, y luego dos anchos donde la barra envuelve distinto.
  await comprobarFranjas('móvil 390x844');
  for (const [ancho, alto] of [
    [320, 568],
    [360, 640],
  ]) {
    await movil.setViewportSize({ width: ancho, height: alto });
    await movil.waitForTimeout(600);
    await comprobarFranjas(`móvil ${ancho}x${alto}`);
  }

  await contextoMovil.close();
} catch (error) {
  fail(`navegación/interacción: ${error.message}`);
} finally {
  if (badRequests.length) fail(`peticiones fallidas (${badRequests.length}):\n  ${badRequests.slice(0, 10).join('\n  ')}`);
  if (consoleErrors.length) fail(`errores en consola (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 10).join('\n  ')}`);
  await browser.close();
  server?.close();
}

if (failures.length) {
  console.error(`\n✗ Prueba de humo fallida:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `\n✓ Prueba de humo correcta${ES_REMOTO ? ' (URL publicada)' : ''}: canvas pintado, sin 404, Misión 1 en marcha, móvil con joystick y pesos dentro de tope.`
);
