/**
 * Pase de arte en píxeles, que es el render por defecto: arranca la misión,
 * pinta escena y deja un buffer estable frente a la semilla fija del humo.
 *
 * Es una superficie que ningún otro check abre: si el pase se rompe, el juego
 * sigue pintando con el clásico y el humo pasaría en verde. Aquí se falla si la
 * página lanza excepciones (las recoge `vigilarPagina`), si el canvas queda
 * vacío o si no aparece el marco con el que el pase presenta su buffer 16:9.
 * También se comprueba el opt-out: con `?art=classic` el chunk no se descarga,
 * no hay buffer del pase y el render anterior pinta de borde a borde.
 *
 * Encima de eso va la regresión visual: con el reloj congelado, cada escenario
 * tiene que dar siempre el mismo FNV-1a sobre los píxeles del buffer. Las
 * huellas viven en `scripts/smoke/huellas-arte.json`.
 *
 * Para regenerarlas cuando el arte cambie a propósito:
 *
 *     ART_PROOF_HUELLAS=1 npm run smoke:quick
 *
 * Eso reescribe el archivo con lo medido y pasa la prueba; después se revisa el
 * diff de las huellas y se commitea junto con el cambio de arte.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { estadisticasCanvas } from '../canvas.mjs';
import { arrancarMision } from '../navegador.mjs';
import { fail } from '../informe.mjs';

const ETIQUETA = 'art proof';
const HUELLAS = new URL('../huellas-arte.json', import.meta.url);
const ACTUALIZAR = process.env.ART_PROOF_HUELLAS === '1';

/**
 * Cinco escenarios con huella propia, elegidos por lo que cambian en el arte:
 * salón alpino (madera, chimenea, alfombra), chalet con piso de nieve, andén de
 * estación, estación nocturna y aeropuerto.
 */
const ESCENARIOS = [
  { id: 'graz-salon', mision: 'Misión 1: Piso Graz - Lend', consulta: 'focus=salon' },
  { id: 'tirol', mision: 'Misión 4: Chalet Alpino (Tirol)', consulta: '' },
  { id: 'estacion', mision: 'Misión 2: Estación de Trenes', consulta: '' },
  { id: 'estacion-nocturna', mision: 'Misión 2B: Estación Nocturna', consulta: '' },
  { id: 'schwechat', mision: 'Misión 5: Aeropuerto Wien-Schwechat', consulta: '' },
];

/** URL del escenario; `consulta` puede venir vacía porque el pase es el defecto. */
function urlDelEscenario(url, consulta) {
  return consulta ? `${url}?${consulta}` : url;
}

/**
 * Congela el reloj antes de que arranque la app. El pase lee `performance.now()`
 * para animar y el bucle de simulación saca el dt del timestamp de rAF: con el
 * timestamp fijo el dt es 0, así que actores, cámara y partículas quedan
 * quietos. Sin esto el buffer cambia en cada corrida por un par de frames de
 * diferencia y ninguna huella serviría.
 */
async function congelarTiempo(page) {
  await page.addInitScript(() => {
    const TIEMPO = 1000;
    const rafOriginal = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => rafOriginal(() => callback(TIEMPO));
    performance.now = () => TIEMPO;
  });
}

/**
 * El buffer tiene que quedar libre de fuentes del sistema. Si `drawPixelArtActor`
 * pinta un rótulo con `fillText` (la chapita COBERTURA, el NIVEL IV del dummy,
 * los gestos del binomio), los glifos dependen del navegador y de las fuentes
 * instaladas: la huella dejaría de valer fuera de esta máquina aunque el arte no
 * hubiera cambiado. Se registra cada llamada con el canvas donde cayó, y después
 * sólo cuentan las que fueron al buffer del pase (fuera del DOM y con su tamaño,
 * que se lee del motor): el rótulo de `present` y los rótulos que dibuja el
 * render normal mientras el chunk viaja no entran en el hash.
 */
async function vigilarTextoDelSistema(page) {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const registrados = [];
    CanvasRenderingContext2D.prototype.fillText = function (texto, ...resto) {
      registrados.push({
        texto: String(texto),
        ancho: this.canvas.width,
        alto: this.canvas.height,
        enDom: this.canvas.isConnected,
      });
      return original.call(this, texto, ...resto);
    };
    Object.defineProperty(window, '__arteTextos', { value: registrados, configurable: true });
  });
}

/**
 * El pase vive en su propio chunk: se descarga por defecto y no con
 * `?art=classic`. La huella no lo notaría —hashea el buffer, no la red—, así que
 * un import estático devolvería el canal al JS de entrada en silencio y el aire
 * del tope se evaporaría con el humo en verde.
 */
