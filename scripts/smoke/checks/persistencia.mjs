/**
 * Persistencia: jugar un poco, despejar una estancia y salir de ella, esperar el
 * autoguardado, recargar y reanudar.
 *
 * La comprobación usa `window.__eko` para afirmar el estado real del motor: la
 * posición del jugador, el tick y el mundo deben ser los guardados, no los de una
 * misión recién reiniciada. La puerta de entrada se abre antes de guardar para que
 * el mundo tenga un cambio observable además de la posición.
 *
 * Después se entra en el Recibidor Central —la única estancia sin actores— y se
 * sale, con Kobra-2 en HOLD en la escalera. Con el binomio fuera, el único motivo
 * para seguir viéndola despejada es la memoria de despeje. Se espera al
 * autoguardado que ya la incluye y, al reanudar, el HUD y el EKO-Pad tienen que
 * seguir marcándola DESPEJADA.
 *
 * El otro lado de la regla se comprueba a continuación, sobre esa misma memoria
 * restaurada: la cocina sí tiene un hostil dentro. El grito, con la puerta
 * cerrada, le quita el arma sin abrir fuego —un rendido sigue siendo un hostil
 * sin resolver— y el operador entra con la mira apartada hasta el fondo de la
 * estancia: a más de 95 px y fuera del cono no entra en su intel, así que la
 * cocina queda DESPEJADA y su id entra en el autoguardado. Al encararlo, la
 * estancia vuelve a EN CONTACTO en HUD y EKO-Pad y el autoguardado siguiente ya
 * no la lista: la memoria la soltó.
 *
 * El re-contacto de una sala ya despejada por intel que no es la vista del jugador
 * lo cubre la sonda óptica [4] en el salón: se entra un paso para dejarlo DESPEJADO
 * y en la memoria (Milán queda a 285 px, ni oye los pasos ni entra en la mira), se
 * sale cerrando la puerta y, desde el recibidor, el espejo marca al hostil
 * (`spottedByMirror`, sin `visibleToPlayer`) sin línea de visión ninguna. Ese
 * contacto se comprueba como estado sostenido —muestreo de dos segundos y otra
 * lectura del pad después del arresto—, no como una ventana del avance. La orden
 * tiene que rodear el piso desde el rellano (escalera → recibidor), abriendo la
 * puerta de entrada pero no la que va a sondar. El arresto de la cocina se cierra
 * con [6], y el binomio entra antes en la estancia con un PUNTO DE AVANCE del pad
 * pegado al rendido: la orden elige al rendido más cercano al binomio, no al que ve
 * el operador, y su cámara de casco es la confirmación de que está dentro. La
 * posición real de los actores se lee de `actors` en el snapshot E2E.
 *
 * El arresto cierra el ciclo: con el hostil en intel, sólo esposarlo lo saca de la
 * cuenta de hostiles conocidos, y la sala vuelve a DESPEJADA por la presencia del
 * binomio. La memoria no puede sostenerla —el contacto la borró y el autoguardado
 * anterior ya la había soltado—, así que ese DESPEJADA sólo se explica por
 * ocupación.
 *
 * El hostil se rinde a propósito, y no se barre con un hostil activo, porque el
 * escenario dejaría de ser determinista. Caminar emite 36 dB con radio 180 en
 * cualquier postura (agachado incluido); dentro de la misma estancia el
 * sospechoso lo oye, acumula sospecha hasta pasar a ALERTED e investiga el
 * origen del ruido caminando hasta 48 px de él. A menos de 95 px el operador ya
 * lo tiene en intel aunque no lo encare (`distToPlayer < 95` es incondicional en
 * `visibleToPlayer`), así que la estancia se pondría en contacto antes de que
 * llegue el autoguardado, que necesita hasta 5 s con el operador quieto. Fuera
 * de la estancia no hay barrido posible: la memoria sólo la sostiene si el
 * binomio estuvo dentro. Un rendido sigue contando como hostil conocido —el
 * filtro de despeje sólo excluye ARRESTED y DEAD— pero su IA termina en
 * `continue`: no se mueve, no apunta y no dispara, y la prueba aísla lo que la
 * regla mide de verdad, el intel del jugador.
 */
import { fail } from '../informe.mjs';
import {
  abrirPuertaDeEntrada,
  acercarseAPuerta,
  arrancarMision,
  distanciaAPuerta,
  marcarPuntoDeAvance,
} from '../navegador.mjs';
import { leerHud as leerDespejeHud, leerPad as leerDespejePad } from './despeje.mjs';

const MISION = 'Misión 1: Piso Graz - Lend';
const CLAVE_GUARDADO = 'eko_cobra_partida_en_curso';
const PANEL_DESPEJE = '[data-testid="objetivo-despeje"]';
const PUERTA_ENTRADA = 'DOOR_MAIN_A';
/** Estancia sin actores junto a la inserción: sólo la memoria puede sostenerla. */
const SALA_DESPEJADA = 'VORRAUM';
const X_DENTRO_SALA = 300;
const X_FUERA_SALA = 200;
const PUERTA_COCINA = 'DOOR_KITCHEN';
/** Puerta y estancia del re-contacto por sonda: Milán queda a 285 px de ella. */
const PUERTA_SALON = 'DOOR_LIVING';
const SALA_SONDA = 'WOHNZIMMER';
/** Nombre que publica el HUD para esa estancia. */
const NOMBRE_SALA_SONDA = 'Salón Principal';
/** Estancia con un hostil dentro: se barre sin verlo y luego vuelve a contacto. */
const SALA_CONTACTO = 'WOHNKUECHE';
/** Nombre que publica el HUD para esa estancia. */
const NOMBRE_SALA_CONTACTO = 'Cocina-Comedor';
/** Punto al este de la cocina: lejos del hostil y fuera del cono de la mira. */
const MIRA_BARRIDO = { x: 700, y: 320 };
/** Punto de barrido base, en el fondo de la cocina (la estancia llega a x = 660). */
const PUNTO_BARRIDO = { x: 540, y: 262 };
/** El rendido entra en intel a menos de 95 px: se barre con 25 px de margen. */
const DISTANCIA_BARRIDO = 120;
/** A menos de 85 px la cámara del binomio marca al rendido sin depender del ángulo. */
const CERCANIA_CAMARA = 60;
/** Pared este del comedor (x = 660) menos 20 px de aire. */
const X_MAXIMA_BARRIDO = 640;

/** Lee una instantánea atómica del motor; falla si no hay jugador creado. */
async function leerEstado(page) {
  const estado = await page.evaluate(() => window.__eko?.snapshot() ?? null);
  if (!estado || !estado.player) throw new Error('window.__eko no expone un jugador');
  return estado;
}

/** Jugador del último cuadro, sin arrastrar el resto de la instantánea. */
const leerJugador = (page) => page.evaluate(() => window.__eko?.snapshot()?.player ?? null);

/** Binomio del último cuadro, sin arrastrar el resto de la instantánea. */
const leerBinomio = (page) => page.evaluate(() => window.__eko?.snapshot()?.squad ?? null);

