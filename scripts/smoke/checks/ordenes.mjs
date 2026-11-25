/**
 * Órdenes de Kobra 2: no basta con que la tecla cambie `squadCommand`.
 * Estas comprobaciones esperan el efecto observable en el mundo real:
 *   [3] brecha y abre la puerta (patada, ariete o C4 según el estado),
 *   [4] ejecuta la sonda óptica,
 *   [2] HOLD cancela el avance pendiente antes de que se produzca la brecha,
 *   un PUNTO DE AVANCE del EKO-Pad hace rodear el piso abriendo las puertas,
 *   [7] contra un objetivo de otra estancia también rodea el piso desde el rellano.
 *
 * Se ejecutan sobre una misión real de Graz y usan `window.__eko` para leer el
 * estado del motor, no el texto de la interfaz.
 */
import { fail, fallos } from '../informe.mjs';
import {
  abrirPuertaDeEntrada,
  acercarseAPuerta,
  arrancarMision,
  distanciaAPuerta,
  marcarPuntoDeAvance,
  pulsarConAzarSembrado,
} from '../navegador.mjs';

const MISION = 'Misión 1: Piso Graz - Lend';
const MISION_LINZ = 'Misión 3: Laboratorio Químico';
const PUERTA = 'DOOR_MAIN_A';
const PUERTA_CONTEXTUAL = 'DOOR_LIVING';
const PUERTA_RAM = 'DOOR_MAIN_A';
const PUERTA_C4 = 'DOOR_LINZ_DOCK_B';
/**
 * Punto del salón marcado en el pad, en coordenadas del mundo: a 309 px de Milán,
 * fuera del aborto en tránsito (260 px). La proyección al SVG la hace
 * `marcarPuntoDeAvance` con la banda `MAPA_PAD` del pad.
 */
const PUNTO_PAD = { x: 570, y: 355 };

const leerEstado = (page) => page.evaluate(() => window.__eko?.snapshot() ?? null);

/** Binomio del último cuadro, sin arrastrar el resto de la instantánea. */
const leerBinomio = (page) => page.evaluate(() => window.__eko?.snapshot()?.squad ?? null);

/** Puertas del mundo, sin arrastrar el resto de la instantánea. */
const leerPuertas = (page) => page.evaluate(() => window.__eko?.snapshot()?.world.doors ?? []);

/** Una puerta por id (la de entrada por defecto), sin el resto de la instantánea. */
const leerPuerta = (page, puertaId = PUERTA) =>
  page.evaluate(
    (id) => window.__eko?.snapshot()?.world.doors.find((puerta) => puerta.id === id) ?? null,
    puertaId
  );

async function iniciar(page, url, { asentarMs = 300 } = {}) {
  await arrancarMision(page, url, MISION, { asentarMs });
}

async function comprobarBrecha(page, url) {
  try {
    await iniciar(page, url);
    await page.keyboard.press('Digit3');
    await page.waitForFunction(
      (puertaId) =>
        window.__eko?.snapshot()?.world.doors.find((puerta) => puerta.id === puertaId)
          ?.isBreached === true,
      PUERTA,
      { timeout: 6000 }
    );

    const puerta = await leerPuerta(page);
    if (!puerta?.isBreached || !puerta.isOpen || puerta.isLocked) {
      fail(`órdenes · brecha: la puerta no quedó abierta y brechada (${JSON.stringify(puerta)})`);
      return;
    }

    // La hoja abierta ya no se puede atravesar: el binomio debe rodearla y
    // entrar realmente al compartimento, no quedarse clavado en el umbral.
    await page.waitForFunction(
      () => {
        const escuadra = window.__eko?.snapshot()?.squad;
        return escuadra?.command === 'HOLD' && escuadra.target === null;
      },
      undefined,
      { timeout: 6000 }
    );
    console.log('órdenes · brecha: Kobra 2 llegó, brechó, abrió la puerta y entró');
  } catch (error) {
    fail(`órdenes · brecha: ${error.message.split('\n')[0]}`);
  }
}

async function comprobarSonda(page, url) {
  try {
    await iniciar(page, url);
    await page.keyboard.press('Digit4');
    await page.waitForFunction(
      (puertaId) =>
        window.__eko?.snapshot()?.world.doors.find((puerta) => puerta.id === puertaId)
          ?.mirrored === true,
      PUERTA,
      { timeout: 6000 }
    );

    const estado = await leerEstado(page);
    const puerta = estado?.world.doors.find((item) => item.id === PUERTA);
    if (!puerta?.mirrored) {
      fail('órdenes · sonda: la puerta no quedó marcada por la sonda óptica');
      return;
    }
    if (estado?.squad?.command !== 'HOLD' || estado.squad.target !== null) {
      fail(
        `órdenes · sonda: la orden no terminó en HOLD sin objetivo (${JSON.stringify(estado?.squad)})`
      );
      return;
    }
    console.log('órdenes · sonda: Kobra 2 llegó, sondeó la puerta y pasó a HOLD');
  } catch (error) {
    fail(`órdenes · sonda: ${error.message.split('\n')[0]}`);
  }
}

/**
 * La orden debe nacer del menú contextual y apuntar a la puerta pulsada.
 * Durante el trayecto no puede cambiar de puerta, desviarse a otra cerrada ni
 * abrir una distinta antes de abrir la objetivo.
 */
