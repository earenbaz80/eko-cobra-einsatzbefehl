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
import { contarCianEnPuntero, contarRotulosSobreElArte } from '../capas.mjs';
import { abrirPuertaDeEntrada, arrancarMision } from '../navegador.mjs';
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
    CanvasRenderingContext2D.prototype.fillText = function (texto, x, y, ...resto) {
      registrados.push({
        texto: String(texto),
        x,
        y,
        ancho: this.canvas.width,
        alto: this.canvas.height,
        enDom: this.canvas.isConnected,
      });
      return original.call(this, texto, x, y, ...resto);
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
 * El pase presenta su buffer y retorna, así que las capas que el motor pinta a
 * resolución de pantalla —minimapa, retículo, PiP, NVG, grano— las repinta él
 * sobre el arte. Se comprueba en el render por defecto: el rótulo del minimapa
 * aparece en el canvas visible y en su posición, y el retículo sigue al puntero.
 */
async function comprobarCapasSobreElArte(page, url) {
  try {
    await arrancarMision(page, url, 'Misión 1: Piso Graz - Lend', {
      asentarMs: 700,
      reiniciarAzar: true,
    });
  } catch (error) {
    fail(`${ETIQUETA} capas: no arranca la misión (${error.message.split('\n')[0]})`);
    return;
  }

  const rotulos = await contarRotulosSobreElArte(page);
  if (rotulos.minimapa === 0) {
    fail(`${ETIQUETA} capas: el minimapa no se pinta sobre el arte (sin rótulo en el canvas visible)`);
  }

  // Más fuerte que el rótulo: el marcador del jugador en el centro del minimapa
  // tiene que verse. Si otra capa lo tapa, no queda ámbar en esa caja.
  const marcador = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const dpr = el.width / el.getBoundingClientRect().width;
    const lado = 18;
    const x0 = Math.round(74 * dpr - lado / 2);
    const y0 = Math.round(74 * dpr - lado / 2);
    const { data } = ctx.getImageData(x0, y0, lado, lado);
    let ambar = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 190 && data[i + 1] > 110 && data[i + 1] < 200 && data[i + 2] < 90) ambar += 1;
    }
    return ambar;
  });
  if (marcador < 5) {
    fail(`${ETIQUETA} capas: el minimapa no se ve sobre el arte (${marcador} px ámbar en su centro)`);
    return;
  }

  // El retículo acampa en el puntero: sin él, el arte de fondo no da ese cian.
  const enA = await contarCianEnPuntero(page, 700, 240);
  const enB = await contarCianEnPuntero(page, 1010, 240);
  if (enA < 8 || enB < 8) {
    fail(
      `${ETIQUETA} capas: el retículo no se pinta sobre el arte (cian ${enA} en 700,240 y ${enB} en 1010,240)`
    );
    return;
  }

  console.log(
    `${ETIQUETA} · minimapa y retículo sobre el arte (${marcador} px de marcador; cian ${enA}/${enB} en dos posiciones)`
  );
}

/**
 * Congela el reloj ya en marcha (sin recargar): el bucle saca el dt del
 * timestamp de rAF y el pase lee `performance.now()`, así que con ambos fijos la
 * escena queda quieta y lo único que cambia entre dos cuadros es el grano, que
 * sortea sus motas con `Math.random` en cada cuadro.
 */
async function congelarCuadros(page) {
  await page.evaluate(() => {
    if (window.__cuadrosCongelados) return;
    const rafReal = window.requestAnimationFrame.bind(window);
    const ahora = performance.now();
    window.__cuadrosCongelados = true;
    window.__reanudarCuadros = () => {
      window.requestAnimationFrame = rafReal;
      delete performance.now;
      window.__cuadrosCongelados = false;
    };
    window.requestAnimationFrame = (callback) => rafReal(() => callback(ahora));
    Object.defineProperty(performance, 'now', { value: () => ahora, configurable: true });
  });
  // El cuadro que ya estaba en vuelo trae su dt real: se deja que el bucle se
  // re-registre con el timestamp fijo antes de medir, o las partículas se mueven.
  await page.waitForTimeout(250);
}

async function reanudarCuadros(page) {
  await page.evaluate(() => window.__reanudarCuadros?.());
}

/**
 * Mide las dos capas de daño sobre el arte con el reloj quieto: `ruido` cuenta
 * los píxeles que cambian entre dos cuadros consecutivos (grano) y `rojez` es la
 * media de rojo menos azul en las franjas laterales, donde la viñeta de trauma
 * tiñe de rojo; sano, el arte deja las franjas frías.
 */
