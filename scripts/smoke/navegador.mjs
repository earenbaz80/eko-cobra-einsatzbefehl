/**
 * Vigilancia de una pestaña: apunta a las listas compartidas cualquier respuesta
 * del propio sitio que falle o cualquier error de consola.
 *
 * También vive aquí el arranque de una misión: lo usan la pasada por las siete misiones
 * y la medición de frames, para que las dos esperen exactamente lo mismo.
 */

/**
 * Re-siembra el `Math.random` determinista y pulsa en la misma tarea.
 *
 * La generación procedural del mundo consume el flujo al arrancar la misión, así
 * que sin sembrar antes del clic el mobiliario depende de cuántos frames corrió
 * el título y cambia de una pasada a otra. Cualquier arranque de misión del humo
 * debe pulsar por aquí: la misma semilla deja el mismo mundo.
 */
export async function pulsarConAzarSembrado(locator) {
  const nodo = await locator.elementHandle();
  const sembrado = await nodo.evaluate((elemento) => {
    const azar = window.__ekoAzar;
    if (!azar) return false;
    azar.reiniciar(window.__ekoSeed);
    elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  });
  if (!sembrado) throw new Error('el azar reiniciable no está instalado');
}

/**
 * Abre la URL, arranca la misión y espera al HUD en juego.
 *
 * Por defecto siembra el mundo antes del clic (`reiniciarAzar`), para que el
 * mobiliario procedural sea el mismo en cada pasada con la misma semilla y un
 * fallo se pueda reproducir. `reiniciarAzar: false` solo para un arranque que
 * deba heredar el flujo de azar que traía la página.
 */
export async function arrancarMision(page, url, nombre, { asentarMs = 1000, reiniciarAzar = true } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  const boton = page.getByRole('button', { name: nombre, exact: true });
  await boton.waitFor({ timeout: 15000 });
  if (reiniciarAzar) {
    await pulsarConAzarSembrado(boton);
  } else {
    await boton.click();
  }

  // El HUD en partida solo existe con la simulación arrancada.
  await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  // Además del HUD, el E2E espera el estado real del motor: así una misión que
  // pinta el HUD pero no ha creado al jugador no se da por arrancada.
  await page.waitForFunction(
    () => {
      const estado = window.__eko?.snapshot();
      return (
        estado?.gameState === 'PLAYING' &&
        estado.player !== null &&
        Array.isArray(estado.world.walls) &&
        Array.isArray(estado.world.doors) &&
        Array.isArray(estado.world.furniture) &&
        Object.isFrozen(estado.world)
      );
    },
    undefined,
    { timeout: 20000 }
  );
  if (asentarMs > 0) await page.waitForTimeout(asentarMs); // deja cargar sprites y pintar frames
}

/**
 * Abre la puerta de entrada de Graz hasta dejarla franca: se acerca, la abre en
 * sus tres pasos con [E] y se aparta del vano. La usan las órdenes del binomio y
 * la comprobación de daño, que necesitan entrar al piso.
 */
export async function abrirPuertaDeEntrada(page, puertaId = 'DOOR_MAIN_A') {
  const inicial = await page.evaluate(() => window.__eko?.snapshot()?.player ?? null);
  if (!inicial) throw new Error('no hay jugador para abrir la puerta de entrada');

  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(
      (x) => (window.__eko?.snapshot()?.player?.x ?? 0) >= x + 20,
      inicial.x,
      { timeout: 3000 }
    );
  } finally {
    await page.keyboard.up('KeyD');
  }
  // E abre en tres pasos (28 %, 65 %, completa). `isOpen` ya es `true` con la
  // hoja al 28 %, que bloquea el vano: si una pulsación se pierde (el motor tiene
  // su propia cadencia entre pasos), el binomio se queda clavado en el umbral. Por
  // eso se pulsa hasta ver la hoja girada del todo (`isFullyOpen`) y no se acepta
  // el primer `isOpen`.
  for (let paso = 0; paso < 8; paso += 1) {
    const abierta = await page.evaluate(
      (id) =>
        window.__eko?.snapshot()?.world.doors.find((door) => door.id === id)?.isFullyOpen === true,
      puertaId
    );
    if (abierta) break;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(160);
  }
  const delTodo = await page.evaluate(
    (id) => window.__eko?.snapshot()?.world.doors.find((door) => door.id === id)?.isFullyOpen === true,
    puertaId
  );
  if (!delTodo) throw new Error(`la puerta ${puertaId} no queda del todo abierta`);

  // El jugador tampoco debe quedar parado en el umbral mientras pasa Kobra 2.
  await page.keyboard.down('KeyA');
  try {
    await page.waitForFunction(
      (x) => (window.__eko?.snapshot()?.player?.x ?? x) <= x,
      inicial.x + 4,
      { timeout: 3000 }
    );
  } finally {
    await page.keyboard.up('KeyA');
  }
  await page.waitForTimeout(200);
}

