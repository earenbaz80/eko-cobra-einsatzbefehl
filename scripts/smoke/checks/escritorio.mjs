/**
 * Escritorio: la página carga, la Misión 1 arranca, el canvas pinta una escena
 * de verdad y el enlace compartido (metadatos, manifest, iconos y favicon) está
 * completo. Una ruta de assets rota aquí no rompe el juego, pero deja el enlace
 * sin imagen o el juego sin poder instalarse, y nadie se enteraría.
 */
import { exigirTipo, fail } from '../informe.mjs';
import { imageSize } from '../archivos.mjs';
import { BASE, ES_REMOTO } from '../config.mjs';
import { estadisticasCanvas } from '../canvas.mjs';
import { pulsarConAzarSembrado } from '../navegador.mjs';
import { comprobarTransiciones } from './transiciones.mjs';

/** Carga la página, arranca la misión y mide el canvas. */
async function comprobarPartida(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  const mision = page.getByRole('button', { name: 'Misión 1: Piso Graz - Lend' });
  await mision.waitFor({ timeout: 15000 });
  await pulsarConAzarSembrado(mision);

  // El HUD en partida solo existe con la simulación arrancada.
  await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500); // deja cargar sprites y pintar varios frames

  // El canvas puede tener píxeles del menú o de una escena a medio cargar sin que
  // la misión sea jugable. Antes de medir píxeles, afirmamos el estado real del motor.
  const estado = await page.evaluate(() => window.__eko?.snapshot() ?? null);
  if (!estado) {
    fail('estado: window.__eko no publica snapshot en Misión 1');
    return;
  }
  if (estado.gameState !== 'PLAYING' || !estado.player) {
    fail(`estado: Misión 1 no está jugable (${estado.gameState})`);
    return;
  }
  if (!Number.isFinite(estado.player.x) || !Number.isFinite(estado.player.y)) {
    fail(`estado: posición inválida del jugador (${estado.player.x}, ${estado.player.y})`);
    return;
  }
  if (!estado.world.walls.length || !estado.world.doors.some((puerta) => puerta.id === 'DOOR_MAIN_A')) {
    fail('estado: el mundo de Misión 1 no está cargado (sin paredes o sin DOOR_MAIN_A)');
    return;
  }

  const canvas = await estadisticasCanvas(page);
  if (!canvas || canvas.error) {
    fail(`canvas: ${canvas ? canvas.error : 'no existe'}`);
    return;
  }
  if (canvas.width < 320 || canvas.height < 240) fail(`canvas con tamaño raro: ${canvas.width}x${canvas.height}`);
  if (canvas.tonos < 8) fail(`canvas prácticamente liso (${canvas.tonos} tonos): posible pantalla en blanco`);
  const proporcion = canvas.visibles / canvas.muestras;
  if (proporcion < 0.05) fail(`canvas casi negro: solo ${(proporcion * 100).toFixed(1)} % de píxeles visibles`);
  console.log(
    `canvas ${canvas.width}x${canvas.height}: ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(1)} % de píxeles visibles`
  );

  // También en el perfil completo: pausa, reanudación y vuelta al título.
  await comprobarTransiciones(page);
}

/**
 * Pide la tarjeta social al servidor del humo. En local `dist/` se sirve en la raíz, pero
 * los metadatos apuntan a la URL publicada (con el base de Pages delante): si la ruta
 * directa da 404, se reintenta sin el primer segmento para comprobar la misma tarjeta
 * contra el build local. En remoto no hay reintento: el base tiene que estar bien.
 */
async function pedirTarjeta(origin, ruta) {
  const respuesta = await fetch(`${origin}${ruta}`);
  if (respuesta.status === 200 || ES_REMOTO) return respuesta;
  const sinPrimerSegmento = ruta.replace(/^\/[^/]+\//, '/');
  if (sinPrimerSegmento === ruta) return respuesta;
  return fetch(`${origin}${sinPrimerSegmento}`);
}

/** canonical + og:image/twitter:image, y que la tarjeta responda a 1200×630. */
async function comprobarMetadatosSociales(page, { origin }) {
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
      const respuesta = await pedirTarjeta(origin, ruta);
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
}

/** Manifest (pantalla completa, 192, 512 y maskable) e iconos que existen y miden lo que declaran. */
async function comprobarManifestEIconos({ origin }) {
  const manifestUrl = `${origin}${BASE}manifest.webmanifest`;
  const respuestaManifest = await fetch(manifestUrl);
  if (respuestaManifest.status !== 200) {
    fail(`manifest: responde ${respuestaManifest.status} en ${BASE}manifest.webmanifest`);
    return;
  }

  if (ES_REMOTO) exigirTipo('manifest', respuestaManifest, ['application/manifest+json', 'application/json']);
  let manifest = null;
  try {
    manifest = await respuestaManifest.json();
  } catch {
    fail('manifest: no es JSON válido');
  }
  if (!manifest) return;

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

/** Sin favicon.ico válido el navegador pide /favicon.ico, recibe 404 y ensucia la consola. */
async function comprobarFavicon({ origin }) {
  const favicon = await fetch(`${origin}${BASE}favicon.ico`);
  if (favicon.status !== 200) {
    fail(`favicon.ico: responde ${favicon.status}`);
    return;
  }
  if (ES_REMOTO) exigirTipo('favicon.ico', favicon, ['image/x-icon', 'image/vnd.microsoft.icon']);
  const bytes = Buffer.from(await favicon.arrayBuffer());
  if (bytes.length < 22 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) {
    fail('favicon.ico: no es un ICO válido');
  } else console.log(`favicon.ico -> ${bytes.readUInt16LE(4)} tamaños`);
}

/** Sección de escritorio completa. */
export async function comprobarEscritorio(page, contexto) {
  await comprobarPartida(page, contexto.url);
  await comprobarMetadatosSociales(page, contexto);
  await comprobarManifestEIconos(contexto);
  await comprobarFavicon(contexto);
}