async function comprobarChunkSeparado(page, url) {
  const pedidosDeArte = () =>
    page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entrada) => entrada.name)
        .filter((nombre) => /artProof/i.test(nombre))
    );

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const porDefecto = await pedidosDeArte();

  const conClasico = new URL(url);
  conClasico.searchParams.set('art', 'classic');
  await page.goto(conClasico.href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const clasico = await pedidosDeArte();

  if (porDefecto.length === 0) {
    fail(`${ETIQUETA}: sin parámetros no se descarga el pase; el render por defecto no es el de píxeles`);
  } else if (clasico.length > 0) {
    fail(
      `${ETIQUETA}: ?art=classic sigue descargando el pase (${clasico.length} recurso/s); el opt-out no libera el chunk`
    );
  } else {
    console.log(`${ETIQUETA} · pase en chunk aparte (${porDefecto.length} recurso, 0 con ?art=classic)`);
  }
}

/**
 * Opt-out: con `?art=classic` no hay buffer del pase y el render anterior pinta
 * de borde a borde (sin las bandas negras que deja la presentación 16:9).
 */
async function comprobarPaseClasico(page, url) {
  const clasica = new URL(url);
  clasica.searchParams.set('art', 'classic');
  try {
    await arrancarMision(page, clasica.href, 'Misión 1: Piso Graz - Lend', {
      asentarMs: 600,
      reiniciarAzar: true,
    });
  } catch (error) {
    fail(`${ETIQUETA} classic: no arranca la misión (${error.message.split('\n')[0]})`);
    return;
  }

  const estado = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const fila = Math.floor(el.height / 2);
    const pintado = (x) => {
      const [r, g, b] = ctx.getImageData(x, fila, 1, 1).data;
      return r + g + b > 0;
    };
    let izquierda = 0;
    while (izquierda < el.width && !pintado(izquierda)) izquierda += 1;
    let derecha = 0;
    while (derecha < el.width && !pintado(el.width - 1 - derecha)) derecha += 1;
    return { hash: window.__eko?.artBufferHash() ?? null, izquierda, derecha };
  });

  if (estado.hash !== null) {
    fail(`${ETIQUETA} classic: el pase de píxeles sigue activo (buffer ${estado.hash})`);
  } else if (estado.izquierda > 2 || estado.derecha > 2) {
    fail(
      `${ETIQUETA} classic: el render anterior deja bandas (${estado.izquierda}/${estado.derecha} px); el pase siguió pintando`
    );
  } else {
    console.log(`${ETIQUETA} · ?art=classic sin pase y a sangre (bandas ${estado.izquierda}/${estado.derecha} px)`);
  }
}

/**
 * El pase dibuja su buffer 16:9 centrado sobre negro. En esta ventana (1280x800)
 * el encaje da 2,00 y sobran 40 px de banda arriba y abajo; en otras
 * proporciones la banda cae a los lados. El render normal pinta de borde a borde
 * y no deja ninguna, así que el marco es la prueba de que el pase de píxeles se aplicó.
 */
async function comprobarMarco(page) {
  const marco = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const fila = Math.floor(el.height / 2);
    const columna = Math.floor(el.width / 2);
    const pintado = (x, y) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return r + g + b > 0;
    };
    let izquierda = 0;
    while (izquierda < el.width && !pintado(izquierda, fila)) izquierda += 1;
    let derecha = 0;
    while (derecha < el.width && !pintado(el.width - 1 - derecha, fila)) derecha += 1;
    let arriba = 0;
    while (arriba < el.height && !pintado(columna, arriba)) arriba += 1;
    let abajo = 0;
    while (abajo < el.height && !pintado(columna, el.height - 1 - abajo)) abajo += 1;
    return { ancho: el.width, alto: el.height, izquierda, derecha, arriba, abajo };
  });

  const anchoArte = marco.ancho - marco.izquierda - marco.derecha;
  const altoArte = marco.alto - marco.arriba - marco.abajo;
  const banda = Math.max(marco.izquierda, marco.derecha, marco.arriba, marco.abajo);
  if (banda < 8 || anchoArte <= 0 || altoArte <= 0) {
    fail(
      `${ETIQUETA}: sin marco del buffer cenital (${marco.izquierda}/${marco.derecha}/${marco.arriba}/${marco.abajo} px): el pase no llegó al canvas`
    );
    return false;
  }
  const centrado =
    Math.abs(marco.izquierda - marco.derecha) <= 2 && Math.abs(marco.arriba - marco.abajo) <= 2;
  const dieciseisNueve = Math.abs(anchoArte / altoArte - 16 / 9) <= 0.02;
  if (!centrado || !dieciseisNueve) {
    fail(
      `${ETIQUETA}: el marco no es 16:9 centrado (${anchoArte}x${altoArte}, márgenes ${marco.izquierda}/${marco.derecha}/${marco.arriba}/${marco.abajo})`
    );
    return false;
  }
  console.log(`${ETIQUETA} · marco ${anchoArte}x${altoArte} con banda ${banda} px`);
  return true;
}

