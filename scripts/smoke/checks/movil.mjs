/**
 * Móvil: en un viewport táctil (390×844) el audio se desbloquea al primer toque,
 * aparece el joystick, la palanca sigue al dedo y mueve de verdad al operador, y
 * joystick, botones, subtítulos y barra inferior no se pisan a 390, 360 y 320 px.
 */
import { fail, fallos } from '../informe.mjs';
import { vigilarPagina } from '../navegador.mjs';
import { capturarPantalla } from '../diagnostico.mjs';
import { instalarAzarDeterminista } from '../determinismo.mjs';

/** El AudioContext nace suspendido en iOS/Android: el primer toque tiene que dejarlo en running. */
async function comprobarAudio(movil) {
  const audioAntes = await movil.evaluate(async () => {
    const contextos = window.__ekoAudio ?? [];
    for (const contexto of contextos) await contexto.suspend().catch(() => {});
    return contextos.map((contexto) => contexto.state);
  });
  await movil.touchscreen.tap(195, 120);
  await movil.waitForTimeout(500);
  const audioDespues = await movil.evaluate(() => ({
    estados: (window.__ekoAudio ?? []).map((contexto) => contexto.state),
    resumes: window.__ekoResumes ?? 0,
  }));
  if (!audioDespues.estados.length) {
    fail('audio: el primer toque no creó ningún AudioContext');
  } else if (audioDespues.estados.some((estado) => estado !== 'running')) {
    fail(`audio: tras el primer toque el AudioContext sigue en ${audioDespues.estados.join('/')}`);
  } else {
    console.log(`audio: ${audioAntes[0] ?? 'sin contexto'} -> running tras el primer toque (${audioDespues.resumes} resume)`);
  }
}

/** Posición del pomo en píxeles, leída de la matriz ya resuelta (-50 % incluido). */
const leerPalanca = (movil) =>
  movil.evaluate(() => {
    const base = document.querySelector('[aria-label="Joystick de movimiento"]');
    const knob = base ? [...base.querySelectorAll('div')].find((el) => (el.style.transform ?? '').includes('translate(calc(')) : null;
    if (!knob) return null;
    const matriz = getComputedStyle(knob).transform.match(/matrix\(([^)]+)\)/);
    if (!matriz) return null;
    const valores = matriz[1].split(',').map(Number);
    return { x: Math.round(valores[4]), y: Math.round(valores[5]) };
  });

const distanciaAPomo = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);

const MISION_1 = 'Misión 1: Piso Graz - Lend';

const leerJugador = (movil) => movil.evaluate(() => window.__eko?.player ?? null);
const leerPuerta = (movil, id) =>
  movil.evaluate((puertaId) => window.__eko?.world.doors.find((item) => item.id === puertaId) ?? null, id);

/**
 * Desde el spawn, comprueba movimiento real y la puerta; después, que la palanca
 * sigue al dedo y vuelve al centro. No reinicia la misión: la primera parte usa
 * el estado inicial y deja el mundo modificado para el resto del smoke.
 */