/** Una puerta por id, sin arrastrar el resto de la instantánea. */
const leerPuerta = (page, puertaId) =>
  page.evaluate(
    (id) => window.__eko?.snapshot()?.world.doors.find((puerta) => puerta.id === id) ?? null,
    puertaId
  );

/** Posición del jugador ya formateada para los mensajes de fallo. */
async function dondeEsta(page) {
  const jugador = await leerJugador(page);
  return jugador ? `${jugador.x.toFixed(1)}, ${jugador.y.toFixed(1)}` : 'sin jugador';
}

/** Partida guardada tal como la dejó el último autoguardado. */
function leerGuardado(page) {
  return page.evaluate((clave) => {
    try {
      return JSON.parse(localStorage.getItem(clave))?.state ?? null;
    } catch {
      return null;
    }
  }, CLAVE_GUARDADO);
}

/**
 * Espera al autoguardado de la posición actual que ya incluye —o ya no incluye—
 * la sala en la memoria de despeje (`estanciasDespejadas`).
 */
async function esperarGuardadoSala(page, x, y, sala, incluida) {
  await page.waitForFunction(
    ({ clave, x, y, sala, incluida }) => {
      try {
        const bruto = localStorage.getItem(clave);
        if (!bruto) return false;
        const guardado = JSON.parse(bruto)?.state;
        const simulacion = guardado?.simulacion;
        if (!simulacion) return false;
        return (
          Math.abs(simulacion.jugador.x - x) <= 1 &&
          Math.abs(simulacion.jugador.y - y) <= 1 &&
          Array.isArray(guardado.estanciasDespejadas) &&
          guardado.estanciasDespejadas.includes(sala) === incluida
        );
      } catch {
        return false;
      }
    },
    { clave: CLAVE_GUARDADO, x, y, sala, incluida },
    { timeout: 15000 }
  );
}

/** Espera a que el HUD cuente `despejadas` estancias; false si no llega a tiempo. */
async function esperarHudDespejadas(page, despejadas, timeout = 5000) {
  try {
    await page.waitForFunction(
      ({ selector, cuenta }) =>
        Number(document.querySelector(selector)?.getAttribute('data-despejadas')) === cuenta,
      { selector: PANEL_DESPEJE, cuenta: despejadas },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

/** Eje y sentido de cada tecla de movimiento; lo usa `caminarHasta`. */
const DIRECCION = {
  KeyW: { eje: 'y', hacia: -1 },
  KeyS: { eje: 'y', hacia: 1 },
  KeyA: { eje: 'x', hacia: -1 },
  KeyD: { eje: 'x', hacia: 1 },
};

/** Cadencia con la que la espera mira el avance mientras la tecla está pisada. */
const CADENCIA_AVANCE = 100;
/** Radio con el que se busca qué tiene pegado el operador cuando deja de avanzar. */
const RADIO_OBSTACULO = 60;
/** Registro de avance que la espera deja en la propia página. */
const REGISTRO_AVANCE = '__ekoAvanceDeCaminata';

/** Estado de una puerta en palabras, para el diagnóstico de un bloqueo. */
function estadoDePuerta(puerta) {
  if (puerta.isDestroyed) return 'derribada';
  if (puerta.isBreached) return 'abierta a la fuerza';
  if (puerta.isFullyOpen) return 'franca';
  if (puerta.isOpen) return 'a medio abrir';
  return puerta.isLocked ? 'cerrada con llave' : 'cerrada';
}

/**
 * Qué tiene pegado el operador en el cuadro del fallo: la puerta, la pared y el
 * mueble que bloquean a menos de `RADIO_OBSTACULO` px, y dónde está el binomio.
 *
 * La posición sola no dice por qué se trabó: una puerta a medio girar, un vano
 * cerrado y el compañero parado en el paso se ven igual desde las coordenadas.
 * Se miden distancias reales contra el snapshot del motor, no se adivina.
 */
async function diagnosticoDelBloqueo(page) {
  return page.evaluate((radio) => {
    const estado = window.__eko?.snapshot();
    const jugador = estado?.player;
    if (!jugador) return { jugador: null, binomio: null, obstaculos: [] };

    const aSegmento = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const largo = dx * dx + dy * dy;
      if (!largo) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / largo));
      return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
    };
    const aRectangulo = (px, py, x, y, w, h) =>
      Math.hypot(Math.max(x - px, 0, px - (x + w)), Math.max(y - py, 0, py - (y + h)));

    const puertas = (estado.world.doors ?? [])
      .map((puerta) => ({
        id: puerta.id,
        distancia: aSegmento(jugador.x, jugador.y, puerta.x1, puerta.y1, puerta.x2, puerta.y2),
        isOpen: puerta.isOpen,
        isFullyOpen: puerta.isFullyOpen,
        isLocked: puerta.isLocked,
        isBreached: puerta.isBreached,
        isDestroyed: puerta.isDestroyed,
      }))
      .filter((puerta) => puerta.distancia <= radio)
      .sort((a, b) => a.distancia - b.distancia);
    const paredes = (estado.world.walls ?? [])
      .map((muro) => ({
        id: muro.id,
        isWindow: muro.isWindow,
        distancia: aSegmento(jugador.x, jugador.y, muro.x1, muro.y1, muro.x2, muro.y2),
      }))
      .filter((muro) => muro.distancia <= radio)
      .sort((a, b) => a.distancia - b.distancia);
    const muebles = (estado.world.furniture ?? [])
      .filter((mueble) => mueble.blocksMovement)
      .map((mueble) => ({
        id: mueble.id,
        label: mueble.label,
        distancia: aRectangulo(jugador.x, jugador.y, mueble.x, mueble.y, mueble.w, mueble.h),
      }))
      .filter((mueble) => mueble.distancia <= radio)
      .sort((a, b) => a.distancia - b.distancia);
    const binomio = estado.squad ?? null;

    const obstaculos = [
      ...puertas.slice(0, 2).map((puerta) => ({ ...puerta, clase: 'puerta' })),
      ...paredes.slice(0, 2).map((muro) => ({ ...muro, clase: 'muro' })),
      ...muebles.slice(0, 2).map((mueble) => ({ ...mueble, clase: 'mueble' })),
    ]
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 3);

    return {
      jugador: { x: jugador.x, y: jugador.y },
      binomio: binomio ? { x: binomio.x, y: binomio.y } : null,
      obstaculos,
    };
  }, RADIO_OBSTACULO);
}

/** Texto de un obstáculo: qué es, a qué distancia y en qué estado. */
function describirObstaculo(obstaculo) {
  const distancia = `${obstaculo.distancia.toFixed(1)} px`;
  if (obstaculo.clase === 'puerta') return `${obstaculo.id} a ${distancia} (${estadoDePuerta(obstaculo)})`;
  if (obstaculo.clase === 'muro') {
    return `${obstaculo.id} a ${distancia}${obstaculo.isWindow ? ' (ventana)' : ''}`;
  }
  return `${obstaculo.label || obstaculo.id} a ${distancia}`;
}

