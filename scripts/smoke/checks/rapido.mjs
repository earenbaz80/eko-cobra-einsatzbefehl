/**
 * Perfil rápido para pull requests: canvas, Misión 1 y transiciones.
 *
 * No sustituye al smoke completo: acorta el feedback de PR con una sola carga,
 * una misión, las órdenes de Kobra 2 y las transiciones de estado que la UI usa de verdad. El smoke
 * completo sigue siendo el que valida misiones densas, móvil, persistencia,
 * metadatos, pesos y rendimiento antes de publicar.
 */
import { fail, fallos } from '../informe.mjs';
import { estadisticasCanvas } from '../canvas.mjs';
import { comprobarOrdenesEscuadron } from './ordenes.mjs';
import { comprobarTransiciones, esperarEstado } from './transiciones.mjs';

const MISION_1 = 'Misión 1: Piso Graz - Lend';

/** Comprueba que la primera misión pinta una escena real, no un canvas vacío. */
async function comprobarCanvasMision1(page) {
  const canvas = await estadisticasCanvas(page);
  if (!canvas || canvas.error) {
    fail(`rápido: canvas: ${canvas ? canvas.error : 'no existe'}`);
    return false;
  }
  if (canvas.width < 320 || canvas.height < 240) {
    fail(`rápido: canvas con tamaño raro ${canvas.width}x${canvas.height}`);
    return false;
  }
  if (canvas.tonos < 8) {
    fail(`rápido: canvas prácticamente liso (${canvas.tonos} tonos)`);
    return false;
  }
  const proporcion = canvas.visibles / canvas.muestras;
  if (proporcion < 0.05) {
    fail(`rápido: canvas casi negro (${(proporcion * 100).toFixed(1)} % de píxeles visibles)`);
    return false;
  }
  console.log(
    `rápido · Misión 1: canvas ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(0)} % de píxeles visibles`
  );
  return true;
}

/** Sección rápida: una carga, una misión y las transiciones de estado. */
export async function comprobarRapido(page, { url }) {
  const fallosAntes = fallos.length;
  await page.bringToFront();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await esperarEstado(page, 'TITLE');
  await page.getByText('MENÚ TÁCTICO · INICIO').waitFor({ timeout: 15000 });

  const mision = page.getByRole('button', { name: MISION_1, exact: true });
  await mision.waitFor({ timeout: 15000 });
  await mision.click();
  await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  await esperarEstado(page, 'PLAYING');
  await page.waitForTimeout(1000);

  if (!(await comprobarCanvasMision1(page))) return;
  await comprobarOrdenesEscuadron(page, { url });
  await comprobarTransiciones(page);
  if (fallos.length === fallosAntes) {
    console.log('rápido · canvas, Misión 1 y transiciones correctos');
  }
}