async function comprobarJoystick(movil) {
  const joystick = movil.getByLabel('Joystick de movimiento');
  if (!(await joystick.isVisible())) fail('móvil: el joystick no aparece con hasTouch');
  if (!(await movil.getByLabel('Disparar').isVisible())) fail('móvil: falta el botón de fuego con hasTouch');

  const caja = await joystick.boundingBox();
  if (!caja) {
    fail('móvil: el joystick no tiene área pulsable');
    return;
  }

  const centroX = caja.x + caja.width / 2;
  const centroY = caja.y + caja.height / 2;

  const antes = await leerJugador(movil);
  const puertaAntes = await leerPuerta(movil, 'DOOR_MAIN_A');
  if (!antes) {
    fail('móvil: window.__eko no expone al jugador');
    return;
  }
  if (!puertaAntes) {
    fail('móvil: window.__eko.world no contiene DOOR_MAIN_A');
    return;
  }
  if (puertaAntes.isOpen) {
    fail('móvil: la puerta ya estaba abierta antes de interactuar');
    return;
  }

  // El estado real manda: no soltamos hasta que el jugador se haya desplazado
  // y esté dentro del radio de interacción de la puerta.
  await movil.mouse.move(centroX, centroY);
  await movil.mouse.down();
  try {
    await movil.mouse.move(centroX + 70, centroY, { steps: 2 });
    await movil.waitForFunction(
      ({ x, y, puertaId }) => {
        const jugador = window.__eko?.player;
        const puerta = window.__eko?.world.doors.find((item) => item.id === puertaId);
        if (!jugador || !puerta) return false;
        const centro = { x: (puerta.x1 + puerta.x2) / 2, y: (puerta.y1 + puerta.y2) / 2 };
        return (
          Math.hypot(jugador.x - x, jugador.y - y) >= 10 &&
          Math.hypot(jugador.x - centro.x, jugador.y - centro.y) <= 62
        );
      },
      { x: antes.x, y: antes.y, puertaId: 'DOOR_MAIN_A' },
      { timeout: 3000 }
    );
  } catch (error) {
    fail(
      `móvil: el joystick no confirmó movimiento y cercanía a DOOR_MAIN_A (${error.message.split('\n')[0]})`
    );
    return;
  } finally {
    await movil.mouse.up();
  }
  await movil.waitForTimeout(300);

  const despues = await leerJugador(movil);
  if (!despues) {
    fail('móvil: window.__eko dejó de exponer al jugador');
    return;
  }
  const desplazamiento = Math.hypot(despues.x - antes.x, despues.y - antes.y);
  if (desplazamiento < 10) {
    fail(`móvil: el joystick no mueve al operador (delta ${desplazamiento.toFixed(1)} px)`);
    return;
  }
  const centroPuerta = { x: (puertaAntes.x1 + puertaAntes.x2) / 2, y: (puertaAntes.y1 + puertaAntes.y2) / 2 };
  const distanciaPuerta = Math.hypot(despues.x - centroPuerta.x, despues.y - centroPuerta.y);
  if (distanciaPuerta > 62) {
    fail(`móvil: el jugador quedó a ${distanciaPuerta.toFixed(1)} px de DOOR_MAIN_A (máximo 62)`);
    return;
  }
  console.log(
    `móvil: movimiento OK, el jugador se movió ${desplazamiento.toFixed(1)} px ` +
      `(${antes.x.toFixed(1)}, ${antes.y.toFixed(1)}) -> (${despues.x.toFixed(1)}, ${despues.y.toFixed(1)})`
  );

  await movil.getByRole('button', { name: /Interactuar/ }).click();
  await movil.waitForFunction(
    (puertaId) => window.__eko?.world.doors.find((item) => item.id === puertaId)?.isOpen === true,
    'DOOR_MAIN_A',
    { timeout: 4000 }
  );
  const puertaDespues = await leerPuerta(movil, 'DOOR_MAIN_A');
  if (!puertaDespues?.isOpen) {
    fail('móvil: la puerta no quedó abierta tras pulsar ACCIÓN');
  } else {
    console.log(`móvil: puerta ${puertaDespues.id} abierta (mundo real)`);
  }

  // La palanca tiene que seguir al dedo (captura de puntero), no quedarse quieta.
  const reposo = await leerPalanca(movil);
  await movil.mouse.move(centroX, centroY);
  await movil.mouse.down();
  await movil.mouse.move(centroX, centroY - 70, { steps: 6 });
  const arrastrada = await leerPalanca(movil);
  await movil.mouse.up();
  const recorrido = distanciaAPomo(arrastrada, reposo);
  if (recorrido < 20) fail(`móvil: la palanca no responde al arrastre (recorrido ${recorrido.toFixed(0)} px)`);
  await movil.waitForTimeout(400);
  const suelta = await leerPalanca(movil);
  if (distanciaAPomo(suelta, reposo) > 1) fail(`móvil: la palanca no vuelve al centro al soltar (${JSON.stringify(suelta)})`);
}