/**
 * Mantiene una tecla hasta que el jugador cruza el umbral en ese eje.
 *
 * `paso` nombra el tramo del recorrido ("entrar en WOHNZIMMER", "barrido: …"): un
 * timeout de 8 s no dice cuál de las caminatas se trabó, y el flujo pasa por
 * varios umbrales de la misma tecla.
 *
 * El tope no cambia —8 s y el mismo umbral—, pero mientras la tecla está pisada
 * se muestrea el avance cada `CADENCIA_AVANCE` ms: cuánto avanzó, cuánto le
 * faltaba y desde cuándo está quieto. El muestreo corre dentro de la página, así
 * que no añade un viaje por cuadro, y su registro se renueva en cada llamada. En
 * el fallo se suma qué puerta, muro o mueble tiene pegado el operador y dónde
 * está el binomio: el mensaje y la traza ya no hay que cruzarlos a mano.
 */
async function caminarHasta(page, tecla, umbral, paso) {
  const direccion = DIRECCION[tecla];
  if (!direccion) throw new Error(`tecla sin dirección: ${tecla}`);
  if (!paso) throw new Error(`caminarHasta sin etiqueta de paso (${tecla} ${umbral})`);
  const idEspera = `${Date.now()}-${tecla}-${umbral}`;
  await page.keyboard.down(tecla);
  try {
    await page.waitForFunction(
      ({ eje, umbral, hacia, registro, id }) => {
        const estado = window.__eko?.snapshot();
        const jugador = estado?.player;
        if (!jugador) return false;
        let avance = window[registro];
        if (!avance || avance.id !== id) {
          avance = {
            id,
            inicio: jugador[eje],
            mejor: jugador[eje],
            ultimoAvanceEn: Date.now(),
            tickInicio: estado.tick ?? null,
            tickFin: estado.tick ?? null,
            muestras: 0,
          };
          window[registro] = avance;
        }
        const ahora = Date.now();
        avance.muestras += 1;
        avance.tickFin = estado.tick ?? null;
        // Sólo cuenta el avance en el sentido de la tecla: retroceder no acerca al umbral.
        const progreso = hacia > 0 ? jugador[eje] - avance.mejor : avance.mejor - jugador[eje];
        if (progreso >= 1) {
          avance.mejor = jugador[eje];
          avance.ultimoAvanceEn = ahora;
        }
        return hacia > 0 ? jugador[eje] >= umbral : jugador[eje] <= umbral;
      },
      { eje: direccion.eje, umbral, hacia: direccion.hacia, registro: REGISTRO_AVANCE, id: idEspera },
      { timeout: 8000, polling: CADENCIA_AVANCE }
    );
  } catch {
    const avance = await page
      .evaluate((registro) => {
        const actual = window[registro];
        return actual ? { ...actual, ahora: Date.now() } : null;
      }, REGISTRO_AVANCE)
      .catch(() => null);
    const bloqueo = await diagnosticoDelBloqueo(page).catch(() => null);

    const avanzado = avance ? Math.abs(avance.mejor - avance.inicio) : null;
    const total = avance ? Math.abs(umbral - avance.inicio) : null;
    const quieto = avance ? Math.max(0, avance.ahora - avance.ultimoAvanceEn) : null;
    const muestreo = avance
      ? `avanzó ${avanzado.toFixed(1)} de ${total.toFixed(1)} px y llevaba ` +
        `${(quieto / 1000).toFixed(1)} s sin avanzar ` +
        `(${avance.muestras} muestras, tick ${avance.tickInicio ?? '?'}→${avance.tickFin ?? '?'})`
      : 'sin registro de avance';
    const jugador = bloqueo?.jugador ?? null;
    const binomio = bloqueo?.binomio ?? null;
    const posiciones =
      `jugador en ${jugador ? `${jugador.x.toFixed(1)}, ${jugador.y.toFixed(1)}` : '?'}` +
      `; binomio en ${binomio ? `${binomio.x.toFixed(1)}, ${binomio.y.toFixed(1)}` : '?'}` +
      (jugador && binomio
        ? ` a ${Math.hypot(jugador.x - binomio.x, jugador.y - binomio.y).toFixed(1)} px`
        : '');
    const estorbo = bloqueo?.obstaculos?.length
      ? bloqueo.obstaculos.map(describirObstaculo).join('; ')
      : `nada a menos de ${RADIO_OBSTACULO} px del operador`;

    throw new Error(
      `el operador no llegó a ${tecla} ${umbral} en 8 s durante «${paso}» ` +
        `(${muestreo}; ${posiciones}; ${estorbo})`
    );
  } finally {
    await page.keyboard.up(tecla);
  }
}

/** Banda alrededor del carril de un vano dentro de la cual el operador ya cruza franco. */
const HOLGURA_CARRIL = 6;

/**
 * Deja al operador en el carril del vano antes de cruzarlo.
 *
 * Un vano mide 70 px y el motor frena a 17 px de cada hoja abierta y de cada jamb,
 * así que el paso franco es una banda de ~36 px en el centro. Cruzar al filo deja al
 * cuerpo clavado a media puerta aunque la puerta esté franca: pasó al entrar en la
 * cocina con la hoja a un lado y al entrar en el salón por el borde del jamb sur.
 *
 * El carril se deriva del propio hueco —su punto medio, equidistante de los dos
 * jambs sea cual sea el lado del hinge— y se corrige con pulsos cortos midiendo
 * después de cada uno: una tecla sostenida rebasa el carril en hasta 15 px por el
 * retardo del `keyup`, que es lo que volvía a dejarlo al filo. Es una ayuda, no una
 * comprobación: si no llega, avisa con el motor, el tick y los obstáculos, y el
 * cruce falla después con el mensaje completo de `caminarHasta`.
 */
async function alinearConElVano(page, puertaId) {
  const puerta = await leerPuerta(page, puertaId);
  if (!puerta) {
    console.warn(`alineación: sin lectura de ${puertaId}`);
    return;
  }
  const motor = () =>
    page.evaluate(() => {
      const estado = window.__eko?.snapshot();
      return estado ? { gameState: estado.gameState, tick: estado.tick ?? null } : null;
    });
  const antes = await motor();
  // Con el menú de pausa abierto el motor no lee el movimiento: un Escape lo cierra.
  if (antes?.gameState === 'PAUSED') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  // La hoja corre a lo largo del hueco: si el hueco es horizontal se cruza en y y el
  // carril es una x, y al revés.
  const horizontal = Math.abs(puerta.x2 - puerta.x1) >= Math.abs(puerta.y2 - puerta.y1);
  const eje = horizontal ? 'x' : 'y';
  const objetivo = horizontal ? (puerta.x1 + puerta.x2) / 2 : (puerta.y1 + puerta.y2) / 2;
  const [positiva, negativa] = horizontal ? ['KeyD', 'KeyA'] : ['KeyS', 'KeyW'];
  for (let pulso = 0; pulso < 16; pulso += 1) {
    const jugador = await leerJugador(page);
    if (!jugador) {
      console.warn(`alineación: sin jugador para el vano de ${puertaId}`);
      return;
    }
    const desvio = objetivo - jugador[eje];
    if (Math.abs(desvio) <= HOLGURA_CARRIL) return;
    const tecla = desvio > 0 ? positiva : negativa;
    await page.keyboard.down(tecla);
    await page.waitForTimeout(70);
    await page.keyboard.up(tecla);
    await page.waitForTimeout(60);
  }
  const despues = await motor();
  const bloqueo = await diagnosticoDelBloqueo(page).catch(() => null);
  const estorbo = bloqueo?.obstaculos?.length
    ? bloqueo.obstaculos.map(describirObstaculo).join('; ')
    : `nada a menos de ${RADIO_OBSTACULO} px del operador`;
  console.warn(
    `alineación: no se llegó al carril de ${puertaId} ` +
      `(${eje} = ${objetivo} ± ${HOLGURA_CARRIL}; jugador en ${await dondeEsta(page)}; ` +
      `motor ${antes?.gameState}→${despues?.gameState}, tick ${antes?.tick}→${despues?.tick}; ` +
      `${estorbo})`
  );
}