async function comprobarContextMenuPuerta(page, url) {
  try {
    await iniciar(page, url, { asentarMs: 400 });
    await abrirPuertaDeEntrada(page);

    const antes = await leerEstado(page);
    const puertaObjetivo = antes?.world.doors.find((puerta) => puerta.id === PUERTA_CONTEXTUAL);
    if (!antes?.player || !antes.squad || !puertaObjetivo) {
      fail('órdenes · contexto: falta el jugador, Kobra-2 o la puerta objetivo');
      return;
    }
    if (puertaObjetivo.isOpen || puertaObjetivo.isBreached) {
      fail(`órdenes · contexto: ${puertaObjetivo.name} ya estaba abierta antes de la orden`);
      return;
    }

    const midX = (puertaObjetivo.x1 + puertaObjetivo.x2) * 0.5;
    const midY = (puertaObjetivo.y1 + puertaObjetivo.y2) * 0.5;
    await acercarJugadorHastaVer(page, midX, midY);
    const pantalla = await page.evaluate(
      ({ x, y }) => window.__eko.worldToScreen(x, y),
      { x: midX, y: midY }
    );
    if (
      !pantalla ||
      pantalla.x < 0 ||
      pantalla.y < 0 ||
      pantalla.x > 1280 ||
      pantalla.y > 800
    ) {
      fail(`órdenes · contexto: la puerta objetivo no está visible (${JSON.stringify(pantalla)})`);
      return;
    }

    // Clic derecho real sobre el canvas: el menú debe identificar esa puerta.
    await page.mouse.click(pantalla.x, pantalla.y, { button: 'right' });
    await page.getByText(`PUERTA: ${puertaObjetivo.name}`).waitFor({ timeout: 3000 });
    await page.getByRole('button', { name: /Brechar y Despejar/ }).click();

    await page.waitForFunction(
      (id) => {
        const escuadra = window.__eko?.snapshot()?.squad;
        return escuadra?.command === 'BREACH_AND_CLEAR' && escuadra.doorTargetId === id;
      },
      PUERTA_CONTEXTUAL,
      { timeout: 3000 }
    );

    const objetivo = (await leerBinomio(page))?.target;
    if (!objetivo) {
      fail('órdenes · contexto: la orden no fijó una posición de pila');
      return;
    }
    const distanciaObjetivo = Math.hypot(objetivo.x - midX, objetivo.y - midY);
    if (distanciaObjetivo > 90) {
      fail(
        `órdenes · contexto: la pila quedó a ${distanciaObjetivo.toFixed(1)} px de ${puertaObjetivo.name}`
      );
      return;
    }

    const puertasAbiertasAntes = new Set(
      antes.world.doors
        .filter((puerta) => puerta.isOpen || puerta.isBreached || puerta.isDestroyed)
        .map((puerta) => puerta.id)
    );
    const SEGUNDOS_DE_JUEGO = 8;
    const TOPE_DE_PARED_SEGUNDOS = 120;
    const tiempoInicial = antes.tiempo ?? 0;
    const inicioDePared = Date.now();
    let objetivoAbierto = false;

    for (;;) {
      await page.waitForTimeout(100);
      const actual = await leerEstado(page);
      if (!actual?.squad) {
        fail('órdenes · contexto: desapareció Kobra-2 durante el trayecto');
        return;
      }

      const puerta = actual.world.doors.find((item) => item.id === PUERTA_CONTEXTUAL);
      if (puerta?.isOpen || puerta?.isBreached) {
        objetivoAbierto = true;
        break;
      }
      if (actual.squad.command !== 'BREACH_AND_CLEAR') {
        fail(`órdenes · contexto: la orden cambió a ${actual.squad.command} antes de llegar`);
        return;
      }
      if (actual.squad.doorTargetId !== PUERTA_CONTEXTUAL) {
        fail(
          `órdenes · contexto: la puerta objetivo cambió a ${actual.squad.doorTargetId ?? 'ninguna'}`
        );
        return;
      }

      const otraAbierta = actual.world.doors.find(
        (item) =>
          item.id !== PUERTA_CONTEXTUAL &&
          !puertasAbiertasAntes.has(item.id) &&
          (item.isOpen || item.isBreached || item.isDestroyed)
      );
      if (otraAbierta) {
        fail(`órdenes · contexto: se abrió otra puerta antes de llegar (${otraAbierta.id})`);
        return;
      }

      // El presupuesto se gasta en tiempo de simulación, no de reloj: el motor
      // avanza como mucho `PASO_MAXIMO` (50 ms) por fotograma, así que con la CPU
      // cargada un segundo de juego cuesta varios de pared. Este trayecto tarda
      // unos 3 s de simulación; se le dan 8. El tope de pared solo cubre que la
      // simulación se detenga de verdad (pausa o excepción bajo el motor).
      const jugado = (actual.tiempo ?? 0) - tiempoInicial;
      if (jugado >= SEGUNDOS_DE_JUEGO || Date.now() - inicioDePared >= TOPE_DE_PARED_SEGUNDOS * 1000) {
        break;
      }
    }

    if (!objetivoAbierto) {
      const final = await leerEstado(page);
      const jugado = (final?.tiempo ?? 0) - tiempoInicial;
      const pared = (Date.now() - inicioDePared) / 1000;
      const entrada = final?.world.doors.find((item) => item.id === 'DOOR_MAIN_A');
      // Un mueble procedural junto al vano explicaría la pila parada: se listan los
      // que bloquean movimiento a menos de 70 px de ella.
      const alrededor = (final?.world.furniture ?? [])
        .filter(
          (m) =>
            m.blocksMovement &&
            Math.hypot((m.x ?? 0) - (final?.squad?.x ?? 0), (m.y ?? 0) - (final?.squad?.y ?? 0)) < 70
        )
        .map((m) => `${m.label ?? m.id} en ${Math.round(m.x)},${Math.round(m.y)} (${m.w}x${m.h})`);
      fail(
        `órdenes · contexto: Kobra-2 no abrió ${puertaObjetivo.name} en ${jugado.toFixed(1)} s de simulación (${pared.toFixed(1)} s de pared; pila en ${Math.round(final?.squad?.x ?? -1)},${Math.round(final?.squad?.y ?? -1)} objetivo ${final?.squad?.target ? `${Math.round(final.squad.target.x)},${Math.round(final.squad.target.y)}` : 'ninguno'}; operador en ${Math.round(final?.player?.x ?? -1)},${Math.round(final?.player?.y ?? -1)} danger ${final?.player?.danger ?? '?'}; entrada abierta ${entrada?.isOpen ?? '?'} del todo ${entrada?.isFullyOpen ?? '?'}; muebles cerca: ${alrededor.length ? alrededor.join(', ') : 'ninguno'})`
      );
      return;
    }

    const puertasFinales = await leerPuertas(page);
    const puertaFinal = puertasFinales.find((puerta) => puerta.id === PUERTA_CONTEXTUAL);
    if (!puertaFinal?.isOpen) {
      fail(`órdenes · contexto: ${puertaObjetivo.name} no quedó abierta`);
      return;
    }
    const otraFinal = puertasFinales.find(
      (puerta) =>
        puerta.id !== PUERTA_CONTEXTUAL &&
        !puertasAbiertasAntes.has(puerta.id) &&
        (puerta.isOpen || puerta.isBreached || puerta.isDestroyed)
    );
    if (otraFinal) {
      fail(`órdenes · contexto: también quedó abierta otra puerta (${otraFinal.id})`);
      return;
    }
    console.log('órdenes · contexto: Kobra 2 respetó la puerta del menú y no abrió otra');
  } catch (error) {
    fail(`órdenes · contexto: ${error.message.split('\n')[0]}`);
  }
}