/** Franjas del HUD: compara las cajas reales y avisa de solapes o de bloques cortados. */
async function comprobarFranjas(movil, etiqueta) {
  const cajas = await movil.evaluate(() => {
    const caja = (el) => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), bottom: Math.round(b.bottom) };
    };
    const footer = [...document.querySelectorAll('div')].find((el) => (el.className || '').includes('flex-row flex-wrap'));
    const joystick = document.querySelector('[aria-label="Joystick de movimiento"]');
    const disparar = document.querySelector('[aria-label="Disparar"]');
    const subtitulos = [...document.querySelectorAll('div')].find((el) => (el.className || '').includes('radio-subtitles'));
    const hijosCortados = footer
      ? [...footer.children].filter((hijo) => {
          const b = hijo.getBoundingClientRect();
          return b.width > 0 && b.right > footer.getBoundingClientRect().right + 1;
        }).length
      : 0;
    return {
      footer: footer ? caja(footer) : null,
      joystick: joystick ? caja(joystick) : null,
      acciones: disparar?.parentElement ? caja(disparar.parentElement) : null,
      subtitulos: subtitulos ? caja(subtitulos) : null,
      hijosCortados,
      stack: getComputedStyle(document.documentElement).getPropertyValue('--eko-hud-stack-h').trim(),
    };
  });
  const solapa = (a, b) => Boolean(a && b && !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y));
  const pisados = [
    solapa(cajas.joystick, cajas.acciones) && 'joystick/botones',
    solapa(cajas.joystick, cajas.footer) && 'joystick/HUD',
    solapa(cajas.acciones, cajas.footer) && 'botones/HUD',
    solapa(cajas.subtitulos, cajas.joystick) && 'subtítulos/joystick',
    solapa(cajas.subtitulos, cajas.acciones) && 'subtítulos/botones',
    solapa(cajas.subtitulos, cajas.footer) && 'subtítulos/HUD',
  ].filter(Boolean);
  if (pisados.length) fail(`${etiqueta}: se pisan ${pisados.join(', ')} (${JSON.stringify(cajas)})`);
  if (cajas.hijosCortados > 0) fail(`${etiqueta}: la barra inferior corta ${cajas.hijosCortados} bloque(s) por la derecha`);
  if (!pisados.length && cajas.hijosCortados === 0) {
    console.log(`${etiqueta}: sin solapes (HUD ${cajas.stack}, subtítulos ${cajas.subtitulos ? 'medidos' : 'sin mensaje'})`);
  }
}

/** Espera a que haya subtítulo de radio, y comprueba las franjas en tres anchos. */
async function comprobarFranjasEnAnchos(movil) {
  try {
    await movil.waitForFunction(
      () => [...document.querySelectorAll('div')].some((el) => (el.className || '').includes('radio-subtitles')),
      null,
      { timeout: 12000 }
    );
  } catch {
    // Sin mensaje de radio no hay subtítulo que medir; los controles se comprueban igual.
  }

  // El viewport vertical de partida, y luego dos anchos donde la barra envuelve distinto.
  await comprobarFranjas(movil, 'móvil 390x844');
  for (const [ancho, alto] of [
    [320, 568],
    [360, 640],
  ]) {
    await movil.setViewportSize({ width: ancho, height: alto });
    await movil.waitForTimeout(600);
    await comprobarFranjas(movil, `móvil ${ancho}x${alto}`);
  }
}

/** Sección móvil completa: contexto táctil, audio, controles y franjas. */
export async function comprobarMovil(browser, contexto) {
  const contextoMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await instalarAzarDeterminista(contextoMovil, contexto.semilla);
  // Instrumenta el AudioContext: así se puede comprobar que el primer gesto lo deja
  // sonando (en iOS/Android nace suspendido y solo un toque lo reanuda).
  await contextoMovil.addInitScript(() => {
    const Original = window.AudioContext;
    if (!Original) return;
    window.__ekoAudio = [];
    window.__ekoResumes = 0;
    const resumeOriginal = Original.prototype.resume;
    Original.prototype.resume = function (...args) {
      window.__ekoResumes += 1;
      return resumeOriginal.apply(this, args);
    };
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        window.__ekoAudio.push(this);
      }
    };
  });
  const movil = await contextoMovil.newPage();
  vigilarPagina(movil, {
    origin: contexto.origin,
    badRequests: contexto.badRequests,
    consoleErrors: contexto.consoleErrors,
    prefijo: 'móvil ',
    fallosDeRed: false,
  });

  // Solo se captura si esta sección falla: el móvil no lleva traza para no alterar
  // los fotogramas que comparan el canvas, pero una captura es la prueba del layout.
  const fallosAntes = fallos.length;
  try {
    // La pestaña móvil tiene que estar en primer plano: si el navegador la considera
    // oculta, rAF se estrangula y los fotogramas saltan (ruido enorme al comparar).
    await movil.bringToFront();
    await movil.goto(contexto.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await movil.waitForSelector('canvas', { timeout: 20000 });

    await comprobarAudio(movil);

    await movil.getByRole('button', { name: MISION_1 }).click();
    await movil.getByText('K1 OPERATIVO').first().waitFor({ timeout: 20000 });
    await movil.waitForTimeout(1800);

    await comprobarJoystick(movil);
    await comprobarFranjasEnAnchos(movil);
  } finally {
    if (fallos.length > fallosAntes) await capturarPantalla(movil, 'movil');
    await contextoMovil.close();
  }
}