/**
 * Apunta la mira del ratón a un punto del mundo. La visión del jugador y el cono
 * de la linterna siguen la mira, no la última tecla de movimiento pulsada.
 */
async function apuntarA(page, destino) {
  const pantalla = await page.evaluate(
    (punto) => window.__eko?.worldToScreen(punto.x, punto.y) ?? null,
    destino
  );
  if (!pantalla) throw new Error('sin jugador para orientar la mira');
  await page.mouse.move(pantalla.x, pantalla.y);
  await page.waitForTimeout(120);
}

/**
 * Pulsa [E] hasta que la puerta cumpla `hecho`. [E] la cicla en tres pasos de
 * apertura (28 %, 65 % y franca) y la cierra desde la hoja franca; con la hoja a
 * medio girar el vano sigue bloqueado. Antes de la primera pulsación se deja al
 * operador dentro del radio de la puerta (ver `acercarseAPuerta`).
 */
async function accionarPuerta(page, puertaId, hecho) {
  await acercarseAPuerta(page, puertaId);
  for (let paso = 0; paso < 8; paso += 1) {
    const puerta = await leerPuerta(page, puertaId);
    if (puerta && hecho(puerta)) return true;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(160);
  }
  const puerta = await leerPuerta(page, puertaId);
  return !!puerta && hecho(puerta);
}

/** Hostil no resuelto dentro de una estancia, con su posición real, o null. */
async function hostilEnSala(page, sala) {
  const actors = await page.evaluate(() => window.__eko?.snapshot()?.actors ?? []);
  return (
    actors.find(
      (actor) => actor.role === 'SUSPECT' && actor.roomName === sala && actor.state !== 'DEAD'
    ) ?? null
  );
}

/**
 * Muestrea durante `ms` y exige que cada lectura siga cumpliendo `hecho`: un
 * contacto que sólo existe mientras el binomio avanza no cuenta como estado.
 */
async function sostenerEstado(page, ms, hecho, pausaMs = 400) {
  const muestras = Math.max(2, Math.round(ms / pausaMs));
  for (let muestra = 0; muestra < muestras; muestra += 1) {
    if (!(await hecho())) return false;
    await page.waitForTimeout(pausaMs);
  }
  return true;
}

/** Abre el EKO-Pad, lee el estado de una estancia y lo cierra. */
async function estadoEnPad(page, sala) {
  await page.keyboard.press('KeyM');
  await page.locator('[data-testid="pad-despeje"]').waitFor({ state: 'visible', timeout: 8000 });
  const filas = (await leerDespejePad(page)) ?? [];
  await page.keyboard.press('Escape');
  return filas.find((fila) => fila.sala === sala)?.estado ?? null;
}

/** Estancias despejadas que lista el último autoguardado, para los mensajes de fallo. */
async function despejadasGuardadas(page) {
  return JSON.stringify((await leerGuardado(page))?.estanciasDespejadas ?? null);
}