/** Arranca Mission 1 después de equipar el ariete desde el plan pre-misión. */
async function iniciarConAriete(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();

  const dialogo = page.getByRole('dialog', { name: /Blaupause/ });
  await dialogo.waitFor({ timeout: 10000 });
  await dialogo.getByRole('button', { name: /04\. Equipamiento de Kobra-2/ }).click();
  await dialogo.getByRole('button', { name: /Türramme/ }).click();
  await pulsarConAzarSembrado(dialogo.getByRole('button', { name: /Iniciar Intervención/ }));

  await page.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
  await page.waitForFunction(
    () => {
      const estado = window.__eko?.snapshot();
      return estado?.gameState === 'PLAYING' && estado.player !== null;
    },
    undefined,
    { timeout: 20000 }
  );
  await page.waitForTimeout(400);
}

/**
 * Avanza al operador hasta que un punto del mundo caiga dentro del viewport.
 *
 * El encuadre se asienta con el zoom de la misión: con el mundo ya sembrado, el
 * asentamiento termina antes y una puerta al borde puede quedar a 25 px de más.
 * En vez de fiarse del instante, se camina lo justo hasta verla para poder
 * pulsarla con el botón derecho.
 */
async function acercarJugadorHastaVer(page, x, y) {
  const enPantalla = ({ wx, wy }) => {
    const punto = window.__eko?.worldToScreen(wx, wy);
    return !!punto && punto.x >= 0 && punto.y >= 0 && punto.x <= 1280 && punto.y <= 800;
  };
  if (await page.evaluate(enPantalla, { wx: x, wy: y })) return;

  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(enPantalla, { wx: x, wy: y }, { timeout: 5000 });
  } finally {
    await page.keyboard.up('KeyD');
  }
  await page.waitForTimeout(300);
}

/** Acerca al operador para que la puerta objetivo quede dentro del viewport. */
async function acercarJugadorDerecha(page, xObjetivo) {
  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(
      (x) => (window.__eko?.snapshot()?.player?.x ?? x) >= x,
      xObjetivo,
      { timeout: 6000 }
    );
  } finally {
    await page.keyboard.up('KeyD');
  }
  await page.waitForTimeout(300);
}

/** Pulsa con el botón derecho la puerta indicada y elige la orden de brecha. */
async function apuntarPuertaYBrechar(page, puertaId) {
  const puerta = await leerPuerta(page, puertaId);
  if (!puerta) throw new Error(`no existe la puerta ${puertaId}`);
  if (puerta.isOpen || puerta.isBreached) throw new Error(`${puerta.name} ya estaba abierta`);

  const midX = (puerta.x1 + puerta.x2) * 0.5;
  const midY = (puerta.y1 + puerta.y2) * 0.5;
  const pantalla = await page.evaluate(
    ({ x, y }) => window.__eko.worldToScreen(x, y),
    { x: midX, y: midY }
  );
  if (!pantalla || pantalla.x < 0 || pantalla.y < 0 || pantalla.x > 1280 || pantalla.y > 800) {
    throw new Error(`${puerta.name} no está visible (${JSON.stringify(pantalla)})`);
  }

  await page.mouse.click(pantalla.x, pantalla.y, { button: 'right' });
  await page.getByText(`PUERTA: ${puerta.name}`).waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: /Brechar y Despejar/ }).click();
  await page.waitForFunction(
    (id) => {
      const escuadra = window.__eko?.snapshot()?.squad;
      return escuadra?.command === 'BREACH_AND_CLEAR' && escuadra.doorTargetId === id;
    },
    puertaId,
    { timeout: 3000 }
  );
}

/** Espera a que la acción esté en curso con la puerta todavía cerrada. */
async function esperarAccionEnCurso(page, mode, puertaId) {
  await page.waitForFunction(
    ({ modo, id }) => {
      const estado = window.__eko?.snapshot();
      const escuadra = estado?.squad;
      const puerta = estado?.world.doors.find((item) => item.id === id);
      return (
        escuadra?.breachMode === modo &&
        (escuadra.breachProgress ?? 0) > 0 &&
        (escuadra.breachProgress ?? Infinity) < (escuadra.breachMaxProgress ?? Infinity) &&
        puerta != null &&
        !puerta.isOpen &&
        !puerta.isBreached
      );
    },
    { modo: mode, id: puertaId },
    { timeout: 12000 }
  );
  return leerEstado(page);
}

/**
 * Vigila toda la acción: la puerta debe seguir cerrada y el C4 intacto hasta
 * que la brecha termina. Devuelve la instantánea justo después de abrirse.
 */