/** Huellas guardadas; un archivo ausente o roto cuenta como sin huellas. */
function leerHuellas() {
  try {
    const { escenarios } = JSON.parse(readFileSync(HUELLAS, 'utf8'));
    return escenarios && typeof escenarios === 'object' ? escenarios : {};
  } catch {
    return {};
  }
}

export async function comprobarArtProof(page, { url }) {
  await congelarTiempo(page);
  await vigilarTextoDelSistema(page);
  await comprobarChunkSeparado(page, url);
  await comprobarPaseClasico(page, url);

  const medidos = {};
  for (const [indice, escenario] of ESCENARIOS.entries()) {
    const etiqueta = `${ETIQUETA} ${escenario.id}`;
    try {
      await arrancarMision(page, urlDelEscenario(url, escenario.consulta), escenario.mision, {
        asentarMs: 900,
        reiniciarAzar: true,
      });
    } catch (error) {
      fail(`${etiqueta}: no arranca la misión (${error.message.split('\n')[0]})`);
      continue;
    }

    const textosAjenos = await page.evaluate(() => {
      const buffer = window.__eko?.artBufferSize() ?? null;
      if (!buffer) return ['(sin tamaño de buffer: el pase no terminó de cargar)'];
      return [
        ...new Set(
          (window.__arteTextos ?? [])
            .filter((t) => !t.enDom && t.ancho === buffer.width && t.alto === buffer.height)
            .map((t) => t.texto)
            .filter((texto) => !texto.startsWith('ART PROOF'))
        ),
      ];
    });
    if (textosAjenos.length > 0) {
      fail(
        `${etiqueta}: el buffer dibuja texto con fuente del sistema (${textosAjenos.join(', ')}); la huella no sería portable`
      );
    }

    // El canvas y el marco se comprueban una vez: son presentación y no cambian
    // de un escenario a otro.
    if (indice === 0) {
      const canvas = await estadisticasCanvas(page);
      if (!canvas || canvas.error) {
        fail(`${ETIQUETA}: ${canvas ? canvas.error : 'no existe el canvas'}`);
        continue;
      }
      const proporcion = canvas.visibles / canvas.muestras;
      if (canvas.tonos < 8 || proporcion < 0.05) {
        fail(
          `${ETIQUETA}: canvas vacío (${canvas.tonos} tonos, ${(proporcion * 100).toFixed(1)} % visibles)`
        );
        continue;
      }
      if (!(await comprobarMarco(page))) continue;
    }

    const hash = await page.evaluate(() => window.__eko?.artBufferHash() ?? null);
    if (!hash) {
      fail(`${etiqueta}: sin buffer del pase; el render por defecto no es el de píxeles`);
      continue;
    }
    medidos[escenario.id] = hash;
    console.log(`${etiqueta} · ${escenario.mision}: buffer ${hash}`);
  }

  if (ACTUALIZAR) {
    // Una regeneración parcial borraría huellas en silencio: si un escenario no
    // midió, el archivo no se toca.
    const faltan = ESCENARIOS.filter((escenario) => !medidos[escenario.id]).map((e) => e.id);
    if (faltan.length > 0) {
      fail(`${ETIQUETA}: no se regeneran las huellas, faltó medir ${faltan.join(', ')}`);
      return;
    }
    writeFileSync(HUELLAS, `${JSON.stringify({ escenarios: medidos }, null, 2)}\n`);
    console.log(`${ETIQUETA} · huellas regeneradas (${Object.keys(medidos).length} escenarios)`);
    return;
  }

  const esperadas = leerHuellas();
  let distintos = 0;
  for (const escenario of ESCENARIOS) {
    const medido = medidos[escenario.id];
    if (!medido) {
      distintos += 1; // el escenario ya falló y lo reportó arriba
      continue;
    }
    const esperado = esperadas[escenario.id];
    if (esperado === medido) continue;
    distintos += 1;
    fail(
      esperado
        ? `${ETIQUETA} ${escenario.id}: cambió el arte (huella ${esperado}, ahora ${medido}); si fue a propósito: ART_PROOF_HUELLAS=1 npm run smoke:quick`
        : `${ETIQUETA} ${escenario.id}: sin huella guardada (midió ${medido}); corre ART_PROOF_HUELLAS=1 npm run smoke:quick`
    );
  }
  if (distintos === 0) {
    console.log(`${ETIQUETA} · ${ESCENARIOS.length} escenarios idénticos a la huella guardada`);
  }
}
