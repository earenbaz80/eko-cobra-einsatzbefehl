/**
 * Entrega y pesos: el JS de entrada, el sprite y la tarjeta social no deben
 * engordar sin que nadie lo note. En local se leen de `dist/`; en remoto se
 * descargan de la URL publicada, donde además se comprueban Content-Type y caché.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { exigirCache, exigirTipo, fail, kb } from '../informe.mjs';
import { listarArchivos, pesoDirectorio } from '../archivos.mjs';
import { assetsHuerfanos, esFuenteDeReferencias } from '../referencias.mjs';
import { leerMarca, coincideMarca } from '../marca.mjs';
import { BASE, DIST, ES_REMOTO, PRESUPUESTO, SHA_ESPERADO } from '../config.mjs';

/** Descarga un recurso publicado y lo devuelve, anotando el fallo si no es 200. */
const pedir = async (destino, etiqueta) => {
  const respuesta = await fetch(destino, { headers: { 'cache-control': 'no-cache' } });
  if (respuesta.status !== 200) {
    fail(`${etiqueta}: responde ${respuesta.status} en ${destino}`);
    return null;
  }
  return respuesta;
};

/** Comprueba la URL publicada: entrega (MIME/caché) y los mismos topes de peso. */
async function comprobarPublicado(url) {
  const htmlRemoto = await pedir(url, 'index.html');
  if (htmlRemoto) {
    exigirTipo('index.html', htmlRemoto, ['text/html']);
    exigirCache('index.html', htmlRemoto, 3600);
    const html = await htmlRemoto.text();

    // La marca de build distingue el despliegue nuevo del HTML cacheado anterior.
    const marca = leerMarca(html);
    if (!SHA_ESPERADO) {
      console.log(`marca de build: ${marca ?? 'sin marca'} (sin SHA esperado, no se comprueba)`);
    } else if (!coincideMarca(html, SHA_ESPERADO)) {
      fail(`marca de build: lo publicado es ${marca ?? 'sin marca'} y se esperaba ${SHA_ESPERADO}`);
    } else {
      console.log(`marca de build: ${marca} (este commit)`);
    }

    const entradaSrc = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
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
}

/** Comprueba el build local: mismos topes, leídos de `dist/`. */
function comprobarBuildLocal() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');

  // Si el build no escribe la marca, el paso post-deploy no podría distinguir commits.
  const marca = leerMarca(html);
  if (!marca) fail('marca de build: falta <meta name="eko-build"> en index.html');
  else console.log(`marca de build: ${marca}`);

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

  // Nada publicado debe quedar sin que nadie lo nombre: los restos de escenarios o
  // sprites viejos viajan en cada despliegue y no se echan de menos hasta que pesan.
  const archivos = listarArchivos(DIST);
  const textos = archivos.filter(esFuenteDeReferencias).map((ruta) => readFileSync(join(DIST, ruta), 'utf8'));
  const huerfanos = assetsHuerfanos(archivos, textos);
  if (huerfanos.length) fail(`assets muertos en dist/: ${huerfanos.join(', ')}`);
  else console.log(`assets: ${archivos.length} archivos, todos referenciados`);
}

/** Sección de entrega: elige la fuente de los pesos según el modo. */
export async function comprobarEntrega({ url }) {
  if (ES_REMOTO) await comprobarPublicado(url);
  else comprobarBuildLocal();
}