async function esperarPuertaBrechada(page, puertaId, mode, c4Inicial) {
  for (let intento = 0; intento < 140; intento++) {
    await page.waitForTimeout(50);
    const estado = await leerEstado(page);
    const puerta = estado?.world.doors.find((item) => item.id === puertaId);
    if (puerta?.isOpen || puerta?.isBreached) {
      if (estado?.squad?.breachMode != null) {
        throw new Error(`se abrió antes de completar la acción (${mode})`);
      }
      return estado;
    }
    if (estado?.squad?.breachMode !== mode) {
      throw new Error(`la acción ${mode} terminó sin abrir la puerta`);
    }
    if (estado.c4Count !== c4Inicial) {
      throw new Error(`consumió C4 antes de completar la acción (${c4Inicial} -> ${estado.c4Count})`);
    }
  }
  throw new Error(`la acción ${mode} no abrió la puerta a tiempo`);
}

async function comprobarArieteKobra2(page, url) {
  try {
    await iniciarConAriete(page, url);
    const antes = await leerEstado(page);
    if (antes?.squadGear !== 'RAM') {
      fail(`órdenes · ariete: el plan no quedó con Türramme (${antes?.squadGear})`);
      return;
    }
    const puertaAntes = antes.world.doors.find((puerta) => puerta.id === PUERTA_RAM);
    if (!puertaAntes?.isLocked || puertaAntes.isOpen) {
      fail('órdenes · ariete: la puerta de entrada no está cerrada con llave');
      return;
    }

    const c4Inicial = antes.c4Count;
    await apuntarPuertaYBrechar(page, PUERTA_RAM);
    const enCurso = await esperarAccionEnCurso(page, 'RAM', PUERTA_RAM);
    if (enCurso?.c4Count !== c4Inicial) {
      fail(`órdenes · ariete: consumió C4 durante la acción (${c4Inicial} -> ${enCurso?.c4Count})`);
      return;
    }

    const final = await esperarPuertaBrechada(page, PUERTA_RAM, 'RAM', c4Inicial);
    const puertaFinal = final?.world.doors.find((puerta) => puerta.id === PUERTA_RAM);
    if (!puertaFinal?.isBreached) {
      fail('órdenes · ariete: la puerta no quedó brechada');
      return;
    }
    if (final?.c4Count !== c4Inicial) {
      fail(`órdenes · ariete: el ariete consumió C4 (${c4Inicial} -> ${final?.c4Count})`);
      return;
    }
    console.log(
      `órdenes · ariete: puerta cerrada hasta completar la acción; C4 intacto (${c4Inicial})`
    );
  } catch (error) {
    fail(`órdenes · ariete: ${error.message.split('\n')[0]}`);
  }
}

async function comprobarC4Kobra2(page, url) {
  try {
    await arrancarMision(page, url, MISION_LINZ, { asentarMs: 400 });
    const antes = await leerEstado(page);
    if (antes?.squadGear !== 'SHIELD') {
      fail(`órdenes · C4: se esperaba el equipo estándar, no ${antes?.squadGear}`);
      return;
    }
    const puertaAntes = antes.world.doors.find((puerta) => puerta.id === PUERTA_C4);
    if (!puertaAntes?.isLocked || puertaAntes.isOpen) {
      fail('órdenes · C4: el portón blindado no está cerrado con llave');
      return;
    }
    const c4Inicial = antes.c4Count;
    if (c4Inicial < 1) {
      fail('órdenes · C4: no hay cargas disponibles para probar la rama');
      return;
    }

    // El portón B está lejos del spawn; el operador debe acercarse para que el
    // clic derecho caiga dentro del viewport y el menú apunte a esa puerta.
    await acercarJugadorDerecha(page, 600);
    await apuntarPuertaYBrechar(page, PUERTA_C4);
    const enCurso = await esperarAccionEnCurso(page, 'C4', PUERTA_C4);
    if (enCurso?.c4Count !== c4Inicial) {
      fail(`órdenes · C4: consumió la carga antes de terminar (${c4Inicial} -> ${enCurso?.c4Count})`);
      return;
    }

    const final = await esperarPuertaBrechada(page, PUERTA_C4, 'C4', c4Inicial);
    const puertaFinal = final?.world.doors.find((puerta) => puerta.id === PUERTA_C4);
    if (!puertaFinal?.isBreached) {
      fail('órdenes · C4: el portón no quedó brechado');
      return;
    }
    if (final?.c4Count !== c4Inicial - 1) {
      fail(`órdenes · C4: consumo incorrecto (${c4Inicial} -> ${final?.c4Count})`);
      return;
    }
    console.log(
      `órdenes · C4: puerta cerrada hasta completar la acción; carga consumida (${c4Inicial} -> ${final.c4Count})`
    );
  } catch (error) {
    fail(`órdenes · C4: ${error.message.split('\n')[0]}`);
  }
}