/** Radio con el que [E] elige la puerta más cercana (`findNearestDoor(x, y, 62)`). */
export const RADIO_PUERTA = 62;
/** Holgura bajo el radio: la puerta se acciona con margen, no al filo. */
const HOLGURA_PUERTA = 12;

/** Centro de la hoja y jugador del último cuadro, con la distancia entre ambos. */
async function medirPuerta(page, puertaId) {
  return page.evaluate((id) => {
    const estado = window.__eko?.snapshot();
    const jugador = estado?.player;
    const puerta = estado?.world.doors.find((item) => item.id === id);
    if (!jugador || !puerta) return null;
    const centro = { x: (puerta.x1 + puerta.x2) / 2, y: (puerta.y1 + puerta.y2) / 2 };
    return {
      jugador: { x: jugador.x, y: jugador.y },
      centro,
      distancia: Math.hypot(jugador.x - centro.x, jugador.y - centro.y),
    };
  }, puertaId);
}

/** Distancia del operador al centro de la puerta, ya formateada para un fallo. */
export async function distanciaAPuerta(page, puertaId) {
  const medida = await medirPuerta(page, puertaId);
  if (!medida) return `sin lectura de ${puertaId} ni del jugador`;
  return (
    `jugador en ${medida.jugador.x.toFixed(1)}, ${medida.jugador.y.toFixed(1)} ` +
    `a ${medida.distancia.toFixed(1)} px del centro de ${puertaId} (radio ${RADIO_PUERTA})`
  );
}

/**
 * Deja al operador dentro del radio con el que [E] elige la puerta.
 *
 * `caminarHasta` corta en el primer cuadro que cruza su umbral y la tecla sigue
 * pisada hasta que el navegador procesa el `keyup`: ese sobrante depende de la
 * carga de la máquina, así que el operador puede quedar fuera de los 62 px y [E]
 * no acciona nada. Aquí se mide la distancia al centro de la hoja y, sólo si está
 * fuera del radio, se dan pulsos cortos hacia él hasta entrar con holgura. Dentro
 * del radio no se mueve nada: caminar hace ruido y alteraría el escenario.
 * Devuelve la distancia final, o null si no hay lectura.
 */
export async function acercarseAPuerta(page, puertaId) {
  let medida = await medirPuerta(page, puertaId);
  if (!medida || medida.distancia < RADIO_PUERTA) return medida?.distancia ?? null;
  const objetivo = RADIO_PUERTA - HOLGURA_PUERTA;
  const bloqueado = { x: false, y: false };
  for (let paso = 0; paso < 16 && medida.distancia > objetivo; paso += 1) {
    const dX = medida.centro.x - medida.jugador.x;
    const dY = medida.centro.y - medida.jugador.y;
    const ejes = Math.abs(dX) >= Math.abs(dY) ? ['x', 'y'] : ['y', 'x'];
    const eje = ejes.find(
      (candidato) => !bloqueado[candidato] && Math.abs(candidato === 'x' ? dX : dY) > 1
    );
    if (!eje) break;
    const delta = eje === 'x' ? dX : dY;
    const tecla = eje === 'x' ? (delta > 0 ? 'KeyD' : 'KeyA') : delta > 0 ? 'KeyS' : 'KeyW';
    const antes = eje === 'x' ? medida.jugador.x : medida.jugador.y;
    await page.keyboard.down(tecla);
    await page.waitForTimeout(70);
    await page.keyboard.up(tecla);
    await page.waitForTimeout(60);
    medida = await medirPuerta(page, puertaId);
    if (!medida) return null;
    const despues = eje === 'x' ? medida.jugador.x : medida.jugador.y;
    if (Math.abs(despues - antes) < 1) bloqueado[eje] = true;
  }
  return medida.distancia;
}

/** Banda del mundo que proyecta el mapa del EKO-Pad (`handleSvgMapClick`): worldX = 80 + relX * 1060, worldY = 60 + relY * 700. */
export const MAPA_PAD = { x: 80, y: 60, w: 1060, h: 700 };

const MAPA_PAD_SVG = '[role="dialog"] svg.cursor-crosshair';