function medirCuadros(page) {
  return page.evaluate(async () => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const ancho = el.width;
    const alto = el.height;
    const enHud = (x, y) =>
      (x < 150 && y < 150) || (x > ancho - 220 && y < 152); // minimapa y PiP
    const esperarCuadro = () =>
      new Promise((listo) =>
        requestAnimationFrame(() => requestAnimationFrame(() => listo(true)))
      );
    const capturar = () => ctx.getImageData(0, 0, ancho, alto).data;
    const antes = capturar();
    await esperarCuadro();
    const despues = capturar();
    let ruido = 0;
    let rojez = 0;
    let muestras = 0;
    const borde = Math.round(Math.min(ancho, alto) * 0.12);
    for (let y = 0; y < alto; y += 1) {
      for (let x = 0; x < ancho; x += 1) {
        const i = (y * ancho + x) * 4;
        if (!enHud(x, y)) {
          const salto =
            Math.abs(antes[i] - despues[i]) +
            Math.abs(antes[i + 1] - despues[i + 1]) +
            Math.abs(antes[i + 2] - despues[i + 2]);
          if (salto > 30) ruido += 1;
        }
        if (x < borde || x >= ancho - borde || y < borde || y >= alto - borde) {
          rojez += despues[i] - despues[i + 2];
          muestras += 1;
        }
      }
    }
    return { ruido, rojez: rojez / muestras };
  });
}

/**
 * Mide un estado quieto. Congelar no detiene lo que ya estaba en movimiento
 * (un fogonazo, una burbuja entrando), así que se toman hasta tres muestras y se
 * queda la más limpia: el grano de daño está en todas, un resto de animación no.
 */
async function medirEstadoQuieto(page) {
  let mejor = null;
  for (let intento = 0; intento < 3; intento += 1) {
    await congelarCuadros(page);
    const medida = await medirCuadros(page);
    await reanudarCuadros(page);
    if (!mejor || medida.ruido < mejor.ruido) mejor = medida;
    if (mejor.ruido <= 15) break;
    await page.waitForTimeout(350);
  }
  return mejor;
}

/** Mantiene una tecla hasta que el jugador alcanza la coordenada pedida. */
async function caminarHasta(page, tecla, condicion, valor, timeout = 8000) {
  await page.keyboard.down(tecla);
  try {
    await page.waitForFunction(condicion, valor, { timeout });
  } finally {
    await page.keyboard.up(tecla);
  }
}

/** Media de color de una caja del canvas, para comparar antes y después del NVG. */
function mediaDeColor(page, x, y, ancho, alto) {
  return page.evaluate(
    ([px, py, w, h]) => {
      const el = document.querySelector('canvas');
      const ctx = el.getContext('2d');
      const { data } = ctx.getImageData(px, py, w, h);
      let r = 0;
      let g = 0;
      let b = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      return { r: r / n, g: g / n, b: b / n };
    },
    [x, y, ancho, alto]
  );
}

/**
 * El grano de daño y la viñeta de trauma viajan por `renderScreenOverlays`, pero
 * el pase de píxeles los pinta él mismo: si esa llamada se pierde, el humo no lo
 * note. Aquí se provoca daño real (un sospechoso armado dispara al operador), se
 * confirma que el impacto llegó y se mide el arte con el jugador sano y herido.
 * Con el daño activo también deben seguir el minimapa, el PiP, el retículo y el NVG.
 */