/** Comprueba burbujas y mensajes de radio del binomio, sin voz sintética. */
async function comprobarBurbujasBinomio(page, url) {
  try {
    await arrancarMision(page, url, MISION, { asentarMs: 800 });

    let burbujaKobra1Vista = false;
    let burbujaKobra2Vista = false;
    const capturar = async () => {
      const estado = await page.evaluate(() => {
        const snapshot = window.__eko?.snapshot();
        return {
          radioFeed: snapshot?.radioFeed ?? [],
          burbujaKobra1: snapshot?.player?.speechBubble?.text ?? null,
          burbujaKobra2: snapshot?.squad?.speechBubble?.text ?? null,
        };
      });
      if (estado.burbujaKobra1) burbujaKobra1Vista = true;
      if (estado.burbujaKobra2) burbujaKobra2Vista = true;
      return estado;
    };

    // Comprobación visual de la burbuja de Kobra-2: no alcanza con leer
    // speechBubble; contamos píxeles ámbar en la banda donde el canvas pinta
    // el texto, comparando antes y durante la burbuja con Kobra-2 quieto.
    await page.waitForFunction(
      () => !window.__eko?.snapshot()?.squad?.speechBubble,
      undefined,
      { timeout: 3500 }
    );
    const medirBurbujaKobra2EnCanvas = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const estado = window.__eko?.snapshot();
        const squad = estado?.squad;
        if (!canvas || !squad) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const rect = canvas.getBoundingClientRect();
        const dpr = rect.width > 0 ? canvas.width / rect.width : 1;
        const centro = window.__eko.worldToScreen(squad.x, squad.y);
        const arriba = window.__eko.worldToScreen(
          squad.x,
          squad.y - (squad.radius + 50)
        );
        const abajo = window.__eko.worldToScreen(
          squad.x,
          squad.y - (squad.radius + 24)
        );

        const left = Math.max(0, Math.floor((centro.x - 220) * dpr));
        const right = Math.min(canvas.width, Math.ceil((centro.x + 220) * dpr));
        const top = Math.max(0, Math.floor(Math.min(arriba.y, abajo.y) * dpr));
        const bottom = Math.min(canvas.height, Math.ceil(Math.max(arriba.y, abajo.y) * dpr));
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) return null;

        const data = ctx.getImageData(left, top, width, height).data;
        let amarillos = 0;
        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - 251;
          const dg = data[i + 1] - 191;
          const db = data[i + 2] - 36;
          // El texto COMMAND de Kobra-2 se pinta con #FBBF24; el umbral
          // tolera el antialiasing sin confundirlo con el HUD cian o blanco.
          if (dr * dr + dg * dg + db * db <= 75 * 75) amarillos += 1;
        }
        return {
          amarillos,
          texto: squad.speechBubble?.text ?? null,
          x: squad.x,
          y: squad.y,
          region: { left, top, width, height },
        };
      });

    const sinBurbuja = await medirBurbujaKobra2EnCanvas();
    if (!sinBurbuja) {
      fail('burbujas · binomio: no se pudo leer la región de la burbuja en el canvas');
      return;
    }

    await page.keyboard.press('Digit2');
    await page.waitForFunction(
      () => window.__eko?.snapshot()?.squad?.speechBubble?.text === 'Sichere diesen Sektor!',
      undefined,
      { timeout: 3000 }
    );
    const orden = await capturar();
    if (!orden.burbujaKobra2) {
      fail('burbujas · binomio: Kobra-2 no mostró burbuja al recibir HOLD');
      return;
    }
    if (!orden.radioFeed.some((item) => item.speaker === 'KOBRA-2' && /Position gehalten/i.test(item.text))) {
      fail('burbujas · binomio: el HOLD de Kobra-2 no generó su mensaje de radio');
      return;
    }
    const conBurbuja = await medirBurbujaKobra2EnCanvas();
    if (!conBurbuja) {
      fail('burbujas · binomio: no se pudo medir la burbuja de Kobra-2 en el canvas');
      return;
    }
    if (!conBurbuja.texto) {
      fail('burbujas · binomio: la burbuja de Kobra-2 desapareció antes de medirla');
      return;
    }
    if (Math.abs(conBurbuja.x - sinBurbuja.x) > 0.5 || Math.abs(conBurbuja.y - sinBurbuja.y) > 0.5) {
      fail('burbujas · binomio: Kobra-2 se movió entre las dos mediciones del canvas');
      return;
    }
    const pixelesAmarillosNuevos = conBurbuja.amarillos - sinBurbuja.amarillos;
    if (conBurbuja.amarillos < 8 || pixelesAmarillosNuevos < 5) {
      fail(
        `burbujas · binomio: la burbuja de Kobra-2 no se ve en el canvas (ámbar ${sinBurbuja.amarillos} -> ${conBurbuja.amarillos}; región ${JSON.stringify(conBurbuja.region)})`
      );
      return;
    }
    console.log(
      `burbujas · binomio: Kobra-2 visible en canvas (${sinBurbuja.amarillos} -> ${conBurbuja.amarillos} píxeles ámbar)`
    );

    // Kobra-1: grito policial para su burbuja.
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => Boolean(window.__eko?.snapshot()?.player?.speechBubble?.text),
      undefined,
      { timeout: 3000 }
    );
    const kobra1Grito = await capturar();
    if (!kobra1Grito.burbujaKobra1) {
      fail('burbujas · binomio: Kobra-1 no mostró burbuja al ejecutar el grito policial');
      return;
    }

    // Kobra-1: linterna táctica para un mensaje de radio propio.
    await page.keyboard.press('KeyL');
    await page.waitForFunction(
      () => {
        const feed = window.__eko?.snapshot()?.radioFeed ?? [];
        return feed.some(
          (item) =>
            item.speaker === 'KOBRA-1' && /eingeschaltet|ausgeschaltet/i.test(item.text)
        );
      },
      undefined,
      { timeout: 3000 }
    );
    const kobra1Radio = await capturar();
    if (!kobra1Radio.radioFeed.some(
      (item) => item.speaker === 'KOBRA-1' && /eingeschaltet|ausgeschaltet/i.test(item.text)
    )) {
      fail('burbujas · binomio: Kobra-1 no generó su mensaje de radio de linterna');
      return;
    }
    if (!burbujaKobra1Vista || !burbujaKobra2Vista) {
      fail('burbujas · binomio: faltó la burbuja visible de alguna mitad');
      return;
    }

    console.log('burbujas · binomio: burbujas y radio presentes, sin voz sintética');
  } catch (error) {
    fail(`burbujas · binomio: ${error.message.split('\n')[0]}`);
  }
}

