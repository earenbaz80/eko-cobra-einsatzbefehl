/** Transiciones de estado que usa la UI: pausa, reanudación y vuelta al título. */
import { fail } from '../informe.mjs';

/** Espera a que `window.__eko` publique el estado pedido. */
export async function esperarEstado(page, esperado) {
  await page.waitForFunction(
    (estado) => window.__eko?.snapshot()?.gameState === estado,
    esperado,
    { timeout: 20000 }
  );
}

/**
 * Recorre PLAYING -> PAUSED -> PLAYING -> PAUSED -> TITLE con las mismas acciones
 * que un jugador. Comprueba además que el tick no avanza mientras la partida está
 * en pausa.
 */
export async function comprobarTransiciones(page) {
  await page.keyboard.press('Escape');
  await esperarEstado(page, 'PAUSED');
  await page.getByText('CENTRO DE MANDO EN PAUSA').waitFor({ timeout: 5000 });

  const tickPausaA = await page.evaluate(() => window.__eko?.snapshot()?.tick ?? null);
  await page.waitForTimeout(350);
  const tickPausaB = await page.evaluate(() => window.__eko?.snapshot()?.tick ?? null);
  if (typeof tickPausaA !== 'number' || tickPausaB !== tickPausaA) {
    fail(`transiciones: el tick avanza en pausa (${tickPausaA} -> ${tickPausaB})`);
  }

  await page.getByRole('button', { name: /Continuar Operación/ }).click();
  await esperarEstado(page, 'PLAYING');

  await page.keyboard.press('Escape');
  await esperarEstado(page, 'PAUSED');
  await page.getByRole('button', { name: 'Menú Principal', exact: true }).click();
  await esperarEstado(page, 'TITLE');
  await page.getByText('MENÚ TÁCTICO · INICIO').waitFor({ timeout: 5000 });

  console.log('transiciones: TITLE -> PLAYING -> PAUSED -> PLAYING -> PAUSED -> TITLE');
}
