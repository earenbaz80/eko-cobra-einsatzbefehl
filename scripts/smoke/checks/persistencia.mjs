/**
 * Persistencia: jugar un poco, esperar el autoguardado, recargar y reanudar.
 *
 * La comprobación usa `window.__eko` para afirmar el estado real del motor: la
 * posición del jugador, el tick y el mundo deben ser los guardados, no los de una
 * misión recién reiniciada. La puerta de entrada se abre antes de guardar para que
 * el mundo tenga un cambio observable además de la posición.
 */
import { fail } from '../informe.mjs';
import { arrancarMision } from '../navegador.mjs';

const MISION = 'Misión 1: Piso Graz - Lend';
const CLAVE_GUARDADO = 'eko_cobra_partida_en_curso';
const PUERTA_ENTRADA = 'DOOR_MAIN_A';

/** Lee una instantánea atómica del motor; falla si no hay jugador creado. */
async function leerEstado(page) {
  const estado = await page.evaluate(() => window.__eko?.snapshot() ?? null);
  if (!estado || !estado.player) throw new Error('window.__eko no expone un jugador');
  return estado;
}

/** Espera a que el jugador se haya movido al menos `minimo` píxeles. */
async function moverJugador(page, desdeX, minimo = 20) {
  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(
      ({ x, distancia }) => {
        const jugador = window.__eko?.snapshot()?.player;
        return jugador != null && jugador.x >= x + distancia;
      },
      { x: desdeX, distancia: minimo },
      { timeout: 3000 }
    );
  } finally {
    await page.keyboard.up('KeyD');
  }
}

/** Espera a que el autoguardado contenga la posición y la puerta abierta. */
async function esperarGuardado(page, x, y) {
  await page.waitForFunction(
    ({ clave, x, y, puertaId }) => {
      try {
        const bruto = localStorage.getItem(clave);
        if (!bruto) return false;
        const guardado = JSON.parse(bruto)?.state;
        const simulacion = guardado?.simulacion;
        if (!simulacion) return false;
        const puerta = simulacion.mundo?.puertas?.find((item) => item.id === puertaId);
        return (
          Math.abs(simulacion.jugador.x - x) <= 1 &&
          Math.abs(simulacion.jugador.y - y) <= 1 &&
          puerta?.isOpen === true
        );
      } catch {
        return false;
      }
    },
    { clave: CLAVE_GUARDADO, x, y, puertaId: PUERTA_ENTRADA },
    { timeout: 12000 }
  );
}

/** Comprueba que la partida guardada se reanuda sin reiniciar la misión. */
export async function comprobarPersistencia(page, { url }) {
  try {
    await arrancarMision(page, url, MISION, { asentarMs: 400 });
    const inicial = await leerEstado(page);

    await moverJugador(page, inicial.player.x);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(
      (puertaId) => window.__eko?.snapshot()?.world.doors.find((item) => item.id === puertaId)?.isOpen === true,
      PUERTA_ENTRADA,
      { timeout: 3000 }
    );

    const antes = await leerEstado(page);
    await esperarGuardado(page, antes.player.x, antes.player.y);

    const guardado = await page.evaluate((clave) => {
      try {
        return JSON.parse(localStorage.getItem(clave))?.state ?? null;
      } catch {
        return null;
      }
    }, CLAVE_GUARDADO);
    const simulacion = guardado?.simulacion;
    if (!simulacion) {
      fail('persistencia: el autoguardado no contiene la simulación');
      return;
    }

    const guardadoX = simulacion.jugador?.x;
    const guardadoY = simulacion.jugador?.y;
    const puertaGuardada = simulacion.mundo?.puertas?.find((item) => item.id === PUERTA_ENTRADA);
    if (
      !Number.isFinite(guardadoX) ||
      !Number.isFinite(guardadoY) ||
      Math.abs(guardadoX - antes.player.x) > 1 ||
      Math.abs(guardadoY - antes.player.y) > 1 ||
      puertaGuardada?.isOpen !== true
    ) {
      fail('persistencia: el autoguardado no refleja la posición y la puerta abiertas');
      return;
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    const reanudar = page.getByRole('button', { name: /REANUDAR PARTIDA GUARDADA/ });
    await reanudar.waitFor({ timeout: 15000 });
    await reanudar.click();
    await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
    await page.waitForFunction(
      () => window.__eko?.snapshot()?.gameState === 'PLAYING' && window.__eko?.snapshot()?.player !== null,
      undefined,
      { timeout: 20000 }
    );

    const despues = await leerEstado(page);
    const dx = Math.abs(despues.player.x - antes.player.x);
    const dy = Math.abs(despues.player.y - antes.player.y);
    const mundoRestaurado = JSON.stringify(despues.world) === JSON.stringify(antes.world);
    const tickRestaurado = typeof simulacion.tick !== 'number' || despues.tick >= simulacion.tick;
    if (dx > 1 || dy > 1) {
      fail(
        `persistencia: posición restaurada (${despues.player.x.toFixed(1)}, ${despues.player.y.toFixed(1)}) ` +
          `distinta de la guardada (${antes.player.x.toFixed(1)}, ${antes.player.y.toFixed(1)})`
      );
    }
    if (despues.world.mission !== antes.world.mission) {
      fail(`persistencia: misión restaurada ${despues.world.mission} en vez de ${antes.world.mission}`);
    }
    if (!mundoRestaurado) {
      fail('persistencia: el mundo restaurado no coincide con el guardado');
    }
    if (!tickRestaurado) {
      fail(`persistencia: tick restaurado ${despues.tick}, guardado ${simulacion.tick}`);
    }

    if (dx <= 1 && dy <= 1 && mundoRestaurado && tickRestaurado) {
      console.log(
        `persistencia: posición (${despues.player.x.toFixed(1)}, ${despues.player.y.toFixed(1)}), ` +
          `tick ${despues.tick} y mundo restaurados; puerta ${PUERTA_ENTRADA} abierta`
      );
    }
  } catch (error) {
    fail(`persistencia: ${error.message.split('\n')[0]}`);
  }
}