async function comprobarHoldCancelaBrecha(page, url) {
  try {
    // Sin espera de asentamiento ni pausa entre ambas teclas: la cancelación
    // debe ocurrir antes del siguiente frame, no depender de la velocidad del runner.
    await iniciar(page, url, { asentarMs: 0 });
    await page.keyboard.press('Digit3');

    // Si la tecla 3 no se procesó, el test no debe pasar por la simple ausencia
    // de brecha: primero exigimos que el objetivo de brecha esté realmente fijado.
    const pendiente = await page.evaluate(() => window.__eko?.snapshot()?.squad ?? null);
    if (pendiente?.command !== 'BREACH_AND_CLEAR' || !pendiente.target) {
      fail(
        `órdenes · HOLD: la tecla 3 no fijó un objetivo de brecha antes de cancelar (${JSON.stringify(pendiente)})`
      );
      return;
    }

    await page.keyboard.press('Digit2');

    await page.waitForFunction(
      () => {
        const estado = window.__eko?.snapshot();
        return estado?.squad?.command === 'HOLD' && estado.squad.target === null;
      },
      undefined,
      { timeout: 2000 }
    );

    // El trayecto a la puerta tarda más que este margen; si HOLD no hubiera
    // cancelado el destino, la brecha ya se habría producido.
    await page.waitForTimeout(1400);
    const puerta = await leerPuerta(page);
    if (puerta?.isBreached || puerta?.isOpen) {
      fail(`órdenes · HOLD: la brecha pendiente se ejecutó igualmente (${JSON.stringify(puerta)})`);
      return;
    }
    console.log('órdenes · HOLD: el avance pendiente se canceló antes de la brecha');
  } catch (error) {
    fail(`órdenes · HOLD: ${error.message.split('\n')[0]}`);
  }
}

/** Pulsa [E] hasta dejar la puerta franca; false si no lo logra. */
async function abrirPuertaPorCompleto(page, puertaId) {
  await acercarseAPuerta(page, puertaId);
  const leer = () =>
    page.evaluate(
      (id) => window.__eko?.snapshot()?.world.doors.find((puerta) => puerta.id === id) ?? null,
      puertaId
    );
  for (let paso = 0; paso < 8; paso += 1) {
    const puerta = await leer();
    if (puerta?.isFullyOpen === true) return true;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(160);
  }
  return (await leer())?.isFullyOpen === true;
}

/** Camina en vertical hasta cruzar `objetivo` en y. */
async function caminarHastaY(page, tecla, objetivo) {
  await page.keyboard.down(tecla);
  try {
    await page.waitForFunction(
      ({ tecla, objetivo }) => {
        const jugador = window.__eko?.snapshot()?.player;
        if (!jugador) return false;
        return tecla === 'KeyW' ? jugador.y <= objetivo : jugador.y >= objetivo;
      },
      { tecla, objetivo },
      { timeout: 6000 }
    );
  } finally {
    await page.keyboard.up(tecla);
  }
  await page.waitForTimeout(150);
}

/** Grita hasta que el sospechoso suelte el arma. */
async function rendirSospechoso(page, nombre) {
  for (let grito = 0; grito < 8; grito += 1) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
    const rendido = await page.evaluate(
      (quien) =>
        (window.__eko?.snapshot()?.radioFeed ?? []).some(
          (linea) => linea.text.includes(quien) && /Waffe fallengelassen/.test(linea.text)
        ),
      nombre
    );
    if (rendido) return true;
  }
  return false;
}

/**
 * Ruta por puertas de SUPRESIÓN desde el rellano.
 *
 * Con Kobra-2 en la escalera y la entrada cerrada, [7] fija como objetivo al
 * sospechoso que el operador ve en la cocina (otra estancia). La recta desde el
 * rellano se clavaba en la pared; ahora el binomio abre la entrada, cruza el
 * recibidor y entra a la cocina para ejecutar la supresión.
 *
 * El grito previo con la puerta cerrada rinde al sospechoso: un rendido deja de
 * abortar la marcha por «hostil en tránsito» a 260 px, así que la llegada no
 * depende de su puntería. Se grita con la hoja puesta por la misma razón: el
 * muro amortigua la moral y no hay fuego cruzado.
 */
