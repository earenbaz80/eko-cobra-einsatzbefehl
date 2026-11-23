/**
 * Pase de píxeles por pantalla: título, misión, pausa, EKO-PAD y móvil.
 *
 * El art proof mide cinco escenarios de juego y el opt-out clásico, pero una
 * pantalla puede quedarse con el render anterior sin que nada más lo note: el
 * canvas sigue lleno y el HUD existe, así que el humo pasaría en verde. Aquí se
 * recorre cada pantalla como un jugador y, en cada una, se exige que el pase
 * haya pintado (`artBufferHash`, el FNV del buffer vivo, no nulo) y que su buffer
 * mida 640x360. Si una transición deja de presentar el arte, falla con el nombre
 * de la pantalla en lugar de con un hash distinto al final de la pasada.
 *
 * El móvil va en su propio contexto táctil (390x844) porque presenta el arte con
 * otro encuadre: escala 1 y recorte a los lados.
 */
import { instalarAzarDeterminista } from '../determinismo.mjs';
import { fail } from '../informe.mjs';
import { arrancarMision, pulsarConAzarSembrado, vigilarPagina } from '../navegador.mjs';

const ETIQUETA = 'pase por pantalla';
const MISION_1 = 'Misión 1: Piso Graz - Lend';
const BUFFER_ESPERADO = { width: 640, height: 360 };

/** Lectura directa del pase: hash del buffer vivo, medidas y encuadre presentado. */
function leerPase(page) {
  return page.evaluate(() => ({
    hash: window.__eko?.artBufferHash() ?? null,
    buffer: window.__eko?.artBufferSize() ?? null,
    marco: window.__eko?.artFrame?.() ?? null,
  }));
}

/**
 * Espera a que el pase haya creado su buffer y pintado un cuadro. El chunk se
 * carga aparte, así que en el título la primera presentación llega tarde; un
 * timeout acá es justamente el fallo de «esta pantalla no usa el pase».
 */
async function esperarPase(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => (window.__eko?.artBufferHash?.() ?? null) !== null,
      undefined,
      { timeout, polling: 100 }
    );
    return true;
  } catch {
    return false;
  }
}

/** Exige pase pintando y buffer 640x360 en la pantalla que está en primer plano. */
async function comprobarPantalla(page, pantalla) {
  if (!(await esperarPase(page))) {
    fail(
      `${ETIQUETA} ${pantalla}: el pase de píxeles no pinta (artBufferHash nulo) y la pantalla quedó en el render anterior`
    );
    return null;
  }
  const { hash, buffer } = await leerPase(page);
  if (!buffer) {
    fail(`${ETIQUETA} ${pantalla}: el pase no reporta el tamaño de su buffer`);
    return null;
  }
  if (buffer.width !== BUFFER_ESPERADO.width || buffer.height !== BUFFER_ESPERADO.height) {
    fail(
      `${ETIQUETA} ${pantalla}: el buffer del pase mide ${buffer.width}x${buffer.height} y no ${BUFFER_ESPERADO.width}x${BUFFER_ESPERADO.height}`
    );
    return null;
  }
  return { pantalla, hash };
}

/**
 * Recorre las cuatro pantallas de escritorio con las mismas acciones que un
 * jugador: abrir el título, lanzar la Misión 1, pausar, reanudar y abrir el
 * EKO-PAD con [M]. Al final cierra el pad para no dejar la página en modal.
 */
async function recorrerPantallas(page, url, { movil = false } = {}) {
  const medidas = [];

  const paso = async (pantalla, entrar) => {
    try {
      await entrar();
    } catch (error) {
      fail(`${ETIQUETA} ${pantalla}: ${error.message.split('\n')[0]}`);
      return;
    }
    const medida = await comprobarPantalla(page, pantalla);
    if (medida) medidas.push(medida);
  };

  await paso('título', async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await page.getByText('MENÚ TÁCTICO · INICIO').waitFor({ timeout: 20000 });
  });

  await paso('misión', async () => {
    if (movil) {
      // En móvil, el arranque por toque siembra el azar igual que en escritorio.
      const boton = page.getByRole('button', { name: MISION_1, exact: true });
      await boton.waitFor({ timeout: 15000 });
      await pulsarConAzarSembrado(boton);
      await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(700);
    } else {
      await arrancarMision(page, url, MISION_1, { asentarMs: 700 });
    }
  });

  await paso('pausa', async () => {
    await page.keyboard.press('Escape');
    await page.getByText('CENTRO DE MANDO EN PAUSA').waitFor({ timeout: 8000 });
    await page.waitForTimeout(500);
  });

  await paso('EKO-PAD', async () => {
    await page.getByRole('button', { name: /Continuar Operación/ }).click();
    await page.waitForFunction(
      () => window.__eko?.snapshot()?.gameState === 'PLAYING',
      undefined,
      { timeout: 10000 }
    );
    await page.keyboard.press('KeyM');
    await page.getByText('EKO-PAD C4I · ATAK-BOS AUSTRIA').waitFor({ timeout: 8000 });
    await page.waitForTimeout(500);
  });

  // El pad queda cerrado: otras secciones del humo esperan la escena sin modal.
  await page.keyboard.press('Escape').catch(() => {});
  return medidas;
}

/** Escritorio: la pestaña compartida del humo. */
export async function comprobarPantallasDeArte(page, { url }) {
  const medidas = await recorrerPantallas(page, url);
  if (medidas.length === 4) {
    console.log(
      `${ETIQUETA} · escritorio 640x360: ${medidas.map((m) => `${m.pantalla} ${m.hash}`).join(' · ')}`
    );
  }
}

/** Móvil: contexto táctil propio a 390x844, título y partida incluidos. */
export async function comprobarPantallasDeArteMovil(browser, contexto) {
  const contextoMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await instalarAzarDeterminista(contextoMovil, contexto.semilla);
  const movil = await contextoMovil.newPage();
  vigilarPagina(movil, {
    origin: contexto.origin,
    badRequests: contexto.badRequests,
    consoleErrors: contexto.consoleErrors,
    prefijo: 'móvil arte ',
    fallosDeRed: false,
  });

  try {
    await movil.bringToFront();
    const medidas = await recorrerPantallas(movil, contexto.url, { movil: true });
    if (medidas.length === 4) {
      console.log(
        `${ETIQUETA} · móvil 390x844 640x360: ${medidas.map((m) => `${m.pantalla} ${m.hash}`).join(' · ')}`
      );
    }
  } finally {
    await contextoMovil.close();
  }
}