/** Comprueba que la partida guardada se reanuda sin reiniciar la misión. */
export async function comprobarPersistencia(page, { url }) {
  try {
    await arrancarMision(page, url, MISION, { asentarMs: 400 });
    const jugadorInicial = await leerJugador(page);
    if (!jugadorInicial) throw new Error('window.__eko no expone un jugador');
    if (Math.abs(jugadorInicial.x - X_FUERA_SALA) > 40) {
      fail(
        `persistencia: la inserción de Graz no está donde el humo la espera ` +
          `(x ${jugadorInicial.x})`
      );
      return;
    }

    // Se abre la puerta del todo para que el mundo tenga un cambio que reanudar.
    // No hace falta esperar el guardado aquí: el que se recarga es el posterior a
    // la sala barrida, que ya incluye la puerta abierta.
    await abrirPuertaDeEntrada(page);

    // --- Memoria de despeje: entrar en una sala vacía, salir y autoguardar ---
    const despejeInicial = await leerDespejeHud(page);
    if (!despejeInicial) {
      fail('persistencia: el HUD no publica el objetivo primario de despeje');
      return;
    }
    const despejadasEnSala = despejeInicial.despejadas + 1;

    // Kobra-2 se queda cubriendo la escalera: la sala no puede quedar «ocupada»
    // por el binomio al comprobarla, y sólo la memoria explica verla despejada.
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.__eko?.snapshot()?.squad?.command === 'HOLD', undefined, {
      timeout: 5000,
    });

    await caminarHasta(page, 'KeyD', X_DENTRO_SALA, `entrar en ${SALA_DESPEJADA}`);
    if (!(await esperarHudDespejadas(page, despejadasEnSala))) {
      const hud = await leerDespejeHud(page);
      fail(
        `persistencia: al entrar en ${SALA_DESPEJADA} el HUD cuenta ${hud?.despejadas ?? '?'} ` +
          `despejadas en vez de ${despejadasEnSala}`
      );
      return;
    }

    await caminarHasta(page, 'KeyA', X_FUERA_SALA, `salir de ${SALA_DESPEJADA}`);
    const hudFuera = await leerDespejeHud(page);
    if (hudFuera?.despejadas !== despejadasEnSala) {
      fail(
        `persistencia: al salir de ${SALA_DESPEJADA} el HUD baja a ${hudFuera?.despejadas ?? '?'} ` +
          `despejadas (${despejadasEnSala} dentro de la sala)`
      );
    }

    // Con el binomio fuera, el autoguardado de esta posición sólo puede listar la
    // sala por la memoria de despeje.
    const fuera = await leerJugador(page);
    if (!fuera) throw new Error('window.__eko no expone un jugador');
    try {
      await esperarGuardadoSala(page, fuera.x, fuera.y, SALA_DESPEJADA, true);
    } catch {
      fail(
        `persistencia: el autoguardado no conserva ${SALA_DESPEJADA} entre las estancias ` +
          `despejadas (${await despejadasGuardadas(page)})`
      );
      return;
    }

    const justoAntes = await leerEstado(page);
    const tickGuardado = (await leerGuardado(page))?.simulacion?.tick;

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
    const dx = Math.abs(despues.player.x - justoAntes.player.x);
    const dy = Math.abs(despues.player.y - justoAntes.player.y);
    const mundoRestaurado = JSON.stringify(despues.world) === JSON.stringify(justoAntes.world);
    const tickRestaurado = typeof tickGuardado !== 'number' || despues.tick >= tickGuardado;
    if (dx > 1 || dy > 1) {
      fail(
        `persistencia: posición restaurada (${despues.player.x.toFixed(1)}, ${despues.player.y.toFixed(1)}) ` +
          `distinta de la guardada (${justoAntes.player.x.toFixed(1)}, ${justoAntes.player.y.toFixed(1)})`
      );
    }
    if (despues.world.mission !== justoAntes.world.mission) {
      fail(`persistencia: misión restaurada ${despues.world.mission} en vez de ${justoAntes.world.mission}`);
    }
    if (!mundoRestaurado) {
      fail('persistencia: el mundo restaurado no coincide con el guardado');
    }
    if (!tickRestaurado) {
      fail(`persistencia: tick restaurado ${despues.tick}, guardado ${tickGuardado}`);
    }

    // --- La sala barrida sigue despejada tras reanudar, en HUD y en EKO-Pad ---
    await esperarHudDespejadas(page, despejadasEnSala, 8000);
    const hudReanudado = await leerDespejeHud(page);
    if (hudReanudado?.despejadas !== despejadasEnSala) {
      fail(
        `persistencia: tras reanudar el HUD cuenta ${hudReanudado?.despejadas ?? '?'}/` +
          `${hudReanudado?.total ?? '?'} despejadas en vez de ${despejadasEnSala}; ` +
          `${SALA_DESPEJADA} volvió a pendiente`
      );
    }

    const estadoReanudado = await estadoEnPad(page, SALA_DESPEJADA);
    if (estadoReanudado !== 'DESPEJADA') {
      fail(
        `persistencia: tras reanudar el EKO-Pad marca ${SALA_DESPEJADA} como ` +
          `${estadoReanudado ?? 'ausente'}`
      );
    }

    if (
      dx <= 1 &&
      dy <= 1 &&
      mundoRestaurado &&
      tickRestaurado &&
      hudReanudado?.despejadas === despejadasEnSala &&
      estadoReanudado === 'DESPEJADA'
    ) {
      console.log(
        `persistencia: posición (${despues.player.x.toFixed(1)}, ${despues.player.y.toFixed(1)}), ` +
          `tick ${despues.tick} y mundo restaurados; ${SALA_DESPEJADA} sigue DESPEJADA en HUD ` +
          `(${despejadasEnSala}/${hudReanudado.total}) y EKO-Pad`
      );
    }

    // --- El otro lado de la regla: la sala barrida vuelve a EN CONTACTO ---
    // La puerta de entrada se cierra desde dentro antes del barrido: Kobra-2 se
    // queda en la escalera y, con la hoja puesta, no hay línea de visión desde
    // allí hasta la cocina. Si el binomio viera al sospechoso, lo volvería intel
    // del jugador y la estancia no podría quedar despejada.
    await caminarHasta(
      page,
      'KeyD',
      300,
      `volver a ${PUERTA_ENTRADA} desde ${SALA_DESPEJADA}`
    );
    if (!(await accionarPuerta(page, PUERTA_ENTRADA, (puerta) => puerta.isOpen === false))) {
      fail(
        `persistencia: ${PUERTA_ENTRADA} no queda cerrada antes del barrido ` +
          `(${await distanciaAPuerta(page, PUERTA_ENTRADA)})`
      );
      return;
    }
    await caminarHasta(page, 'KeyD', 390, `cruzar el recibidor hacia ${PUERTA_SALON}`);

    // Salón: se entra un paso y se sale para dejarlo DESPEJADO y en la memoria sin
    // acercarse a Milán (285 px). La puerta se cierra al salir, así que después el
    // espejo de la sonda será el único que pueda delatarlo.
    await caminarHasta(page, 'KeyS', 430, `bajar al vano de ${PUERTA_SALON}`);
    await caminarHasta(page, 'KeyD', 500, `acercarse a ${PUERTA_SALON}`);
    if (!(await accionarPuerta(page, PUERTA_SALON, (puerta) => puerta.isFullyOpen))) {
      fail(
        `persistencia: ${PUERTA_SALON} no se abre para entrar al salón ` +
          `(${await distanciaAPuerta(page, PUERTA_SALON)})`
      );
      return;
    }
    await caminarHasta(page, 'KeyD', 545, `entrar en ${SALA_SONDA}`);
    const estadoAlEntrar = await estadoEnPad(page, SALA_SONDA);
    if (estadoAlEntrar !== 'DESPEJADA') {
      fail(
        `persistencia: ${SALA_SONDA} no queda DESPEJADA al entrar ` +
          `(pad: ${estadoAlEntrar ?? 'ausente'}; jugador en ${await dondeEsta(page)})`
      );
      return;
    }
    await caminarHasta(page, 'KeyA', 500, `salir de ${SALA_SONDA} al vano`);
    if (!(await accionarPuerta(page, PUERTA_SALON, (puerta) => puerta.isOpen === false))) {
      fail(
        `persistencia: ${PUERTA_SALON} no queda cerrada al salir del salón ` +
          `(${await distanciaAPuerta(page, PUERTA_SALON)})`
      );
      return;
    }
    await caminarHasta(page, 'KeyA', 390, `volver al recibidor desde ${SALA_SONDA}`);

    // VORRAUM está DESPEJADA por la memoria restaurada. La cocina, en cambio,
    // guarda al cómplice. El grito va con la puerta cerrada: el muro amortigua la
    // caída de moral (−9 por grito), así que se rinde sin abrir fuego. Un rendido
    // sigue siendo un hostil sin resolver —cuenta como contacto hasta que se le
    // esposa—, pero su IA queda inerte y el barrido no depende de su puntería ni
    // de que no oiga los pasos (ver la cabecera: con un hostil activo la prueba
    // no es determinista).
    await caminarHasta(page, 'KeyW', 330, `entrar en ${SALA_CONTACTO}`);
    await page.evaluate(() => document.activeElement?.blur?.());

    let rendido = false;
    for (let grito = 0; grito < 8 && !rendido; grito += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(450);
      rendido = await page.evaluate(() =>
        (window.__eko?.snapshot()?.radioFeed ?? []).some(
          (linea) =>
            /Lukas/.test(linea?.text ?? '') && /Waffe fallengelassen/.test(linea?.text ?? '')
        )
      );
    }
    if (!rendido) {
      fail(
        `persistencia: el hostil de la cocina no se rindió con el grito ` +
          `(jugador en ${await dondeEsta(page)})`
      );
      return;
    }

    if (!(await accionarPuerta(page, PUERTA_COCINA, (puerta) => puerta.isFullyOpen))) {
      fail(
        `persistencia: ${PUERTA_COCINA} no queda franca para entrar ` +
          `(${await distanciaAPuerta(page, PUERTA_COCINA)})`
      );
      return;
    }

    // Barrido sin verlo: la mira se queda al este, contra la pared, mientras el
    // operador camina hasta el fondo de la cocina. A más de 95 px y fuera del
    // cono, el rendido no entra en la intel del jugador y la estancia queda
    // DESPEJADA aunque él siga dentro. La distancia se afirma sobre la posición real
    // del sospechoso y el punto de barrido se deriva de ella, no se da por supuesta.
    const sospechoso = await hostilEnSala(page, SALA_CONTACTO);
    if (!sospechoso || sospechoso.state !== 'SURRENDERED') {
      fail(
        `persistencia: ${SALA_CONTACTO} no tiene un rendido dentro antes del barrido ` +
          `(${sospechoso?.state ?? 'sin hostil'})`
      );
      return;
    }
    // El punto de barrido se corre hacia la pared este lo justo para dejar al rendido
    // a `DISTANCIA_BARRIDO` px: su IA está inerte (SURRENDERED), así que la distancia
    // medida aquí es la que habrá al barrer. Con el punto fijo en 540 el rendido se
    // detenía a ~48 px del último ruido y quedaba a 94 px, un px dentro del intel: el
    // rojo dependía de dónde se parara. La regla no cambia —se barre a más de 95 px—,
    // lo que cambia es que el punto se deriva de la posición real del sospechoso.
    const puntoBarrido = {
      x: Math.min(X_MAXIMA_BARRIDO, Math.max(PUNTO_BARRIDO.x, sospechoso.x + DISTANCIA_BARRIDO)),
      y: PUNTO_BARRIDO.y,
    };
    const distanciaAlBarrido = Math.hypot(
      sospechoso.x - puntoBarrido.x,
      sospechoso.y - puntoBarrido.y
    );
    if (distanciaAlBarrido <= 95) {
      fail(
        `persistencia: el rendido (${sospechoso.x.toFixed(0)}, ${sospechoso.y.toFixed(0)}) queda a ` +
          `${distanciaAlBarrido.toFixed(0)} px del punto de barrido más lejano ` +
          `(${puntoBarrido.x.toFixed(0)}, ${puntoBarrido.y.toFixed(0)}); con menos de 95 entra en intel`
      );
      return;
    }
    await apuntarA(page, MIRA_BARRIDO);
    await alinearConElVano(page, PUERTA_COCINA);
    await caminarHasta(
      page,
      'KeyW',
      puntoBarrido.y,
      `barrido: subir al fondo de ${SALA_CONTACTO}`
    );
    await caminarHasta(
      page,
      'KeyD',
      puntoBarrido.x,
      'barrido: apartarse a la pared este'
    );
    await apuntarA(page, MIRA_BARRIDO);

    // La visita relámpago al salón sumó otra despejada a la cuenta de partida.
    if (!(await esperarHudDespejadas(page, despejadasEnSala + 2))) {
      const hud = await leerDespejeHud(page);
      fail(
        `persistencia: al barrer ${SALA_CONTACTO} sin ver al hostil el HUD cuenta ` +
          `${hud?.despejadas ?? '?'}/${hud?.total ?? '?'} despejadas en vez de ` +
          `${despejadasEnSala + 2}`
      );
      return;
    }
    const hudBarrida = await leerDespejeHud(page);

    // La memoria es lo que guarda la partida: la sala barrida tiene que aparecer
    // entre las despejadas del autoguardado de esta posición antes del contacto.
    const enSala = await leerJugador(page);
    if (!enSala) throw new Error('window.__eko no expone un jugador');
    try {
      await esperarGuardadoSala(page, enSala.x, enSala.y, SALA_CONTACTO, true);
    } catch {
      fail(
        `persistencia: el autoguardado no llegó a listar ${SALA_CONTACTO} entre las despejadas ` +
          `(${await despejadasGuardadas(page)})`
      );
      return;
    }

    // Al encararlo entra en la intel del jugador: la sala ya no está despejada.
    await apuntarA(page, { x: sospechoso.x, y: sospechoso.y });
    await page
      .waitForFunction(
        ({ selector, nombre }) =>
          document.querySelector(selector)?.getAttribute('data-en-contacto') === nombre,
        { selector: PANEL_DESPEJE, nombre: NOMBRE_SALA_CONTACTO },
        { timeout: 4000 }
      )
      .catch(() => {});
    const hudContacto = await leerDespejeHud(page);
    if (hudContacto?.contacto !== NOMBRE_SALA_CONTACTO) {
      fail(
        `persistencia: el hostil rendido de la cocina no puso ${SALA_CONTACTO} en contacto ` +
          `(contacto ${hudContacto?.contacto || 'ninguno'}, ` +
          `${hudContacto?.despejadas ?? '?'}/${hudContacto?.total ?? '?'} despejadas)`
      );
      return;
    }
    const estadoEnContacto = await estadoEnPad(page, SALA_CONTACTO);
    if (estadoEnContacto !== 'EN_CONTACTO') {
      fail(
        `persistencia: el EKO-Pad marca ${SALA_CONTACTO} como ${estadoEnContacto ?? 'ausente'} ` +
          'con el hostil dentro'
      );
      return;
    }

    // Guardado sin la sala: la memoria la soltó en cuanto hubo un hostil conocido
    // dentro, y sin el contacto volvería a NO VISTA.
    const enContacto = await leerJugador(page);
    if (!enContacto) throw new Error('window.__eko no expone un jugador');
    try {
      await esperarGuardadoSala(page, enContacto.x, enContacto.y, SALA_CONTACTO, false);
    } catch {
      fail(
        `persistencia: el autoguardado no soltó ${SALA_CONTACTO} tras el contacto ` +
          `(${await despejadasGuardadas(page)})`
      );
      return;
    }

    // --- Re-contacto por la sonda óptica, no por la vista del operador ---
    // El operador sale de la cocina y se planta junto a la puerta del salón. Ahí no
    // ve a Milán (285 px y hoja cerrada) y el salón sigue DESPEJADO por la memoria
    // que dejó la visita anterior. El espejo de [4] barre las dos estancias del vano
    // y lo marca sin que el operador lo mire; ninguna cámara tiene línea de visión.
    await caminarHasta(page, 'KeyA', 390, `salir de ${SALA_CONTACTO} al vano`);
    await caminarHasta(page, 'KeyS', 330, `bajar al vano de ${PUERTA_SALON} para la sonda`);
    if (!(await accionarPuerta(page, PUERTA_COCINA, (puerta) => puerta.isOpen === false))) {
      fail(
        `persistencia: ${PUERTA_COCINA} no queda cerrada al salir ` +
          `(${await distanciaAPuerta(page, PUERTA_COCINA)})`
      );
      return;
    }
    await caminarHasta(page, 'KeyS', 430, 'bajar al recibidor tras cerrar la cocina');
    await caminarHasta(page, 'KeyD', 470, `plantarse junto a ${PUERTA_SALON}`);
    await apuntarA(page, MIRA_BARRIDO);
    const antesDeLaSonda = await estadoEnPad(page, SALA_SONDA);
    if (antesDeLaSonda !== 'DESPEJADA') {
      fail(
        `persistencia: ${SALA_SONDA} no está DESPEJADA antes de la sonda ` +
          `(${antesDeLaSonda ?? 'ausente'})`
      );
      return;
    }

    // [4]: desde el rellano el binomio tiene que rodear el piso hasta el vano.
    await page.keyboard.press('Digit4');
    try {
      await page.waitForFunction(
        () =>
          (window.__eko?.snapshot()?.radioFeed ?? []).some((linea) =>
            /Sonda óptica en/.test(linea?.text ?? '')
          ),
        undefined,
        { timeout: 25000 }
      );
    } catch {
      const squad = await leerBinomio(page);
      fail(
        `persistencia: la sonda no llegó a barrer ${PUERTA_SALON} desde el rellano ` +
          `(binomio en ${squad ? `${squad.x.toFixed(1)}, ${squad.y.toFixed(1)}` : 'sin binomio'})`
      );
      return;
    }
    // Estado, no ventana: durante dos segundos el espejo tiene que seguir marcando al
    // hostil y el HUD nombrar la estancia, con el binomio ya parado en el vano y el
    // operador mirando a la pared. Una marca que sólo durara el avance no pasa.
    const enContactoSostenido = async () => {
      const hostil = await hostilEnSala(page, SALA_SONDA);
      const hud = await leerDespejeHud(page);
      return (
        hostil?.spottedByMirror === true &&
        hostil.visibleToPlayer === false &&
        hud?.contacto === NOMBRE_SALA_SONDA
      );
    };
    if (!(await sostenerEstado(page, 2000, enContactoSostenido))) {
      const hostil = await hostilEnSala(page, SALA_SONDA);
      const hud = await leerDespejeHud(page);
      fail(
        `persistencia: el contacto de ${SALA_SONDA} por sonda no se sostiene ` +
          `(espejo ${hostil?.spottedByMirror === true}, ` +
          `a la vista ${hostil?.visibleToPlayer === true}, ` +
          `contacto ${hud?.contacto || 'ninguno'})`
      );
      return;
    }
    const estadoSonada = await estadoEnPad(page, SALA_SONDA);
    if (estadoSonada !== 'EN_CONTACTO') {
      fail(
        `persistencia: el EKO-Pad marca ${SALA_SONDA} como ${estadoSonada ?? 'ausente'} tras la sonda`
      );
      return;
    }
    const hudSonada = await leerDespejeHud(page);

    // El operador vuelve a la cocina para el arresto, con la mira en la pared y al mismo
    // punto del barrido: así la estancia queda sostenida por su presencia cuando el
    // arresto saque al rendido de la cuenta de hostiles conocidos, y el rendido sigue
    // fuera del intel del operador (a más de 95 px y sin entrar en el cono) mientras el
    // binomio entra a la estancia.
    await caminarHasta(page, 'KeyA', 390, `volver al vano de ${SALA_CONTACTO} para el arresto`);
    await caminarHasta(page, 'KeyW', 330, `subir al vano de ${SALA_CONTACTO}`);
    if (!(await accionarPuerta(page, PUERTA_COCINA, (puerta) => puerta.isFullyOpen))) {
      fail(
        `persistencia: ${PUERTA_COCINA} no queda franca para volver a entrar ` +
          `(${await distanciaAPuerta(page, PUERTA_COCINA)})`
      );
      return;
    }
    await apuntarA(page, MIRA_BARRIDO);
    await alinearConElVano(page, PUERTA_COCINA);
    await caminarHasta(
      page,
      'KeyW',
      puntoBarrido.y,
      `arresto: subir al fondo de ${SALA_CONTACTO}`
    );
    await caminarHasta(
      page,
      'KeyD',
      puntoBarrido.x,
      'arresto: apartarse a la pared este'
    );
    await apuntarA(page, MIRA_BARRIDO);

    // [6] esposa al rendido más cercano al binomio, no al que el operador tiene delante:
    // con Kobra-2 parado en el vano del salón, Milán —a un paso y todavía en contacto por
    // el espejo de la sonda— gana la carrera a Lukas y la orden se lo lleva a él. Por eso
    // el binomio tiene que estar dentro de la cocina y se espera el contacto de su cámara
    // de casco con el rendido antes de pedir el arresto: con el binomio dentro, Lukas es el
    // más cercano y la elección deja de depender de dónde se pare cada uno.
    //
    // Se le lleva con un PUNTO DE AVANCE, no con [1]: en FOLLOW su punto de arrastre cae
    // detrás del operador y, desde el fondo de la cocina, eso es al otro lado de la pared
    // sur, donde el guiado local se clava (medido: binomio en 477.0, 297.1, con y = 297
    // fuera de la estancia y sin línea de visión al rendido). El marcador navega la ruta y
    // abre las puertas que estorban. El punto se pone a `CERCANIA_CAMARA` px del rendido,
    // sobre la recta que lo une con el punto del barrido —ambos pisos transitables—: a
    // menos de 85 px la cámara del binomio lo marca sin depender del ángulo con el que
    // llegue, y el operador sigue a más de 95 px del suyo, como exige la comprobación.
    const haciaElBarrido = {
      x: puntoBarrido.x - sospechoso.x,
      y: puntoBarrido.y - sospechoso.y,
    };
    const largo = Math.hypot(haciaElBarrido.x, haciaElBarrido.y) || 1;
    const puntoBinomio = {
      x: Math.min(
        X_MAXIMA_BARRIDO,
        Math.max(270, sospechoso.x + (haciaElBarrido.x / largo) * CERCANIA_CAMARA)
      ),
      y: Math.min(270, Math.max(110, sospechoso.y + (haciaElBarrido.y / largo) * CERCANIA_CAMARA)),
    };
    const puntoMarcado = await marcarPuntoDeAvance(page, puntoBinomio);
    // Sin marcador no hay ruta: se deja el seguimiento como último recurso, que al menos
    // arrima al binomio al vano, y la espera de cámara decide.
    if (!puntoMarcado) await page.keyboard.press('Digit1');
    const leerContactoDeCamara = () =>
      page
        .evaluate(
          ({ selector, sala }) => {
            const snap = window.__eko?.snapshot();
            const actor = (snap?.actors ?? []).find(
              (a) => a.role === 'SUSPECT' && a.roomName === sala && a.state !== 'DEAD'
            );
            return {
              contacto: document.querySelector(selector)?.getAttribute('data-en-contacto') ?? '',
              visibleToSquad: Boolean(actor?.visibleToSquad),
              visibleToPlayer: Boolean(actor?.visibleToPlayer),
              actor: actor ? { x: actor.x, y: actor.y } : null,
            };
          },
          { selector: PANEL_DESPEJE, sala: SALA_CONTACTO }
        )
        .catch(() => null);
    // El ratón del pad movió también la mira del operador: al cerrar el pad apuntaba al
    // marcador —hacia el rendido— y `visibleToPlayer` pasaba a true, que es justo lo que
    // la comprobación exige que no ocurra. Se devuelve la mira a la pared antes de
    // esperar la cámara del binomio.
    await apuntarA(page, MIRA_BARRIDO);

    let porCamara = false;
    let lecturaCamara = null;
    const limiteDelSeguimiento = Date.now() + 20000;
    while (!porCamara && Date.now() < limiteDelSeguimiento) {
      lecturaCamara = await leerContactoDeCamara();
      if (!lecturaCamara) break;
      porCamara =
        lecturaCamara.contacto === NOMBRE_SALA_CONTACTO &&
        lecturaCamara.visibleToSquad &&
        !lecturaCamara.visibleToPlayer;
      if (!porCamara) await page.waitForTimeout(60);
    }
    if (!porCamara) {
      const squad = await leerBinomio(page);
      const distanciaAlPunto = squad
        ? Math.hypot(squad.x - puntoBinomio.x, squad.y - puntoBinomio.y)
        : Number.NaN;
      fail(
        `persistencia: la cámara de Kobra-2 no puso ${SALA_CONTACTO} en contacto antes de la ` +
          `orden [6] (binomio en ${squad ? `${squad.x.toFixed(1)}, ${squad.y.toFixed(1)}` : 'sin binomio'}, ` +
          `a ${Number.isNaN(distanciaAlPunto) ? '?' : distanciaAlPunto.toFixed(0)} px del punto de ` +
          `avance (${puntoBinomio.x.toFixed(0)}, ${puntoBinomio.y.toFixed(0)}) que el pad ` +
          `${puntoMarcado ? 'fijó' : 'no fijó'}; ` +
          `contacto ${lecturaCamara?.contacto || 'ninguno'}, a la vista del binomio ` +
          `${lecturaCamara?.visibleToSquad === true}, del operador ` +
          `${lecturaCamara?.visibleToPlayer === true}` +
          (squad && lecturaCamara?.actor
            ? `; rendido en ${lecturaCamara.actor.x.toFixed(1)}, ${lecturaCamara.actor.y.toFixed(1)} ` +
              `a ${Math.hypot(lecturaCamara.actor.x - squad.x, lecturaCamara.actor.y - squad.y).toFixed(1)} px`
            : '') +
          ')'
      );
      return;
    }

    // Con el contacto ya establecido la orden no puede engancharse a otro rendido; si aun
    // así el radio confirma un arresto que no es el de Lukas, se corta con esa línea en
    // vez de esperar 25 s a una que nunca va a llegar.
    await page.keyboard.press('Digit6');
    let arrestado = false;
    let otroRendido = '';
    const limite = Date.now() + 25000;
    while (!arrestado && !otroRendido && Date.now() < limite) {
      const linea = await page
        .evaluate(() =>
          (window.__eko?.snapshot()?.radioFeed ?? [])
            .map((entrada) => entrada?.text ?? '')
            .find((texto) => /asegurado y esposado/.test(texto))
        )
        .catch(() => '');
      if (!linea) {
        await page.waitForTimeout(60);
        continue;
      }
      if (/Lukas/.test(linea)) arrestado = true;
      else otroRendido = linea;
    }
    if (!arrestado) {
      const squad = await leerBinomio(page);
      const radio = (await page.evaluate(() => window.__eko?.snapshot()?.radioFeed ?? []))
        .map((linea) => linea?.text)
        .slice(0, 4)
        .join(' | ');
      fail(
        otroRendido
          ? `persistencia: la orden [6] se enganchó a otro rendido antes que a Lukas ` +
              `(binomio en ${squad ? `${squad.x.toFixed(1)}, ${squad.y.toFixed(1)}` : 'sin binomio'}; ` +
              `radio: ${otroRendido})`
          : `persistencia: Kobra-2 no llegó a esposar al rendido de ${SALA_CONTACTO} ` +
              `(binomio en ${squad ? `${squad.x.toFixed(1)}, ${squad.y.toFixed(1)}` : 'sin binomio'}; ` +
              `radio: ${radio || 'vacía'})`
      );
      return;
    }

    // En cuanto lo esposa sale de hostiles conocidos: con el binomio dentro, la
    // única entrada que sostiene la estancia es la ocupación.
    await page
      .waitForFunction(
        (selector) => !document.querySelector(selector)?.getAttribute('data-en-contacto'),
        PANEL_DESPEJE,
        { timeout: 5000 }
      )
      .catch(() => {});
    const esposado = await hostilEnSala(page, SALA_CONTACTO);
    if (esposado?.state !== 'ARRESTED') {
      fail(
        `persistencia: el rendido de ${SALA_CONTACTO} sigue en estado ` +
          `${esposado?.state ?? 'fuera de la estancia'} tras la orden [6]`
      );
      return;
    }
    const hudArrestado = await leerDespejeHud(page);
    // El salón sigue en contacto por el espejo; lo que debe soltar la cocina.
    if (hudArrestado?.contacto === NOMBRE_SALA_CONTACTO) {
      fail(
        `persistencia: tras esposar al rendido el HUD sigue en contacto con ${hudArrestado.contacto}`
      );
      return;
    }
    const estadoArrestado = await estadoEnPad(page, SALA_CONTACTO);
    if (estadoArrestado !== 'DESPEJADA') {
      fail(
        `persistencia: tras esposar al rendido el EKO-Pad marca ${SALA_CONTACTO} como ` +
          `${estadoArrestado ?? 'ausente'}; la memoria ya la había soltado el contacto`
      );
      return;
    }

    // El espejo dejó estado y no una ventana: el salón sigue en contacto con el
    // binomio ya lejos del vano y un arresto de por medio.
    const salonArrestado = await estadoEnPad(page, SALA_SONDA);
    if (salonArrestado !== 'EN_CONTACTO') {
      fail(
        `persistencia: tras el arresto ${SALA_SONDA} figura ${salonArrestado ?? 'ausente'}; ` +
          'el espejo de la sonda no dejó un contacto sostenido'
      );
      return;
    }

    console.log(
              `persistencia: ${SALA_CONTACTO} se barrió sin ver al hostil rendido ` +
        `(${hudBarrida.despejadas}/${hudBarrida.total} despejadas), volvió a EN CONTACTO al ` +
        `encararlo (${hudContacto.despejadas}/${hudContacto.total} despejadas, HUD y EKO-Pad), ` +
        'salió de la memoria del autoguardado, la sonda óptica puso el salón en contacto con ' +
        `el operador en el recibidor sin verlo (${hudSonada.despejadas}/${hudSonada.total} ` +
        'despejadas), el contacto se sostuvo dos segundos y sobrevivió al arresto, y con el ' +
        'rendido esposado tras rodear el piso la cocina volvió a DESPEJADA por presencia del ' +
        'binomio'
    );
  } catch (error) {
    fail(`persistencia: ${error.message.split('\n')[0]}`);
  }
}