async function comprobarSupresionDesdeRellano(page, url) {
  try {
    await iniciar(page, url, { asentarMs: 400 });
    // HOLD antes de moverse: en FOLLOW el binomio sigue al operador y puede cruzar el
    // vano durante la preparación, con lo que dejaría de estar en el rellano.
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.__eko?.snapshot()?.squad?.command === 'HOLD', undefined, {
      timeout: 5000,
    });
    await abrirPuertaDeEntrada(page);
    await acercarJugadorDerecha(page, 300);
    if (!(await cerrarPuertaDeEntrada(page))) {
      fail(`órdenes · supresión: ${PUERTA} no queda cerrada antes de la orden`);
      return;
    }
    await acercarJugadorDerecha(page, 390);
    await caminarHastaY(page, 'KeyW', 330);

    if (!(await rendirSospechoso(page, 'Lukas'))) {
      fail('órdenes · supresión: Lukas no se rindió con el grito antes de [7]');
      return;
    }
    if (!(await abrirPuertaPorCompleto(page, 'DOOR_KITCHEN'))) {
      fail('órdenes · supresión: la puerta de la cocina no queda franca para [7]');
      return;
    }

    const antes = await leerEstado(page);
    const puertaEntrada = antes?.world.doors.find((puerta) => puerta.id === PUERTA);
    const puertaCocina = antes?.world.doors.find((puerta) => puerta.id === 'DOOR_KITCHEN');
    const puertaSalon = antes?.world.doors.find((puerta) => puerta.id === PUERTA_CONTEXTUAL);
    const puertaBano = antes?.world.doors.find((puerta) => puerta.id === 'DOOR_BATH');
    if (!antes?.player || !antes.squad || !puertaEntrada || !puertaCocina || !puertaSalon) {
      fail('órdenes · supresión: falta el jugador, Kobra-2 o alguna puerta de la ruta');
      return;
    }
    if (puertaEntrada.isOpen) {
      fail(`órdenes · supresión: ${PUERTA} ya estaba abierta antes de la orden`);
      return;
    }
    if (antes.squad.x >= puertaEntrada.x2) {
      fail(`órdenes · supresión: Kobra-2 no espera en el rellano (x ${antes.squad.x.toFixed(1)})`);
      return;
    }
    const jugadorAntes = { x: antes.player.x, y: antes.player.y };

    await page.keyboard.press('Digit7');
    let objetivo = null;
    try {
      await page.waitForFunction(
        () => {
          const estado = window.__eko?.snapshot();
          return (
            estado?.squad?.command === 'SUPPRESS_TARGET' &&
            estado.squad.target !== null &&
            (estado.radioFeed ?? []).some((linea) => /\[7\]/.test(linea.text))
          );
        },
        undefined,
        { timeout: 5000 }
      );
      objetivo = (await leerBinomio(page))?.target ?? null;
    } catch {
      fail('órdenes · supresión: [7] no fijó objetivo ni anunció la orden');
      return;
    }
    if (!objetivo || !(objetivo.y < puertaCocina.y1)) {
      fail(
        'órdenes · supresión: el objetivo de [7] no cae en otra estancia ' +
          `(${objetivo ? `${objetivo.x.toFixed(1)}, ${objetivo.y.toFixed(1)}` : 'sin objetivo'})`
      );
      return;
    }

    // Recibidor deducido de las puertas que lo rodean, para ver que la ruta lo cruza.
    const recibidor = {
      x1: puertaEntrada.x2,
      x2: puertaSalon.x1,
      y1: puertaCocina.y1,
      y2: puertaBano?.y1 ?? 540,
    };
    let pasoRecibidor = false;
    let llegada = null;
    const limite = Date.now() + 30000;
    while (Date.now() < limite) {
      const estado = await page.evaluate(() => window.__eko?.snapshot() ?? null);
      const escuadra = estado?.squad ?? null;
      if (!escuadra) break;
      if (
        escuadra.x > recibidor.x1 &&
        escuadra.x < recibidor.x2 &&
        escuadra.y > recibidor.y1 &&
        escuadra.y < recibidor.y2
      ) {
        pasoRecibidor = true;
      }
      if ((estado.radioFeed ?? []).some((linea) => /Fuego de supresión/.test(linea.text))) {
        llegada = escuadra;
        break;
      }
      await page.waitForTimeout(120);
    }
    if (!llegada) {
      const escuadra = await leerBinomio(page);
      const puerta = await leerPuerta(page);
      fail(
        'órdenes · supresión: Kobra-2 no llegó a suprimir al objetivo de la cocina ' +
          `(${escuadra ? `${escuadra.x.toFixed(1)}, ${escuadra.y.toFixed(1)}` : 'sin escuadra'}; ` +
          `recibidor ${pasoRecibidor ? 'sí' : 'no'}; ${PUERTA} ` +
          `${puerta ? `${puerta.isOpen ? 'abierta' : 'cerrada'}/` : '?'}` +
          `${puerta?.isLocked ? 'con llave' : 'sin llave'})`
      );
      return;
    }
    if (Math.hypot(llegada.x - objetivo.x, llegada.y - objetivo.y) > 45) {
      fail(
        'órdenes · supresión: la orden se cumplió lejos del objetivo ' +
          `(${Math.hypot(llegada.x - objetivo.x, llegada.y - objetivo.y).toFixed(1)} px)`
      );
      return;
    }
    await page.waitForFunction(
      () => {
        const estado = window.__eko?.snapshot();
        return estado?.squad?.command === 'HOLD' && estado.squad.target === null;
      },
      undefined,
      { timeout: 5000 }
    );

    const despues = await leerEstado(page);
    const entradaDespues = despues?.world.doors.find((puerta) => puerta.id === PUERTA);
    if (!entradaDespues?.isFullyOpen) {
      fail(`órdenes · supresión: Kobra-2 no abrió ${PUERTA} para cruzar el piso`);
      return;
    }
    if (!pasoRecibidor) {
      fail('órdenes · supresión: la ruta no pasó por el recibidor entre el rellano y la cocina');
      return;
    }
    // El operador no se movió: la puerta la abrió Kobra-2.
    if (
      Math.abs((despues?.player?.x ?? 0) - jugadorAntes.x) > 1.5 ||
      Math.abs((despues?.player?.y ?? 0) - jugadorAntes.y) > 1.5
    ) {
      fail('órdenes · supresión: el operador se movió y pudo haber abierto la puerta él mismo');
      return;
    }
    console.log(
      'órdenes · supresión: con Kobra 2 en el rellano, [7] abrió la entrada, cruzó el ' +
        'recibidor y llegó al objetivo de la cocina en vez de clavarse en la pared'
    );
  } catch (error) {
    fail(`órdenes · supresión: ${error.message.split('\n')[0]}`);
  }
}

/** Cierra la puerta de entrada con el jugador al lado; false si no lo logra. */
async function cerrarPuertaDeEntrada(page) {
  await acercarseAPuerta(page, PUERTA);
  for (let paso = 0; paso < 8; paso += 1) {
    const puerta = await leerPuerta(page);
    if (puerta && puerta.isOpen === false) return true;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(160);
  }
  return (await leerPuerta(page))?.isOpen === false;
}

/**
 * Ruta por puertas de un punto marcado en el EKO-Pad.
 *
 * El operador marca desde el recibidor un PUNTO DE AVANCE en el salón y Kobra-2
 * espera en la escalera con la puerta de entrada cerrada. Para llegar tiene que
 * abrir esa puerta, cruzar el recibidor y abrir también la del salón: la recta
 * se clava en la pared del piso. El humo no ejercía ni [7] ni waypoints, así que
 * esta ruta sólo estaba cubierta por los tests de motor.
 */