async function comprobarGranoDeDanio(page, url) {
  try {
    await arrancarMision(page, url, 'Misión 1: Piso Graz - Lend', {
      asentarMs: 600,
      reiniciarAzar: true,
    });
  } catch (error) {
    fail(`${ETIQUETA} daño: no arranca la misión (${error.message.split('\n')[0]})`);
    return;
  }

  // Sano: al arrancar, con la escuadra en HOLD para que el cuadro quede quieto y
  // nadie disparando. Más tarde el sospechoso puede abrir fuego sobre el
  // corredor y la supresión encendería el grano sin que el operador esté herido.
  try {
    await page.keyboard.press('Digit2');
    await page.waitForFunction(
      () => {
        const escuadra = window.__eko?.snapshot()?.squad;
        if (!escuadra || escuadra.command !== 'HOLD') return false;
        const previa = window.__escuadraFirme;
        window.__escuadraFirme = { x: escuadra.x, y: escuadra.y };
        return (
          !!previa &&
          Math.abs(previa.x - escuadra.x) < 0.3 &&
          Math.abs(previa.y - escuadra.y) < 0.3
        );
      },
      undefined,
      { timeout: 8000, polling: 100 }
    );
  } catch (error) {
    fail(`${ETIQUETA} daño: la escuadra no se queda firme (${error.message.split('\n')[0]})`);
    return;
  }
  const sinDanio = await page.evaluate(() => window.__eko?.snapshot()?.player ?? null);
  if (!sinDanio || sinDanio.hp < 100 || sinDanio.bleeding) {
    fail(`${ETIQUETA} daño: el operador ya estaba herido antes de la prueba (${JSON.stringify(sinDanio)})`);
    return;
  }
  const sano = await medirEstadoQuieto(page);

  // Entrar al piso y a la cocina, donde patrulla un sospechoso armado.
  try {
    await abrirPuertaDeEntrada(page);
    await caminarHasta(page, 'KeyD', (x) => (window.__eko?.snapshot()?.player?.x ?? 0) >= x, 390);
    await caminarHasta(page, 'KeyW', (y) => (window.__eko?.snapshot()?.player?.y ?? 999) <= y, 302);
  } catch (error) {
    fail(`${ETIQUETA} daño: no se llega al corredor (${error.message.split('\n')[0]})`);
    return;
  }

  try {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
    await page.keyboard.press('KeyE');
    await caminarHasta(page, 'KeyW', (y) => (window.__eko?.snapshot()?.player?.y ?? 999) <= y, 250);
    // Hasta la altura del sospechoso: a esa distancia contesta seguro.
    await caminarHasta(page, 'KeyD', (x) => (window.__eko?.snapshot()?.player?.x ?? 0) >= x, 440);
  } catch (error) {
    fail(`${ETIQUETA} daño: no se entra a la cocina (${error.message.split('\n')[0]})`);
    return;
  }

  // El sospechoso contesta al intruso. Se espera sangrado —no el simple fogonazo
  // del impacto, que dura 0,42 s—: la herida abierta mantiene encendido el grano
  // de daño y la viñeta de trauma mientras dure la medición.
  let herido = false;
  for (let intento = 0; intento < 3 && !herido; intento += 1) {
    if (intento > 0) await page.mouse.click(1080, 300);
    herido = await page
      .waitForFunction(
        () => window.__eko?.snapshot()?.player?.bleeding === true,
        undefined,
        { timeout: 7000, polling: 100 }
      )
      .then(() => true)
      .catch(() => false);
  }
  if (!herido) {
    const estado = await page.evaluate(() => window.__eko?.snapshot()?.player ?? null);
    fail(`${ETIQUETA} daño: el sospechoso no llegó a herir al operador (${JSON.stringify(estado)})`);
    return;
  }

  // Con el daño activo: grano, viñeta y las capas que no deben perderse.
  await congelarCuadros(page);
  let danio = await medirCuadros(page);
  for (let intento = 0; intento < 2 && danio.ruido < 120; intento += 1) {
    await reanudarCuadros(page);
    await page.waitForTimeout(300);
    await congelarCuadros(page);
    const otra = await medirCuadros(page);
    if (otra.ruido > danio.ruido) danio = otra;
  }
  // Las capas se comprueban con el reloj real: el retículo sigue al puntero y,
  // con el cuadro congelado, se queda donde estaba antes del último movimiento.
  await reanudarCuadros(page);
  const rotulos = await contarRotulosSobreElArte(page);
  // El retículo cambia de color cuando cae sobre un actor (rojo sobre el
  // sospechoso), así que se prueban tres puntos: en dos tiene que seguir el cian
  // táctico que dibuja sobre el arte.
  const cianes = [];
  for (const [x, y] of [[300, 600], [1000, 600], [700, 240]]) {
    cianes.push(await contarCianEnPuntero(page, x, y));
  }
  const sinNvg = await mediaDeColor(page, 520, 260, 240, 120);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(220);
  const conNvg = await mediaDeColor(page, 520, 260, 240, 120);
  await page.keyboard.press('KeyN');

  if (rotulos.minimapa === 0) {
    fail(`${ETIQUETA} daño: el minimapa desaparece con el daño activo`);
  }
  if (rotulos.piip === 0) {
    fail(`${ETIQUETA} daño: el PiP de la bodycam desaparece con el daño activo`);
  }
  if (cianes.filter((cuenta) => cuenta >= 8).length < 2) {
    fail(
      `${ETIQUETA} daño: el retículo desaparece con el daño activo (cian ${cianes.join('/')} en tres posiciones)`
    );
  }
  const verdeAntes = sinNvg.g - sinNvg.r;
  const verdeDespues = conNvg.g - conNvg.r;
  if (verdeDespues - verdeAntes < 12) {
    fail(
      `${ETIQUETA} daño: el NVG no se aplica sobre el arte herido (verde ${verdeAntes.toFixed(1)} -> ${verdeDespues.toFixed(1)})`
    );
  }
  if (danio.ruido < 120) {
    fail(
      `${ETIQUETA} daño: sin grano sobre el arte herido (ruido ${danio.ruido} con daño y ${sano.ruido} sano)`
    );
  }
  if (sano.ruido > 15) {
    fail(`${ETIQUETA} daño: el grano aparece con el jugador sano (ruido ${sano.ruido})`);
  }
  if (danio.rojez - sano.rojez < 8) {
    fail(
      `${ETIQUETA} daño: sin viñeta de trauma sobre el arte (rojez ${sano.rojez.toFixed(1)} sana y ${danio.rojez.toFixed(1)} herida)`
    );
  }

  console.log(
    `${ETIQUETA} · daño sobre el arte (grano ${sano.ruido}->${danio.ruido} px, viñeta rojez ${sano.rojez.toFixed(1)}->${danio.rojez.toFixed(1)}, minimapa/PiP/retículo cian ${cianes.join('/')}, NVG ${verdeAntes.toFixed(1)}->${verdeDespues.toFixed(1)})`
  );
}