/**
 * Marca un PUNTO DE AVANCE en el EKO-Pad y espera a que el pad lo confirme.
 *
 * Es la única orden que lleva al binomio a una estancia concreta: en FOLLOW su
 * punto de arrastre queda detrás del operador —a menudo al otro lado de una pared,
 * donde el guiado local se clava— y en HOLD no se mueve. El marcador de rally sí
 * recorre la ruta y abre las puertas que estorban (`squadAbrePuertasEnRuta`).
 * Devuelve false si el pad no llega a fijarlo; nunca deja el pad abierto.
 *
 * La estancia no se comprueba en el texto: el pad la nombra en alemán (`nameDe`) y
 * eso ya no coincidiría con el id interno. Que el binomio llegó donde se apuntó lo
 * mide quien llama, con su posición real.
 *
 * @param {import('playwright').Page} page
 * @param {{ x: number, y: number }} punto punto del mundo a marcar
 */
export async function marcarPuntoDeAvance(page, punto) {
  let abierto = false;
  try {
    await page.keyboard.press('KeyM');
    const mapa = page.locator(MAPA_PAD_SVG);
    await mapa.waitFor({ state: 'visible', timeout: 8000 });
    abierto = true;
    await page.getByRole('button', { name: /Avance GPS/ }).click();
    await page.evaluate((selector) => {
      document.querySelector(selector)?.scrollIntoView({ block: 'center' });
    }, MAPA_PAD_SVG);
    await page.waitForTimeout(200);

    // Misma proyección que el manejador del pad, así el punto cae donde se pulsa.
    const enPantalla = await page.evaluate(
      ({ selector, mapaPad, destino }) => {
        const svg = document.querySelector(selector);
        if (!svg) return null;
        const caja = svg.getBoundingClientRect();
        if (caja.width <= 0 || caja.height <= 0) return null;
        const x = caja.left + ((destino.x - mapaPad.x) / mapaPad.w) * caja.width;
        const y = caja.top + ((destino.y - mapaPad.y) / mapaPad.h) * caja.height;
        return {
          x,
          y,
          dentro: x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight,
        };
      },
      { selector: MAPA_PAD_SVG, mapaPad: MAPA_PAD, destino: punto }
    );
    if (!enPantalla?.dentro) return false;
    await page.mouse.click(enPantalla.x, enPantalla.y);
    await page.waitForFunction(
      () =>
        (window.__eko?.snapshot()?.radioFeed ?? []).some((linea) =>
          /PUNTO DE AVANCE/.test(linea?.text ?? '')
        ),
      undefined,
      { timeout: 4000 }
    );
    return true;
  } catch {
    return false;
  } finally {
    // Sólo se cierra lo que se abrió: un Escape de más abre el menú de pausa.
    if (abierto) await page.keyboard.press('Escape').catch(() => {});
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {{ origin: string, badRequests: string[], consoleErrors: string[], prefijo?: string, fallosDeRed?: boolean }} opciones
 *   `prefijo` distingue los avisos del móvil en el informe; `fallosDeRed` añade
 *   `requestfailed` (solo la pestaña de escritorio lo hacía).
 */
export function vigilarPagina(page, { origin, badRequests, consoleErrors, prefijo = '', fallosDeRed = true }) {
  page.on('response', (response) => {
    const target = response.url();
    if (!target.startsWith(origin)) return; // las fuentes de Google no son parte del build
    if (target.endsWith('/favicon.ico')) return;
    if (response.status() >= 400) badRequests.push(`${prefijo}${response.status()} ${target}`);
  });
  if (fallosDeRed) {
    page.on('requestfailed', (request) => {
      if (!request.url().startsWith(origin)) return;
      // `net::ERR_ABORTED` no es una caída de red: es el navegador cancelando una
      // petición que el documento anterior tenía en vuelo, por ejemplo el SVG del
      // emblema del título cuando el humo lanza el `goto` siguiente antes de que
      // termine de bajarlo. Un recurso que falta llega como 404 por `response` y
      // una conexión rota como otro `net::ERR_*`, así que esos dos siguen contando.
      if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
      badRequests.push(`FALLO ${request.url()} (${request.failure()?.errorText})`);
    });
  }
  page.on('pageerror', (error) => consoleErrors.push(`${prefijo}excepción: ${error.message}`));
  page.on('console', (message) => {
    // El favicon lo pide el navegador por su cuenta y no forma parte del build.
    if (message.type() === 'error' && !/favicon/i.test(message.text())) consoleErrors.push(`${prefijo}${message.text()}`);
  });
}