async function comprobarPuntoEnPad(page, url) {
  try {
    await iniciar(page, url, { asentarMs: 400 });
    // HOLD antes de moverse: en FOLLOW el binomio sigue al operador y puede quedar ya
    // dentro del recibidor cuando llega la orden, así que no sirve como punto de
    // partida en la escalera.
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.__eko?.snapshot()?.squad?.command === 'HOLD', undefined, {
      timeout: 5000,
    });
    await abrirPuertaDeEntrada(page);
    await acercarJugadorDerecha(page, 300);
    if (!(await cerrarPuertaDeEntrada(page))) {
      fail(
        `órdenes · punto: ${PUERTA} no queda cerrada antes de marcar el punto ` +
          `(${await distanciaAPuerta(page, PUERTA)})`
      );
      return;
    }
    await acercarJugadorDerecha(page, 390);

    const antes = await leerEstado(page);
    const puertaEntrada = antes?.world.doors.find((puerta) => puerta.id === PUERTA);
    const puertaSalon = antes?.world.doors.find((puerta) => puerta.id === PUERTA_CONTEXTUAL);
    const puertaCocina = antes?.world.doors.find((puerta) => puerta.id === 'DOOR_KITCHEN');
    const puertaBano = antes?.world.doors.find((puerta) => puerta.id === 'DOOR_BATH');
    if (!antes?.player || !antes.squad || !puertaEntrada || !puertaSalon) {
      fail('órdenes · punto: falta el jugador, Kobra-2 o alguna puerta de la ruta');
      return;
    }
    if (puertaEntrada.isOpen || puertaSalon.isOpen) {
      fail('órdenes · punto: una puerta de la ruta ya estaba abierta antes de la orden');
      return;
    }
    if (antes.squad.x >= puertaEntrada.x2) {
      fail(`órdenes · punto: Kobra-2 no espera en la escalera (x ${antes.squad.x.toFixed(1)})`);
      return;
    }
    const jugadorAntes = { x: antes.player.x, y: antes.player.y };

    // El punto sale del EKO-Pad, no de una tecla: PUNTO DE AVANCE sobre el mapa.
    // `marcarPuntoDeAvance` abre el pad, proyecta el punto con `MAPA_PAD`, pulsa
    // el mapa, espera la confirmación y cierra el pad.
    if (!(await marcarPuntoDeAvance(page, PUNTO_PAD))) {
      fail(
        'órdenes · punto: el EKO-Pad no fijó el PUNTO DE AVANCE del salón ' +
          `(${JSON.stringify(PUNTO_PAD)})`
      );
      return;
    }

    // Recibidor deducido de las puertas que lo rodean: entre la de entrada y la
    // del salón, de la cocina al baño. Sirve para ver que la ruta lo atraviesa.
    const recibidor = {
      x1: puertaEntrada.x2,
      x2: puertaSalon.x1,
      y1: puertaCocina?.y1 ?? 280,
      y2: puertaBano?.y1 ?? 540,
    };
    let pasoRecibidor = false;
    let llegada = null;
    const limite = Date.now() + 30000;
    while (Date.now() < limite) {
      const escuadra = await page.evaluate(() => window.__eko?.snapshot()?.squad ?? null);
      if (!escuadra) break;
      if (
        escuadra.x > recibidor.x1 &&
        escuadra.x < recibidor.x2 &&
        escuadra.y > recibidor.y1 &&
        escuadra.y < recibidor.y2
      ) {
        pasoRecibidor = true;
      }
      if (Math.hypot(escuadra.x - PUNTO_PAD.x, escuadra.y - PUNTO_PAD.y) < 20) {
        llegada = escuadra;
        break;
      }
      await page.waitForTimeout(120);
    }
    if (!llegada) {
      const escuadra = await page.evaluate(() => window.__eko?.snapshot()?.squad ?? null);
      fail(
        'órdenes · punto: Kobra-2 no llegó al punto del salón ' +
          `(${escuadra ? `${escuadra.x.toFixed(1)}, ${escuadra.y.toFixed(1)}` : 'sin escuadra'}; ` +
          `recibidor ${pasoRecibidor ? 'sí' : 'no'})`
      );
      return;
    }

    const despues = await leerEstado(page);
    const entradaDespues = despues?.world.doors.find((puerta) => puerta.id === PUERTA);
    const salonDespues = despues?.world.doors.find((puerta) => puerta.id === PUERTA_CONTEXTUAL);
    if (!entradaDespues?.isFullyOpen || !salonDespues?.isFullyOpen) {
      fail(
        `órdenes · punto: el binomio no dejó franca la ruta ` +
          `(${PUERTA} ${entradaDespues?.isFullyOpen === true}, ` +
          `${PUERTA_CONTEXTUAL} ${salonDespues?.isFullyOpen === true})`
      );
      return;
    }
    if (!pasoRecibidor) {
      fail('órdenes · punto: la ruta no pasó por el recibidor entre la escalera y el salón');
      return;
    }
    // El operador no se movió del recibidor: las puertas las abrió Kobra-2.
    if (
      Math.abs((despues?.player?.x ?? 0) - jugadorAntes.x) > 1.5 ||
      Math.abs((despues?.player?.y ?? 0) - jugadorAntes.y) > 1.5
    ) {
      fail('órdenes · punto: el operador se movió y pudo haber abierto las puertas él mismo');
      return;
    }
    if (despues?.squad?.command !== 'HOLD' || despues.squad.target !== null) {
      fail(
        `órdenes · punto: la orden no terminó en HOLD sin objetivo ` +
          `(${JSON.stringify(despues?.squad)})`
      );
      return;
    }
    console.log(
      'órdenes · punto del pad: Kobra 2 rodeó el piso por el recibidor, abrió las dos ' +
        'puertas y llegó al punto del salón que marcó el operador'
    );
  } catch (error) {
    fail(`órdenes · punto: ${error.message.split('\n')[0]}`);
  }
}

/** Comprueba las tres órdenes en misiones limpias. */
export async function comprobarOrdenesEscuadron(page, { url }) {
  const fallosAntes = fallos.length;
  await comprobarBrecha(page, url);
  await comprobarSonda(page, url);
  await comprobarPuntoEnPad(page, url);
  await comprobarSupresionDesdeRellano(page, url);
  await comprobarHoldCancelaBrecha(page, url);
  await comprobarContextMenuPuerta(page, url);
  await comprobarArieteKobra2(page, url);
  await comprobarC4Kobra2(page, url);
  await comprobarBurbujasBinomio(page, url);
  if (fallos.length === fallosAntes) {
    console.log(
      'órdenes · brecha, sonda, punto del pad, supresión desde el rellano, HOLD, menú ' +
        'contextual, ariete, C4 y burbujas del binomio verificadas'
    );
  }
}