/**
 * El pase presenta su buffer 16:9 centrado. Antes se deducía de las bandas
 * negras del canvas, pero ahora las capas de pantalla (lluvia, minimapa,
 * retículo) las pintan, así que el encuadre se lee del propio pase: centro en el
 * panel, 16:9 exacto y el encaje que corresponde a la ventana.
 */
async function comprobarEncuadre(page) {
  const datos = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const rect = el.getBoundingClientRect();
    return {
      frame: window.__eko?.artFrame?.() ?? null,
      ancho: rect.width,
      alto: rect.height,
    };
  });

  if (!datos.frame || datos.ancho <= 0 || datos.alto <= 0) {
    fail(`${ETIQUETA}: el pase no reporta su presentación (${JSON.stringify(datos.frame)})`);
    return false;
  }

  const { x, y, zoom } = datos.frame;
  const encaje = Math.min(datos.ancho / 640, datos.alto / 360);
  const banda = Math.max(0, (datos.alto - 360 * zoom) / 2, (datos.ancho - 640 * zoom) / 2);

  if (Math.abs(zoom - encaje) > 0.02) {
    fail(`${ETIQUETA}: el encuadre del pase no encaja en la ventana (zoom ${zoom}, esperado ${encaje})`);
    return false;
  }
  if (Math.abs(x - datos.ancho / 2) > 1 || Math.abs(y - datos.alto / 2) > 1) {
    fail(`${ETIQUETA}: el pase no está centrado (${x},${y} en un panel de ${datos.ancho}x${datos.alto})`);
    return false;
  }
  if (Math.abs((640 * zoom) / (360 * zoom) - 16 / 9) > 0.02) {
    fail(`${ETIQUETA}: el pase no presenta 16:9 (zoom ${zoom})`);
    return false;
  }
  if (banda < 8) {
    fail(`${ETIQUETA}: el pase no deja banda (${banda} px); el encaje no es el de 640x360`);
    return false;
  }

  console.log(`${ETIQUETA} · encuadre 640x360 ×${zoom.toFixed(2)} centrado con banda ${banda.toFixed(0)} px`);
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
  await vigilarTextoDelSistema(page);
  // Antes de congelar el reloj: el daño se provoca jugando (disparos reales) y el
  // congelado del arranque dejaría la simulación parada.
  await comprobarGranoDeDanio(page, url);
  await congelarTiempo(page);
  await comprobarChunkSeparado(page, url);
  await comprobarPaseClasico(page, url);
  await comprobarCapasSobreElArte(page, url);

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
      if (!(await comprobarEncuadre(page))) continue;
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
