/**
 * Objetivo primario de despeje: el HUD y el EKO-Pad tienen que mostrar el estado
 * por estancia (no vista / en contacto / despejada) y coincidir entre sí.
 *
 * Se exige al menos una sala despejada y una pendiente, que es el estado real de
 * una misión recién insertada: las estancias de inserción nacen aseguradas y el
 * resto sin ver. La fuente son los `data-*` del HUD y del pad, no el texto exacto,
 * para que el humo no dependa de una etiqueta concreta.
 */
import { fail } from '../informe.mjs';
import { pulsarConAzarSembrado } from '../navegador.mjs';

const ETIQUETA = 'despeje';
const MISION_1 = 'Misión 1: Piso Graz - Lend';
const ESTADOS = new Set(['SIN_VISTA', 'EN_CONTACTO', 'DESPEJADA']);

/** El perfil anterior puede dejar la página en el título: se arranca la misión. */
async function asegurarMision(page, url) {
  const jugando = await page.evaluate(() => window.__eko?.snapshot()?.gameState === 'PLAYING');
  if (jugando) return true;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    const mision = page.getByRole('button', { name: MISION_1, exact: true });
    await mision.waitFor({ timeout: 15000 });
    await pulsarConAzarSembrado(mision);
    await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
    return true;
  } catch (error) {
    fail(`${ETIQUETA}: no arranca la misión (${error.message.split('\n')[0]})`);
    return false;
  }
}

/** Progreso, siguiente estancia y contacto que publica el HUD. */
export function leerHud(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="objetivo-despeje"]');
    if (!panel) return null;
    return {
      despejadas: Number(panel.getAttribute('data-despejadas')),
      total: Number(panel.getAttribute('data-total')),
      siguiente: panel.getAttribute('data-siguiente') ?? '',
      siguienteId: panel.getAttribute('data-siguiente-id') ?? '',
      contacto: panel.getAttribute('data-en-contacto') ?? '',
    };
  });
}

/** Salas pintadas en el mapa del pad, con el estado que usó cada una. */
function leerMapa(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-mapa-sala]')].map((nodo) => ({
      sala: nodo.getAttribute('data-mapa-sala') ?? '',
      estado: nodo.getAttribute('data-mapa-estado') ?? '',
    }))
  );
}

/** Estancias del EKO-Pad con su estado derivado. */
export function leerPad(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="pad-despeje"]');
    if (!panel) return null;
    return [...panel.querySelectorAll('[data-estado]')].map((fila) => ({
      sala: fila.getAttribute('data-sala') ?? '',
      estado: fila.getAttribute('data-estado') ?? '',
    }));
  });
}

/** Objetivo primario: una sala despejada y una pendiente, en HUD y en EKO-Pad. */
export async function comprobarDespeje(page, { url }) {
  if (!(await asegurarMision(page, url))) return;

  const panel = page.locator('[data-testid="objetivo-despeje"]');
  try {
    await panel.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    fail(`${ETIQUETA}: el HUD no muestra el objetivo primario de despeje`);
    return;
  }

  const hud = await leerHud(page);
  if (!hud) {
    fail(`${ETIQUETA}: no se pudo leer el objetivo del HUD`);
    return;
  }
  if (!Number.isFinite(hud.total) || hud.total < 2) {
    fail(`${ETIQUETA}: el HUD publica ${hud.total} estancias, se esperaban al menos 2`);
    return;
  }
  if (hud.despejadas < 1) {
    fail(`${ETIQUETA}: ninguna estancia despejada al empezar (${hud.despejadas}/${hud.total})`);
  }
  if (hud.total - hud.despejadas < 1) {
    fail(`${ETIQUETA}: todas las estancias están despejadas al empezar, no hay objetivo pendiente`);
  }
  if (!hud.siguiente || !hud.siguienteId) {
    fail(`${ETIQUETA}: el HUD no nombra la siguiente estancia pendiente`);
  }

  // El pad tiene que enseñar el mismo tablero, no una versión propia.
  try {
    await page.getByRole('button', { name: /\[M\] PAD/ }).click();
    await page.locator('[data-testid="pad-despeje"]').waitFor({ state: 'visible', timeout: 8000 });
  } catch (error) {
    fail(`${ETIQUETA}: no se abre el objetivo en el EKO-Pad (${error.message.split('\n')[0]})`);
    return;
  }

  const filas = await leerPad(page);
  if (!filas || !filas.length) {
    fail(`${ETIQUETA}: el EKO-Pad no lista las estancias con su estado`);
    return;
  }
  const desconocidos = filas.filter((fila) => !ESTADOS.has(fila.estado));
  if (desconocidos.length) {
    fail(`${ETIQUETA}: estados inválidos en el pad (${desconocidos.map((fila) => fila.estado).join(', ')})`);
  }

  const despejadasEnPad = filas.filter((fila) => fila.estado === 'DESPEJADA').length;
  const pendientesEnPad = filas.length - despejadasEnPad;
  if (filas.length !== hud.total || despejadasEnPad !== hud.despejadas) {
    fail(
      `${ETIQUETA}: el pad cuenta ${despejadasEnPad}/${filas.length} y el HUD ${hud.despejadas}/${hud.total}`
    );
  }
  if (despejadasEnPad < 1) {
    fail(`${ETIQUETA}: el pad no muestra ninguna estancia despejada`);
  }
  if (pendientesEnPad < 1 || !filas.some((fila) => fila.estado === 'SIN_VISTA')) {
    fail(`${ETIQUETA}: el pad no muestra ninguna estancia pendiente`);
  }
  const primeraPendiente = filas.find((fila) => fila.estado !== 'DESPEJADA');
  if (primeraPendiente && primeraPendiente.sala !== hud.siguienteId) {
    fail(
      `${ETIQUETA}: el HUD apunta a ${hud.siguienteId} y el pad a ${primeraPendiente.sala}`
    );
  }

  // El mapa de salas no puede tener su propio criterio: pinta el mismo estado.
  const mapa = await leerMapa(page);
  if (mapa.length !== filas.length) {
    fail(`${ETIQUETA}: el mapa pinta ${mapa.length} salas y el tablero lista ${filas.length}`);
  }
  const estadosDelTablero = new Map(filas.map((fila) => [fila.sala, fila.estado]));
  const discrepancias = mapa
    .filter((sala) => estadosDelTablero.get(sala.sala) !== sala.estado)
    .map((sala) => `${sala.sala}: tablero ${estadosDelTablero.get(sala.sala) ?? 'falta'} / mapa ${sala.estado}`);
  if (discrepancias.length) {
    fail(`${ETIQUETA}: el mapa contradice el tablero (${discrepancias.join('; ')})`);
  }

  // Se cierra el pad para no dejar un modal abierto en las secciones siguientes.
  await page.keyboard.press('Escape').catch(() => {});

  console.log(
    `${ETIQUETA} · HUD ${hud.despejadas}/${hud.total} despejadas, siguiente ${hud.siguiente} · pad ${despejadasEnPad} despejadas y ${pendientesEnPad} pendientes`
  );
}
