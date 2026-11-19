/**
 * Vigilancia de una pestaña: apunta a las listas compartidas cualquier respuesta
 * del propio sitio que falle o cualquier error de consola.
 *
 * También vive aquí el arranque de una misión: lo usan la pasada por las siete misiones
 * y la medición de frames, para que las dos esperen exactamente lo mismo.
 */

/**
 * Abre la URL, arranca la misión y espera al HUD en juego.
 *
 * `reiniciarAzar` re-siembra el `Math.random` determinista y pulsa el botón en
 * la misma tarea: la generación procedural del mundo consume el flujo al
 * arrancar, así que sin eso el mobiliario depende de cuántos frames corrió el
 * título. Lo usa la regresión visual del pase de arte.
 */
export async function arrancarMision(page, url, nombre, { asentarMs = 1000, reiniciarAzar = false } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  const boton = page.getByRole('button', { name: nombre, exact: true });
  await boton.waitFor({ timeout: 15000 });
  if (reiniciarAzar) {
    const nodo = await boton.elementHandle();
    const sembrado = await nodo.evaluate((elemento) => {
      const azar = window.__ekoAzar;
      if (!azar) return false;
      azar.reiniciar(window.__ekoSeed);
      elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    });
    if (!sembrado) throw new Error('el azar reiniciable no está instalado');
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
  // E abre en tres pasos (28 %, 65 %, completa). La primera apertura deja la
  // hoja en el vano y Kobra 2 no puede atravesarla; hay que abrirla del todo.
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    (id) => window.__eko?.snapshot()?.world.doors.find((door) => door.id === id)?.isOpen === true,
    puertaId,
    { timeout: 3000 }
  );

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
      if (request.url().startsWith(origin)) badRequests.push(`FALLO ${request.url()} (${request.failure()?.errorText})`);
    });
  }
  page.on('pageerror', (error) => consoleErrors.push(`${prefijo}excepción: ${error.message}`));
  page.on('console', (message) => {
    // El favicon lo pide el navegador por su cuenta y no forma parte del build.
    if (message.type() === 'error' && !/favicon/i.test(message.text())) consoleErrors.push(`${prefijo}${message.text()}`);
  });
}
