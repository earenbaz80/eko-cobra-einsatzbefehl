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
 * posición real de los actores se lee de `actors` en el snapshot E2E. En cuanto la
 * cámara lo ve, un HOLD fija al binomio en el apostadero: al llegar al punto de
 * avance el motor suelta el marcador y vuelve a seguirlo al operador, y el contacto
 * se caía antes de leer el pad, que entonces marcaba DESPEJADA por ocupación.
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
import { SEMILLA_E2E_TEXTO } from '../config.mjs';
import { contarMundo, huellaDelMundo } from '../huella-mundo.mjs';
import {
  HOLGURA_CUERPO,
  PASO_REJILLA,
  cabeElCuerpo,
  obstaculosDelMundo,
  planificarRuta,
} from '../ruta.mjs';

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
/** Mira al este de la cocina: se usa cuando el rendido queda al oeste. */
const MIRA_BARRIDO = { x: 700, y: 320 };
/** La misma mira contra la pared oeste, para barrer caminando hacia el vano. */
const MIRA_BARRIDO_OESTE = { x: 320, y: 320 };
/** Extremos de la banda de la cocina donde se busca el punto de barrido. */
const X_MINIMA_BARRIDO = 400;
/** Punto de barrido base, en el fondo de la cocina (la estancia llega a x = 660). */
const PUNTO_BARRIDO = { x: 540, y: 262 };
/** El rendido entra en intel a menos de 95 px: se barre con 25 px de margen. */
const DISTANCIA_BARRIDO = 120;
/** Distancia a la que se apuesta al binomio: bien dentro del alcance de su cámara. */
const CERCANIA_CAMARA = 60;
/** Por debajo de este alcance la cámara de casco marca al rendido sin depender del ángulo. */
const ALCANCE_CAMARA = 85;
/** Tiempo que la cámara del binomio tiene que sostener la vista antes de dar el contacto. */
const VISTA_SOSTENIDA_MS = 800;
/** Pared este del comedor (x = 660) menos 20 px de aire. */
const X_MAXIMA_BARRIDO = 640;

/**
 * Huella del mundo procedural de la Misión 1 con la semilla del humo. Cualquier
 * cambio de mobiliario, muro o puerta la mueve; si deja de coincidir, el escenario
 * no es el del arranque limpio y ningún fallo posterior se puede atribuir al paso.
 */
const HUELLA_MUNDO_ESPERADA = '14011c54';

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

/** Punto de barrido: distancia al rendido que lo deja fuera del intel. */
const RADIO_OBSTACULO = 60;
/** Holgura de cuerpo con la que se comprueba el corredor hasta el punto de barrido. */
const HOLGURA_BARRIDO = 17;
/**
 * Tope de cada caminata, en segundos de simulación: presupuesto de la caminata entera,
 * no de un tramo.
 *
 * El cuerpo se mueve con el `dt` del motor, clampeado a 42 ms: con la máquina cargada
 * la simulación avanza más despacio que el reloj de pared. Un tope en milisegundos de
 * reloj medía la carga del runner, no la caminata, y el CI agotaba los 8000 ms con el
 * operador a medio cruzar el vano. Se mide lo que el paso consume de verdad.
 *
 * Doce segundos cubren con margen el paso más caro medido —el barrido de la cocina,
 * seis tramos con paradas de precisión en el vano, 5,5 a 6,8 s de simulación— sin
 * convertir un cuerpo trabado en un paso: si no llega, la caminata sigue fallando y
 * el mensaje dice cuánto faltaba.
 */
const TOPE_CAMINATA = 12;
/** Tope de reloj por caminata: sólo corta si el motor dejó de avanzar. */
const TOPE_RELOJ_CAMINATA = 45000;
/** Tope de reloj de un solo toque, para no esperar a un motor congelado. */
const TOPE_RELOJ_TOQUE = 6000;
/** Velocidad base del operador en el motor, en px/s de simulación. */
const VELOCIDAD_CAMINATA = 168;
/** Lo que se deja sin recorrer en cada toque, para no pasarse del punto. */
const MARGEN_FRENADA = 6;
/** Espera máxima a que el cuerpo empiece a moverse tras pulsar, en ms de reloj. */
const ESPERA_PRIMER_PASO = 800;
/**
 * Distancia a la que se da por alcanzado un punto intermedio de la ruta: lo que avanza
 * el cuerpo en el toque más corto. Con menos, el operador rebota alrededor del punto
 * —ida y vuelta de 6 px— hasta gastar el tope sin haberse movido de sitio.
 */
const HOLGURA_PASO = 10;
/** Distancia a la que se da por alcanzado el destino final. */
const HOLGURA_FINAL = 4;
/** Espera tras soltar, para que la lectura del motor sea la del cuerpo ya parado. */
const ASENTAR_MS = 90;
/**
 * Tolerancia de la aserción final, por eje.
 *
 * Es lo que avanza el cuerpo en un frame del motor con la máquina cargada: en la pasada
 * completa un frame puede durar ~100 ms y a 200 px/s son ~20 px, de modo que ningún
 * toque puede dejar al operador más fino que eso. Los tramos del piso se miden en
 * decenas de píxeles: la coordenada pedida se sigue afirmando, con la precisión que
 * permite el motor.
 */
const HOLGURA_DESTINO = 12;
/** Una fila por caminata de la pasada: duración real, px recorridos y tramos. */
const CAMINATAS = [];

/** Deja constancia de una caminata en el log y en el resumen final. */
function registrarCaminata(fila) {
  CAMINATAS.push(fila);
  console.log(
    `caminarA · ${String(fila.ms).padStart(5)} ms · ${fila.sim.toFixed(2)} s sim · ` +
      `${fila.px.toFixed(1).padStart(5)} px · ${String(fila.tramos).padStart(2)} tramos → ` +
      `(${fila.destino.x.toFixed(0)}, ${fila.destino.y.toFixed(0)}) · «${fila.paso}»`
  );
}

/** Margen real del tope: las caminatas de la pasada, de la más lenta a la más rápida. */
function volcarTablaCaminatas() {
  if (!CAMINATAS.length) return;
  const ordenadas = [...CAMINATAS].sort((a, b) => b.ms - a.ms);
  const masLenta = ordenadas[0];
  console.log(
    `caminarA: ${ordenadas.length} caminatas, tope ${TOPE_CAMINATA} s de simulación; ` +
      `la más lenta usó ${masLenta.sim.toFixed(2)} s de simulación y ${masLenta.ms} ms de reloj ` +
      `(${(100 * masLenta.sim / TOPE_CAMINATA).toFixed(1)} % del tope)`
  );
  for (const fila of ordenadas) {
    console.log(
      `  ${String(fila.ms).padStart(5)} ms · ${fila.sim.toFixed(2)} s sim · ` +
        `${fila.px.toFixed(1).padStart(5)} px de ${fila.objetivo.toFixed(1).padStart(5)} px · ` +
        `${String(fila.tramos).padStart(2)} tramos · (${fila.destino.x.toFixed(0)}, ` +
        `${fila.destino.y.toFixed(0)}) · «${fila.paso}»`
    );
  }
}

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
      // Si el motor corre pero el cuerpo no se mueve, la causa no es la geometría:
      // el juego puede estar en pausa o con un modal que se come el teclado.
      estado: estado.gameState,
      modal: document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null,
      foco: document.hasFocus(),
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

/** Teclas de movimiento; se sueltan todas al final de cada pulso. */
const TECLAS_DE_MOVIMIENTO = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

/**
 * Suelta las teclas de movimiento por partida doble: por el canal del navegador y con
 * un `keyup` dentro de la página.
 *
 * Con la máquina cargada (perfil completo, otras pestañas con el motor andando) se vio
 * al operador seguir caminando después de soltar: el `keyup` del navegador se perdió y
 * el cuerpo se plantó 40 px más allá del punto, sin nada cerca que lo explicara.
 */
async function soltarTeclas(page) {
  for (const tecla of TECLAS_DE_MOVIMIENTO) await page.keyboard.up(tecla);
  await page
    .evaluate((teclas) => {
      // El `keyup` puede llegar tarde con la máquina cargada y el motor sigue integrando
      // mientras tanto: limpiar sus teclas retenidas en la misma tarea corta el avance en
      // el frame siguiente, sin depender de cuándo se entregue el evento.
      window.__eko?.clearHeldKeys?.();
      for (const tecla of teclas) {
        const letra = tecla.slice(3).toLowerCase();
        for (const destino of [window, document]) {
          destino.dispatchEvent(
            new KeyboardEvent('keyup', { code: tecla, key: letra, bubbles: true })
          );
        }
      }
    }, TECLAS_DE_MOVIMIENTO)
    .catch(() => {});
}

/** Tick, reloj de simulación y posición del jugador en una sola lectura. */
function leerMuestra(page) {
  return page.evaluate(() => {
    const snap = window.__eko?.snapshot();
    if (!snap?.player) return null;
    return { tick: snap.tick, tiempo: snap.tiempo, x: snap.player.x, y: snap.player.y };
  });
}

/**
 * Espera a que el cuerpo esté parado de verdad, no sólo a que dos lecturas
 * coincidan: con la máquina cargada dos lecturas en el mismo tick coinciden aunque
 * el motor esté a punto de avanzar. Se espera un cambio de tick, y si en el tick
 * nuevo el cuerpo se movió, el `keyup` no llegó al motor y se vuelve a soltar.
 */
async function asentarCuerpo(page) {
  let anterior = await leerMuestra(page);
  for (let intento = 0; intento < 40 && anterior; intento += 1) {
    await page.waitForTimeout(30);
    const actual = await leerMuestra(page);
    if (!actual) return;
    if (actual.tick === anterior.tick) continue;
    if (Math.hypot(actual.x - anterior.x, actual.y - anterior.y) <= 0.5) return;
    await soltarTeclas(page);
    anterior = actual;
  }
}

/**
 * Suelta las teclas y espera a que el cuerpo se quede quieto; si deriva, vuelve a soltar.
 * Devuelve la última posición leída, ya sin deriva.
 */
async function aquietar(page, jugador) {
  await soltarTeclas(page);
  await asentarCuerpo(page);
  return (await leerMuestra(page)) ?? jugador;
}

/**
 * Acerca al operador a un punto sosteniendo la tecla hasta que el cuerpo llega.
 *
 * El toque va en lazo cerrado sobre la posición, no sobre un cronómetro: se lee el motor
 * cada 25 ms y la tecla sigue puesta mientras el cuerpo se acerque. Con el runner cargado
 * el `keydown` puede tardar en llegar al motor, y una dosis por tiempo se vencía antes de
 * mover: en el CI el operador se quedó 12 s de simulación en 204.7 px sin avanzar. Aquí
 * ese retraso sólo alarga el toque. El corte limpia las teclas retenidas del motor, así
 * que un `keyup` tardío tampoco empuja al cuerpo más allá del punto. El presupuesto de la
 * caminata sigue en simulación.
 */
async function seguirHasta(page, punto, { holgura = HOLGURA_PASO, tope = TOPE_CAMINATA } = {}) {
  const comienzo = Date.now();
  let muestras = 0;
  let jugador = await leerMuestra(page);
  if (!jugador) throw new Error('window.__eko no expone un jugador');
  const arranque = jugador;
  let sinAvance = 0;
  let rodeos = 0;
  let simulacion = 0;
  let motivo = 'tope';
  while (true) {
    const dx = punto.x - jugador.x;
    const dy = punto.y - jugador.y;
    const distancia = Math.hypot(dx, dy);
    simulacion = Math.max(0, jugador.tiempo - arranque.tiempo);
    if (distancia <= holgura) {
      // El cuerpo ya viene parado: `sostenerHasta` cortó y asentó en el toque anterior, y
      // cada caminata termina con `aquietar`. Volver a asentar acá sumaba una parada por
      // tramo —siete en el barrido de la cocina— y era lo que agotaba el presupuesto.
      return { ok: true, muestras, distancia, jugador, simulacion };
    }
    if (simulacion > tope || Date.now() - comienzo > TOPE_RELOJ_CAMINATA) break;
    const teclas = [];
    if (Math.abs(dx) > 1.5) teclas.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 1.5) teclas.push(dy > 0 ? 'KeyS' : 'KeyW');
    if (!teclas.length) break;
    // Un Escape rezagado de un paso anterior puede abrir la pausa a mitad de caminata:
    // el motor deja de leer el movimiento y el cuerpo no avanza. Se cierra y se sigue.
    if (sinAvance >= 2) {
      const pausa = await page
        .evaluate(() => window.__eko?.snapshot()?.gameState ?? null)
        .catch(() => null);
      if (pausa === 'PAUSED') {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        sinAvance = 0;
        jugador = (await leerMuestra(page)) ?? jugador;
        continue;
      }
    }
    // Trabado: el cuerpo se engancha en un jamb que la rejilla no distingue. Un paso
    // perpendicular corto lo desengancha y el toque siguiente vuelve al rumbo.
    if (sinAvance >= 2 && rodeos < 8) {
      // Dos perpendiculares: la primera puede dar contra el jamb que traba al cuerpo.
      // Alternarlas evita insistir contra la misma pared hasta agotar el tope.
      const porY = Math.abs(dx) >= Math.abs(dy);
      const costados = porY
        ? [dy >= 0 ? 'KeyS' : 'KeyW', dx >= 0 ? 'KeyD' : 'KeyA']
        : [dx >= 0 ? 'KeyD' : 'KeyA', dy >= 0 ? 'KeyS' : 'KeyW'];
      await pulsarTeclas(page, [costados[rodeos % 2]]);
      rodeos += 1;
      sinAvance = 0;
      jugador = (await leerMuestra(page)) ?? jugador;
      muestras += 1;
      continue;
    }
    // Se apunta a un poco más cerca que la holgura: el frame que se procesa entre la
    // última lectura y el corte puede dejar al cuerpo unos píxeles más allá.
    const segundos = Math.max(0.03, (distancia - MARGEN_FRENADA) / VELOCIDAD_CAMINATA);
    const actual = await sostenerHasta(page, teclas, punto, segundos, tope - simulacion);
    if (!actual) break;
    const avance = Math.hypot(actual.x - jugador.x, actual.y - jugador.y);
    sinAvance = avance < 0.5 ? sinAvance + 1 : 0;
    jugador = actual;
    muestras += 1;
  }
  jugador = await aquietar(page, jugador);
  const distancia = Math.hypot(punto.x - jugador.x, punto.y - jugador.y);
  return {
    ok: distancia <= holgura,
    motivo: distancia <= holgura ? '' : motivo,
    distancia,
    muestras,
    jugador,
    simulacion,
  };
}

/**
 * Sostiene las teclas el tiempo de simulación que cuesta recorrer la distancia pedida y
 * corta en el acto.
 *
 * El reloj empieza a contar cuando el cuerpo se mueve, no cuando se pulsa: con el runner
 * cargado el `keydown` puede tardar en llegar al motor y una dosis que arranca en la
 * pulsación se vencía antes de mover —el CI se quedó 12 s de simulación con el operador
 * en 204.7 px—. Si el cuerpo no arranca en `ESPERA_PRIMER_PASO` ms, el toque termina y el
 * bucle decide con el rodeo. También se corta si el cuerpo cruza el punto: seguir de
 * largo es lo que lo dejaba 50 px más allá del carril, contra el jamb. El corte no
 * depende del `keyup`: `soltarTeclas` limpia las teclas retenidas del motor.
 */
async function sostenerHasta(page, teclas, punto, segundos, restanteSim) {
  for (const tecla of teclas) await page.keyboard.down(tecla);
  const limite = Date.now() + TOPE_RELOJ_TOQUE;
  let actual = null;
  try {
    const referencia = await leerMuestra(page);
    let inicio = null;
    const esperaMax = Math.min(limite, Date.now() + ESPERA_PRIMER_PASO);
    while (Date.now() < esperaMax) {
      await page.waitForTimeout(20);
      actual = await leerMuestra(page);
      if (!actual || !referencia) break;
      if (Math.hypot(actual.x - referencia.x, actual.y - referencia.y) > 0.5) {
        inicio = actual;
        break;
      }
    }
    if (inicio) {
      const objetivo = Math.min(segundos, restanteSim);
      while (Date.now() < limite) {
        await page.waitForTimeout(20);
        actual = await leerMuestra(page);
        if (!actual) break;
        if (actual.tiempo - inicio.tiempo >= objetivo) break;
        const cruzoX =
          Math.abs(punto.x - inicio.x) > 1 &&
          Math.sign(punto.x - actual.x) !== Math.sign(punto.x - inicio.x);
        const cruzoY =
          Math.abs(punto.y - inicio.y) > 1 &&
          Math.sign(punto.y - actual.y) !== Math.sign(punto.y - inicio.y);
        if (cruzoX || cruzoY) break;
      }
    }
  } finally {
    await soltarTeclas(page);
  }
  await page.waitForTimeout(ASENTAR_MS);
  await asentarCuerpo(page);
  return (await leerMuestra(page)) ?? actual;
}

/** Pulso corto de desenganche: baja la tecla, la sostiene `ms` y la suelta en el acto. */
async function pulsarTeclas(page, teclas, ms = 90) {
  for (const tecla of teclas) await page.keyboard.down(tecla);
  try {
    await page.waitForTimeout(ms);
  } finally {
    await soltarTeclas(page);
  }
  await page.waitForTimeout(ASENTAR_MS);
  await asentarCuerpo(page);
}

/**
 * Lleva al operador a `destino` por una ruta derivada del snapshot.
 *
 * `caminarHasta(tecla, umbral)` codificaba la geometría del mapa en la comprobación:
 * sostenía una tecla hasta cruzar una coordenada y el carril de cada vano se corregía
 * aparte, a mano. Con una puerta nueva en el mapa eso deja de valer. Aquí la ruta la
 * calcula `planificarRuta` sobre muros, hojas y mobiliario con 17 px de holgura, cruza
 * cada vano por su punto medio y termina en la coordenada pedida; lo que se afirma al
 * final es esa coordenada, no la tecla. Un eje que no se pide conserva la posición
 * actual, igual que antes.
 */
async function caminarA(page, destino, paso) {
  if (!paso) throw new Error(`caminarA sin etiqueta de paso (${JSON.stringify(destino)})`);
  const desde = await leerMuestra(page);
  if (!desde) throw new Error('window.__eko no expone un jugador');
  const objetivo = { x: destino.x ?? desde.x, y: destino.y ?? desde.y };
  const comienzo = Date.now();
  const estado = await page.evaluate(() => {
    const snap = window.__eko?.snapshot();
    return snap ? { mundo: snap.world, gameState: snap.gameState } : null;
  });
  if (!estado) throw new Error('window.__eko no expone el motor');
  // Con el menú de pausa abierto el motor no lee el movimiento: un Escape lo cierra.
  if (estado.gameState === 'PAUSED') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  const ruta = planificarRuta(estado.mundo, desde, objetivo);
  const consumido = () => Date.now() - comienzo;
  /** Segundos de simulación que lleva la caminata: es lo que el cuerpo consume al andar. */
  const simulacionConsumida = (muestra) =>
    Math.max(0, (muestra?.tiempo ?? desde.tiempo) - desde.tiempo);
  const fila = {
    paso,
    destino: objetivo,
    ms: 0,
    sim: 0,
    px: 0,
    objetivo: Math.hypot(objetivo.x - desde.x, objetivo.y - desde.y),
    tramos: ruta.puntos.length,
    muestras: 0,
  };
  let ultimaMuestra = desde;
  let final = desde;
  try {
    if (!ruta.puntos.length) {
      const bloqueo = await diagnosticoDelBloqueo(page).catch(() => null);
      const estorbo = bloqueo?.obstaculos?.length
        ? bloqueo.obstaculos.map(describirObstaculo).join('; ')
        : `nada a menos de ${RADIO_OBSTACULO} px del operador`;
      throw new Error(
        `sin ruta hasta (${objetivo.x.toFixed(1)}, ${objetivo.y.toFixed(1)}) durante «${paso}» ` +
          `(${ruta.motivo}; jugador en ${desde.x.toFixed(1)}, ${desde.y.toFixed(1)}; ${estorbo})`
      );
    }
    let muestras = 0;
    for (let tramo = 0; tramo < ruta.puntos.length; tramo += 1) {
      const punto = ruta.puntos[tramo];
      const ultimo = tramo === ruta.puntos.length - 1;
      const seguimiento = await seguirHasta(page, punto, {
        // El último tramo se da por bueno con la tolerancia de la aserción final: exigirle
        // más precisión que la que se afirma deja al operador sin margen en un rincón.
        holgura: ultimo ? HOLGURA_DESTINO : HOLGURA_PASO,
        tope: Math.max(0.5, TOPE_CAMINATA - simulacionConsumida(ultimaMuestra)),
      });
      muestras += seguimiento.muestras;
      fila.muestras = muestras;
      ultimaMuestra = seguimiento.jugador;
      fila.sim = simulacionConsumida(ultimaMuestra);
      if (!seguimiento.ok) {
        const bloqueo = await diagnosticoDelBloqueo(page).catch(() => null);
        const jugador = bloqueo?.jugador ?? seguimiento.jugador ?? null;
        const binomio = bloqueo?.binomio ?? null;
        const estorbo = bloqueo?.obstaculos?.length
          ? bloqueo.obstaculos.map(describirObstaculo).join('; ')
          : `nada a menos de ${RADIO_OBSTACULO} px del operador`;
        throw new Error(
          `el operador no llegó al tramo ${tramo + 1}/${ruta.puntos.length} de «${paso}» ` +
            `en ${TOPE_CAMINATA} s de simulación (${seguimiento.motivo}; ` +
            `${consumido()} ms de reloj; faltaban ` +
            `${Number.isNaN(seguimiento.distancia) ? '?' : seguimiento.distancia.toFixed(1)} px ` +
            `para (${punto.x}, ${punto.y}) de la ruta ` +
            `${ruta.puntos.map((item) => `(${item.x}, ${item.y})`).join(' → ')}; ` +
            `jugador en ${jugador ? `${jugador.x.toFixed(1)}, ${jugador.y.toFixed(1)}` : '?'}` +
            `; binomio en ${binomio ? `${binomio.x.toFixed(1)}, ${binomio.y.toFixed(1)}` : '?'}` +
            `; juego ${bloqueo?.estado ?? '?'}` +
            `${bloqueo?.modal ? ` con ${bloqueo.modal} abierto` : ''}` +
            `${bloqueo?.foco === false ? ' (sin foco)' : ''}` +
            `; ${estorbo})`
        );
      }
    }
    // El motor empuja al cuerpo al rozar un jamb, así que el último tramo puede
    // dejarlo unos píxeles fuera: antes de afirmar la coordenada se corrige una vez.
    final = await leerMuestra(page);
    if (!final) throw new Error('window.__eko no expone un jugador al terminar la ruta');
    final = await aquietar(page, final);
    if (Math.max(Math.abs(final.x - objetivo.x), Math.abs(final.y - objetivo.y)) > HOLGURA_FINAL / 2) {
      // La corrección apunta a la tolerancia que después se afirma. Con un objetivo de
      // 2 px —más fino que el toque más corto— el caminante rebota y el tope de la
      // pasada lo deja fuera por décimas: el CI falló a 12,1 px con la aserción en 12.
      await seguirHasta(page, objetivo, { holgura: HOLGURA_DESTINO, tope: 1.5 });
      final = await aquietar(page, (await leerMuestra(page)) ?? final);
    }
    fila.px = Math.hypot(final.x - desde.x, final.y - desde.y);
    const desvio = Math.max(Math.abs(final.x - objetivo.x), Math.abs(final.y - objetivo.y));
    if (desvio > HOLGURA_DESTINO) {
      const bloqueo = await diagnosticoDelBloqueo(page).catch(() => null);
      const estorbo = bloqueo?.obstaculos?.length
        ? bloqueo.obstaculos.map(describirObstaculo).join('; ')
        : `nada a menos de ${RADIO_OBSTACULO} px del operador`;
      throw new Error(
        `el operador quedó en (${final.x.toFixed(1)}, ${final.y.toFixed(1)}) y no en ` +
          `(${objetivo.x.toFixed(1)}, ${objetivo.y.toFixed(1)}) durante «${paso}»: ` +
          `${desvio.toFixed(1)} px de desvío, tolerancia ${HOLGURA_DESTINO} px ` +
          `(ruta ${ruta.puntos.map((item) => `(${item.x}, ${item.y})`).join(' → ')}` +
          `; jugador en ${final.x.toFixed(1)}, ${final.y.toFixed(1)}` +
          `; binomio en ${bloqueo?.binomio ? `${bloqueo.binomio.x.toFixed(1)}, ${bloqueo.binomio.y.toFixed(1)}` : '?'}` +
          `; juego ${bloqueo?.estado ?? '?'}` +
          `${bloqueo?.modal ? ` con ${bloqueo.modal} abierto` : ''}` +
          `; ${estorbo})`
      );
    }
  } finally {
    fila.ms = consumido();
    fila.sim = simulacionConsumida(ultimaMuestra);
    registrarCaminata(fila);
  }
}

/** Caja interior de la cocina donde tiene sentido apostar al binomio. */
const CAJA_APOSTADERO = { x0: 372, y0: 112, x1: 642, y1: 272 };

/**
 * Elige dónde apostar a Kobra-2 para que su cámara de casco vea al rendido.
 *
 * Antes el punto se ponía a `CERCANIA_CAMARA` px sobre la recta rendido -> barrido, sin
 * mirar la geometría: si un mueble con `blocksSight` o una hoja quedaban en medio, la
 * cámara no lo veía aunque el binomio llegara al punto exacto. Aquí se prueban
 * candidatos alrededor del rendido —primero hacia el barrido, luego girando— y se
 * acepta el primero que cumple las dos cosas que exige el motor:
 *
 *   - paso: el punto queda a `radio + MARGEN_PARED` (17 px) de muros y hojas cerradas,
 *     a 14 px de los muebles que bloquean el paso y a 22 px de los jambs;
 *   - visión: el segmento rendido -> punto no cruza muros, hojas ni muebles de vista,
 *     mirando sólo el tramo que va del cuerpo del rendido al punto.
 *
 * Todos los radios probados quedan por debajo de 85 px, donde la cámara del binomio no
 * depende del ángulo con el que llegue. Devuelve `{ punto, motivo }`: `punto` con la
 * posición elegida y `motivo` con cuántos candidatos se descartaron por cada causa.
 */
async function elegirApostaderoDeCamara(page, { sospechoso, hacia, distancias }) {
  return page.evaluate(
    ({ sx, sy, hx, hy, radios, caja }) => {
      const estado = window.__eko?.snapshot();
      if (!estado) return { punto: null, motivo: 'sin snapshot' };

      const RADIO = 14;
      const MARGEN_PARED = 3;
      const HOLGURA = RADIO + MARGEN_PARED;
      const HOLGURA_JAMB = 22;

      const aSegmento = (px, py, segmento) => {
        const dx = segmento.bx - segmento.ax;
        const dy = segmento.by - segmento.ay;
        const largo = dx * dx + dy * dy;
        if (!largo) return Math.hypot(px - segmento.ax, py - segmento.ay);
        const t = Math.max(
          0,
          Math.min(1, ((px - segmento.ax) * dx + (py - segmento.ay) * dy) / largo)
        );
        return Math.hypot(px - (segmento.ax + dx * t), py - (segmento.ay + dy * t));
      };
      const parametroDeCruce = (ax, ay, bx, by, segmento) => {
        const denom =
          (segmento.by - segmento.ay) * (bx - ax) - (segmento.bx - segmento.ax) * (by - ay);
        if (denom === 0) return null;
        const ua =
          ((segmento.bx - segmento.ax) * (ay - segmento.ay) -
            (segmento.by - segmento.ay) * (ax - segmento.ax)) /
          denom;
        const ub =
          ((bx - ax) * (ay - segmento.ay) - (by - ay) * (ax - segmento.ax)) / denom;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1 ? ua : null;
      };

      // Muros y hojas que frenan el paso.
      const solidos = [];
      for (const muro of estado.world.walls ?? []) {
        solidos.push({ ax: muro.x1, ay: muro.y1, bx: muro.x2, by: muro.y2, id: muro.id });
      }
      const puertas = estado.world.doors ?? [];
      for (const puerta of puertas) {
        if (!puerta.isFullyOpen && !puerta.isDestroyed && !puerta.isBreached) {
          solidos.push({ ax: puerta.x1, ay: puerta.y1, bx: puerta.x2, by: puerta.y2, id: puerta.id });
        }
      }
      const mueblesSolidos = (estado.world.furniture ?? []).filter(
        (mueble) => mueble.blocksMovement && !mueble.isDestroyed
      );

      // Lo que corta la visión: muros, hojas y muebles de vista (igual que `raycastSurface`).
      const bloqueantes = solidos.slice();
      for (const mueble of estado.world.furniture ?? []) {
        if (!mueble.blocksSight || mueble.isDestroyed) continue;
        const { x, y, w, h } = mueble;
        bloqueantes.push(
          { ax: x, ay: y, bx: x + w, by: y, id: mueble.id },
          { ax: x + w, ay: y, bx: x + w, by: y + h, id: mueble.id },
          { ax: x + w, ay: y + h, bx: x, by: y + h, id: mueble.id },
          { ax: x, ay: y + h, bx: x, by: y, id: mueble.id }
        );
      }

      const motivo = { fueraDeCaja: 0, sinPaso: 0, sinVision: 0 };
      // Primero hacia el barrido (el operador queda lejos) y luego girando 22,5° a 67,5°.
      const base = Math.atan2(hy, hx);
      const giros = [0, 0.3927, -0.3927, 0.7854, -0.7854, 1.1781, -1.1781, Math.PI];

      for (const radio of radios) {
        for (const giro of giros) {
          const angulo = base + giro;
          const px = sx + Math.cos(angulo) * radio;
          const py = sy + Math.sin(angulo) * radio;
          if (px < caja.x0 || px > caja.x1 || py < caja.y0 || py > caja.y1) {
            motivo.fueraDeCaja += 1;
            continue;
          }

          let pasoLibre = true;
          for (const segmento of solidos) {
            if (aSegmento(px, py, segmento) < HOLGURA) {
              pasoLibre = false;
              break;
            }
          }
          if (pasoLibre) {
            for (const mueble of mueblesSolidos) {
              const cx = Math.max(mueble.x, Math.min(px, mueble.x + mueble.w));
              const cy = Math.max(mueble.y, Math.min(py, mueble.y + mueble.h));
              if (Math.hypot(px - cx, py - cy) < RADIO) {
                pasoLibre = false;
                break;
              }
            }
          }
          // El jamb de una puerta franca sigue estorbando: la hoja abierta cuelga de uno.
          if (pasoLibre) {
            for (const puerta of puertas) {
              const a = Math.hypot(px - puerta.x1, py - puerta.y1);
              const b = Math.hypot(px - puerta.x2, py - puerta.y2);
              if (Math.min(a, b) < HOLGURA_JAMB) {
                pasoLibre = false;
                break;
              }
            }
          }
          if (!pasoLibre) {
            motivo.sinPaso += 1;
            continue;
          }

          const largo = Math.hypot(px - sx, py - sy) || 1;
          let visionLibre = true;
          for (const segmento of bloqueantes) {
            const t = parametroDeCruce(sx, sy, px, py, segmento);
            if (t === null) continue;
            // El cuerpo del rendido y los últimos píxeles del punto no bloquean.
            if (t * largo > RADIO && (1 - t) * largo > 8) {
              visionLibre = false;
              break;
            }
          }
          if (!visionLibre) {
            motivo.sinVision += 1;
            continue;
          }

          return {
            punto: { x: px, y: py, radio, grados: Math.round((angulo * 180) / Math.PI) },
            motivo,
          };
        }
      }
      return { punto: null, motivo };
    },
    {
      sx: sospechoso.x,
      sy: sospechoso.y,
      hx: hacia.x,
      hy: hacia.y,
      radios: distancias,
      caja: CAJA_APOSTADERO,
    }
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
/**
 * Aparta al operador del carril de la hoja antes de cerrarla.
 *
 * Con la hoja cerrada el motor rechaza cualquier paso cuyo destino siga a menos de
 * `HOLGURA_CUERPO` (17 px) de la hoja cerrada, así que un cuerpo que queda dentro de
 * esa banda al cerrar no puede salir: cada paso corto vuelve a caer dentro y el
 * operador queda encerrado en el vano. Por eso la puerta se cierra desde el carril,
 * a dos holguras del plano de la hoja cerrada, que es el mismo eje que usa la ruta.
 */
async function apartarseDeLaHoja(page, puerta) {
  const jugador = await leerJugador(page);
  if (!jugador) return;
  const dx = puerta.x2 - puerta.x1;
  const dy = puerta.y2 - puerta.y1;
  const largo = Math.hypot(dx, dy);
  if (!largo) return;
  const normal = { x: -dy / largo, y: dx / largo };
  const medio = { x: (puerta.x1 + puerta.x2) / 2, y: (puerta.y1 + puerta.y2) / 2 };
  const lado = Math.sign((jugador.x - medio.x) * normal.x + (jugador.y - medio.y) * normal.y) || 1;
  const distancia = Math.abs(
    (jugador.x - medio.x) * normal.x + (jugador.y - medio.y) * normal.y
  );
  if (distancia >= HOLGURA_CUERPO * 2) return;
  await caminarA(
    page,
    {
      x: medio.x + normal.x * lado * HOLGURA_CUERPO * 2,
      y: medio.y + normal.y * lado * HOLGURA_CUERPO * 2,
    },
    `apartarse de ${puerta.id} para cerrarla`
  );
}

async function accionarPuerta(page, puertaId, hecho, { alCerrar = false } = {}) {
  await acercarseAPuerta(page, puertaId);
  if (alCerrar) {
    const puerta = await leerPuerta(page, puertaId);
    if (puerta?.isFullyOpen) await apartarseDeLaHoja(page, puerta);
  }
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

/** El tablero entero del EKO-Pad, para decir en el fallo dónde cayó el contacto. */
async function tableroEnPad(page) {
  await page.keyboard.press('KeyM');
  await page.locator('[data-testid="pad-despeje"]').waitFor({ state: 'visible', timeout: 8000 });
  const filas = (await leerDespejePad(page)) ?? [];
  await page.keyboard.press('Escape');
  return filas;
}

/** Estancias despejadas que lista el último autoguardado, para los mensajes de fallo. */
async function despejadasGuardadas(page) {
  return JSON.stringify((await leerGuardado(page))?.estanciasDespejadas ?? null);
}

/** Comprueba que la partida guardada se reanuda sin reiniciar la misión. */
export async function comprobarPersistencia(page, { url }) {
  try {
    await arrancarMision(page, url, MISION, { asentarMs: 400 });
    // Antes de mover nada se afirma el escenario: así un fallo en un paso se puede
    // atribuir al paso. Sin esta huella, una partida guardada heredada o una misión
    // retomada cambian el punto de partida y el fallo no dice de qué es.
    const mundoInicial = await page.evaluate(() => window.__eko?.snapshot()?.world ?? null);
    if (!mundoInicial) {
      fail('persistencia: el motor no publica el mundo al arrancar');
      return;
    }
    const huella = huellaDelMundo(mundoInicial);
    const recuento = contarMundo(mundoInicial);
    const escenario = `${recuento.muros} muros, ${recuento.puertas} puertas, ${recuento.muebles} muebles`;
    if (huella !== HUELLA_MUNDO_ESPERADA) {
      fail(
        `persistencia: el mundo no es el procedural de la semilla ${SEMILLA_E2E_TEXTO} ` +
          `(huella ${huella}, esperada ${HUELLA_MUNDO_ESPERADA}; ${escenario}); el estado ` +
          `de partida no es un arranque limpio, así que un fallo posterior no es del paso`
      );
      return;
    }
    console.log(`persistencia: mundo procedural ${SEMILLA_E2E_TEXTO} · huella ${huella} · ${escenario}`);
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

    await caminarA(page, { x: X_DENTRO_SALA }, `entrar en ${SALA_DESPEJADA}`);
    if (!(await esperarHudDespejadas(page, despejadasEnSala))) {
      const hud = await leerDespejeHud(page);
      fail(
        `persistencia: al entrar en ${SALA_DESPEJADA} el HUD cuenta ${hud?.despejadas ?? '?'} ` +
          `despejadas en vez de ${despejadasEnSala}`
      );
      return;
    }

    await caminarA(page, { x: X_FUERA_SALA }, `salir de ${SALA_DESPEJADA}`);
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
    await caminarA(page, { x: 300 }, `volver a ${PUERTA_ENTRADA} desde ${SALA_DESPEJADA}`);
    if (!(await accionarPuerta(page, PUERTA_ENTRADA, (puerta) => puerta.isOpen === false, { alCerrar: true }))) {
      fail(
        `persistencia: ${PUERTA_ENTRADA} no queda cerrada antes del barrido ` +
          `(${await distanciaAPuerta(page, PUERTA_ENTRADA)})`
      );
      return;
    }
    await caminarA(page, { x: 390 }, `cruzar el recibidor hacia ${PUERTA_SALON}`);

    // Salón: se entra un paso y se sale para dejarlo DESPEJADO y en la memoria sin
    // acercarse a Milán (285 px). La puerta se cierra al salir, así que después el
    // espejo de la sonda será el único que pueda delatarlo.
    await caminarA(page, { y: 430 }, `bajar al vano de ${PUERTA_SALON}`);
    await caminarA(page, { x: 500 }, `acercarse a ${PUERTA_SALON}`);
    if (!(await accionarPuerta(page, PUERTA_SALON, (puerta) => puerta.isFullyOpen))) {
      fail(
        `persistencia: ${PUERTA_SALON} no se abre para entrar al salón ` +
          `(${await distanciaAPuerta(page, PUERTA_SALON)})`
      );
      return;
    }
    await caminarA(page, { x: 545 }, `entrar en ${SALA_SONDA}`);
    const estadoAlEntrar = await estadoEnPad(page, SALA_SONDA);
    if (estadoAlEntrar !== 'DESPEJADA') {
      fail(
        `persistencia: ${SALA_SONDA} no queda DESPEJADA al entrar ` +
          `(pad: ${estadoAlEntrar ?? 'ausente'}; jugador en ${await dondeEsta(page)})`
      );
      return;
    }
    await caminarA(page, { x: 500 }, `salir de ${SALA_SONDA} al vano`);
    if (!(await accionarPuerta(page, PUERTA_SALON, (puerta) => puerta.isOpen === false, { alCerrar: true }))) {
      fail(
        `persistencia: ${PUERTA_SALON} no queda cerrada al salir del salón ` +
          `(${await distanciaAPuerta(page, PUERTA_SALON)})`
      );
      return;
    }
    await caminarA(page, { x: 390 }, `volver al recibidor desde ${SALA_SONDA}`);

    // VORRAUM está DESPEJADA por la memoria restaurada. La cocina, en cambio,
    // guarda al cómplice. El grito va con la puerta cerrada: el muro amortigua la
    // caída de moral (−9 por grito), así que se rinde sin abrir fuego. Un rendido
    // sigue siendo un hostil sin resolver —cuenta como contacto hasta que se le
    // esposa—, pero su IA queda inerte y el barrido no depende de su puntería ni
    // de que no oiga los pasos (ver la cabecera: con un hostil activo la prueba
    // no es determinista).
    await caminarA(page, { y: 330 }, `entrar en ${SALA_CONTACTO}`);
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

    // [E] sobre la hoja es la puerta, no el arresto: el rendido de detrás tiene que
    // seguir en pie con las manos arriba. Si la comprobación lo encuentra esposado o
    // desaparecido, el fallo se nombra en el paso de la puerta y no más tarde, como
    // un rendido que nunca llegó al barrido.
    const rendidoTrasLaPuerta = await hostilEnSala(page, SALA_CONTACTO);
    if (rendidoTrasLaPuerta?.state !== 'SURRENDERED') {
      fail(
        `persistencia: al abrir ${PUERTA_COCINA} el rendido de ${SALA_CONTACTO} ` +
          `desapareció (${rendidoTrasLaPuerta?.state ?? 'sin hostil'}); [E] sobre la ` +
          `hoja lo esposó en vez de accionar la puerta`
      );
      return;
    }

    // Barrido sin verlo: la mira se queda contra la pared del lado contrario al
    // rendido, mientras el operador camina hasta el fondo de la cocina. A más de 95 px
    // y fuera del cono, el rendido no entra en la intel del jugador y la estancia queda
    // DESPEJADA aunque él siga dentro. La distancia y el lado se afirman sobre la
    // posición real del sospechoso, y el punto de barrido se deriva de ella, no se da
    // por supuesto: con la mira fija al este el cono alcanzaba al rendido que deriva
    // hacia ese lado y la cámara dejaba de ser la única fuente del contacto.
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
    // El fondo de la cocina tiene muebles arrimados a las paredes, así que un x derivado
    // del rendido puede caer sin holgura o sin corredor hasta él. Se prueban los puntos
    // de la estancia de rejilla en rejilla y se toma el más lejano al rendido que tenga
    // ruta, corredor recto con holgura de cuerpo y sitio donde pararse. El humo no
    // codifica dónde está el último mueble del mapa.
    let motivoBarrido = 'ningún punto de la cocina deja ruta y holgura';
    let puntoBarrido = { x: PUNTO_BARRIDO.x, y: PUNTO_BARRIDO.y };
    {
      const mundoDelBarrido = await page.evaluate(() => window.__eko.snapshot().world);
      const obstaculosBarrido = obstaculosDelMundo(mundoDelBarrido);
      const corredorLibre = (destino) => {
        const largo = Math.abs(destino.x - PUNTO_BARRIDO.x);
        const pasos = Math.max(1, Math.round(largo / 3));
        for (let paso = 0; paso <= pasos; paso += 1) {
          const x = PUNTO_BARRIDO.x + ((destino.x - PUNTO_BARRIDO.x) * paso) / pasos;
          if (!cabeElCuerpo(x, destino.y, obstaculosBarrido, HOLGURA_BARRIDO)) return false;
        }
        return true;
      };
      const candidatos = [];
      for (let x = X_MINIMA_BARRIDO; x <= X_MAXIMA_BARRIDO; x += PASO_REJILLA) {
        const punto = { x, y: PUNTO_BARRIDO.y };
        if (!cabeElCuerpo(x, punto.y, obstaculosBarrido, HOLGURA_BARRIDO)) continue;
        if (!corredorLibre(punto)) continue;
        candidatos.push(punto);
      }
      // Primero el más lejano: el barrido existe para salir del intel del rendido.
      candidatos.sort(
        (a, b) =>
          Math.hypot(b.x - sospechoso.x, b.y - sospechoso.y) -
          Math.hypot(a.x - sospechoso.x, a.y - sospechoso.y)
      );
      for (const candidato of candidatos) {
        const intento = planificarRuta(mundoDelBarrido, PUNTO_BARRIDO, candidato);
        if (intento.puntos.length) {
          puntoBarrido = candidato;
          motivoBarrido = '';
          break;
        }
        motivoBarrido = intento.motivo;
      }
    }
    // La mira se aparta del rendido, no del punto de partida: el barrido existe para que
    // el hostil quede fuera del intel del operador, y con la mira puesta de su lado el
    // cono lo alcanza a cualquier distancia por debajo del alcance de la linterna. El
    // rendido deriva con el ruido, así que el lado se decide con su posición real.
    const miraBarrido = sospechoso.x >= puntoBarrido.x ? MIRA_BARRIDO_OESTE : MIRA_BARRIDO;
    const distanciaAlBarrido = Math.hypot(
      sospechoso.x - puntoBarrido.x,
      sospechoso.y - puntoBarrido.y
    );
    if (distanciaAlBarrido <= 95) {
      fail(
        `persistencia: el rendido (${sospechoso.x.toFixed(0)}, ${sospechoso.y.toFixed(0)}) queda a ` +
          `${distanciaAlBarrido.toFixed(0)} px del punto de barrido más lejano ` +
          `(${puntoBarrido.x.toFixed(0)}, ${puntoBarrido.y.toFixed(0)}); con menos de 95 entra en intel` +
          (motivoBarrido ? ` [${motivoBarrido}]` : '')
      );
      return;
    }
    await apuntarA(page, miraBarrido);
    await caminarA(
      page,
      { x: puntoBarrido.x, y: puntoBarrido.y },
      `barrido: plantarse en el fondo de ${SALA_CONTACTO}`
    );
    await apuntarA(page, miraBarrido);

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
    await caminarA(page, { x: 390 }, `salir de ${SALA_CONTACTO} al vano`);
    await caminarA(page, { y: 330 }, `bajar al vano de ${PUERTA_SALON} para la sonda`);
    if (!(await accionarPuerta(page, PUERTA_COCINA, (puerta) => puerta.isOpen === false, { alCerrar: true }))) {
      fail(
        `persistencia: ${PUERTA_COCINA} no queda cerrada al salir ` +
          `(${await distanciaAPuerta(page, PUERTA_COCINA)})`
      );
      return;
    }
    await caminarA(page, { y: 430 }, 'bajar al recibidor tras cerrar la cocina');
    await caminarA(page, { x: 470 }, `plantarse junto a ${PUERTA_SALON}`);
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
    await caminarA(page, { x: 390 }, `volver al vano de ${SALA_CONTACTO} para el arresto`);
    await caminarA(page, { y: 330 }, `subir al vano de ${SALA_CONTACTO}`);
    if (!(await accionarPuerta(page, PUERTA_COCINA, (puerta) => puerta.isFullyOpen))) {
      fail(
        `persistencia: ${PUERTA_COCINA} no queda franca para volver a entrar ` +
          `(${await distanciaAPuerta(page, PUERTA_COCINA)})`
      );
      return;
    }
    await apuntarA(page, miraBarrido);
    await caminarA(
      page,
      { x: puntoBarrido.x, y: puntoBarrido.y },
      `arresto: plantarse en el fondo de ${SALA_CONTACTO}`
    );
    await apuntarA(page, miraBarrido);

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
    // abre las puertas que estorban. El apostadero se busca a `CERCANIA_CAMARA` px del
    // rendido, empezando por la recta que lo une con el punto del barrido —así el
    // operador queda lejos— pero sólo se acepta si hay paso y línea de visión en el
    // snapshot: a menos de 85 px la cámara del binomio lo marca sin depender del ángulo
    // con el que llegue, y el operador sigue a más de 95 px del suyo.
    // El rendido se movió desde el barrido (medido: 50 px, y con eso el apostadero de
    // antes quedaba a 108.7 px), así que su posición se relee aquí y el punto se elige
    // comprobando paso y línea de visión sobre el snapshot, no sobre una recta supuesta.
    const rendidoAhora = await hostilEnSala(page, SALA_CONTACTO);
    if (!rendidoAhora) {
      fail(`persistencia: el rendido de ${SALA_CONTACTO} desapareció antes del arresto`);
      return;
    }
    const haciaElBarrido = { x: puntoBarrido.x - rendidoAhora.x, y: puntoBarrido.y - rendidoAhora.y };
    const apostadero = await elegirApostaderoDeCamara(page, {
      sospechoso: rendidoAhora,
      hacia: haciaElBarrido,
      distancias: [CERCANIA_CAMARA, 45, 30],
    });
    if (!apostadero?.punto) {
      fail(
        `persistencia: no hay apostadero con paso y visión al rendido en ` +
          `(${rendidoAhora.x.toFixed(1)}, ${rendidoAhora.y.toFixed(1)}) ` +
          `(descartados ${JSON.stringify(apostadero?.motivo ?? 'sin lectura')})`
      );
      return;
    }
    // La distancia se afirma contra el rendido releído, no contra el del barrido: si el
    // cuerpo se movió, el apostadero queda fuera del alcance de la cámara y el fallo tiene
    // que nombrar la deriva en vez de aparecer después como «no llegó a verlo».
    const derivaDelBarrido = sospechoso
      ? Math.hypot(rendidoAhora.x - sospechoso.x, rendidoAhora.y - sospechoso.y)
      : Number.NaN;
    const distanciaAlRendido = Math.hypot(
      apostadero.punto.x - rendidoAhora.x,
      apostadero.punto.y - rendidoAhora.y
    );
    if (!(distanciaAlRendido < ALCANCE_CAMARA)) {
      fail(
        `persistencia: el apostadero (${apostadero.punto.x.toFixed(1)}, ` +
          `${apostadero.punto.y.toFixed(1)}) queda a ${distanciaAlRendido.toFixed(1)} px del ` +
          `rendido releído (${rendidoAhora.x.toFixed(1)}, ${rendidoAhora.y.toFixed(1)}), fuera ` +
          `del alcance de ${ALCANCE_CAMARA} px de la cámara del binomio; el rendido del barrido ` +
          `estaba en ` +
          `(${sospechoso ? `${sospechoso.x.toFixed(1)}, ${sospechoso.y.toFixed(1)}` : '?'})` +
          (Number.isNaN(derivaDelBarrido) ? '' : `, ${derivaDelBarrido.toFixed(1)} px atrás`)
      );
      return;
    }
    const puntoBinomio = { x: apostadero.punto.x, y: apostadero.punto.y };
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
              binomio: snap?.squad ? { x: snap.squad.x, y: snap.squad.y } : null,
            };
          },
          { selector: PANEL_DESPEJE, sala: SALA_CONTACTO }
        )
        .catch(() => null);
    // El ratón del pad movió también la mira del operador: al cerrar el pad apuntaba al
    // marcador —hacia el rendido— y `visibleToPlayer` pasaba a true, que es justo lo que
    // la comprobación exige que no ocurra. Se devuelve la mira a la pared del lado
    // contrario al rendido, que es la que el cono no alcanza.
    await apuntarA(page, miraBarrido);

    // El HUD publica un solo contacto, el primero del orden del mapa, y el salón sigue en
    // contacto por el espejo de la sonda: la cocina no es lo que muestra
    // `data-en-contacto` aunque su cámara la esté viendo. Lo que aporta la cámara es
    // `visibleToSquad`; que la estancia quede EN_CONTACTO se afirma después, por
    // estancia, en el EKO-Pad.
    // El binomio sigue caminando hacia el marcador cuando la primera línea de visión
    // aparece en el vano: se exige que la vista se sostenga `VISTA_SOSTENIDA_MS` para no
    // tomar un cuadro de paso por contacto estable.
    let porCamara = false;
    let lecturaCamara = null;
    let distanciaBinomio = Number.NaN;
    let desdeQueVe = null;
    const limiteDelSeguimiento = Date.now() + 20000;
    while (Date.now() < limiteDelSeguimiento) {
      lecturaCamara = await leerContactoDeCamara();
      if (!lecturaCamara) break;
      distanciaBinomio =
        lecturaCamara.binomio && lecturaCamara.actor
          ? Math.hypot(
              lecturaCamara.binomio.x - lecturaCamara.actor.x,
              lecturaCamara.binomio.y - lecturaCamara.actor.y
            )
          : Number.NaN;
      // La cámara sólo vale como contacto dentro de su alcance incondicional: más lejos el
      // ángulo decide, y un dato viejo del rendido dejaría pasar un contacto que no existe.
      const ahoraVe =
        lecturaCamara.visibleToSquad &&
        !lecturaCamara.visibleToPlayer &&
        distanciaBinomio < ALCANCE_CAMARA;
      if (ahoraVe) {
        desdeQueVe ??= Date.now();
        if (Date.now() - desdeQueVe >= VISTA_SOSTENIDA_MS) {
          porCamara = true;
          break;
        }
      } else {
        desdeQueVe = null;
      }
      await page.waitForTimeout(60);
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
          `HUD con contacto en ${lecturaCamara?.contacto || 'ninguna estancia'}, ` +
          `a la vista del binomio ` +
          `${lecturaCamara?.visibleToSquad === true}, del operador ` +
          `${lecturaCamara?.visibleToPlayer === true}, a ` +
          `${Number.isNaN(distanciaBinomio) ? '?' : distanciaBinomio.toFixed(1)} px ` +
          `(alcance ${ALCANCE_CAMARA})` +
          (squad && lecturaCamara?.actor
            ? `; rendido en ${lecturaCamara.actor.x.toFixed(1)}, ${lecturaCamara.actor.y.toFixed(1)} ` +
              `a ${Math.hypot(lecturaCamara.actor.x - squad.x, lecturaCamara.actor.y - squad.y).toFixed(1)} px`
            : '') +
          ')'
      );
      return;
    }

    // El binomio se queda donde la cámara ve al rendido. Al llegar al punto de avance el
    // motor suelta el marcador y vuelve a seguirlo al operador, así que la vista se caía
    // entre el bucle y la lectura del pad: el pad marcaba DESPEJADA por ocupación —la
    // regla correcta sin hostil conocido— y el fallo parecía del despeje. HOLD cancela el
    // marcador y lo fija en el apostadero, donde la cámara sigue viéndolo.
    await page.keyboard.press('Digit2');
    await page.waitForFunction(
      () => window.__eko?.snapshot()?.squad?.command === 'HOLD',
      undefined,
      { timeout: 5000 }
    );
    const contactoFijado = await leerContactoDeCamara();
    const distanciaFijada =
      contactoFijado?.binomio && contactoFijado?.actor
        ? Math.hypot(
            contactoFijado.binomio.x - contactoFijado.actor.x,
            contactoFijado.binomio.y - contactoFijado.actor.y
          )
        : Number.NaN;
    if (!contactoFijado?.visibleToSquad || distanciaFijada >= ALCANCE_CAMARA) {
      fail(
        `persistencia: con el binomio en HOLD la cámara deja de ver al rendido ` +
          `(a ${Number.isNaN(distanciaFijada) ? '?' : distanciaFijada.toFixed(1)} px, ` +
          `alcance ${ALCANCE_CAMARA}; vista del binomio ` +
          `${contactoFijado?.visibleToSquad === true}); el contacto tiene que sostenerse ` +
          `sin que nadie siga caminando`
      );
      return;
    }

    const contactoRendido = await estadoEnPad(page, SALA_CONTACTO);
    if (contactoRendido !== 'EN_CONTACTO') {
      const squad = await leerBinomio(page);
      // Lo que la cámara ve en este instante, no en el último muestreo del bucle: si el
      // binomio se movió mientras se abría el pad, el fallo tiene que decirlo con la
      // lectura del momento y con el tablero entero, para no culpar al despeje de un
      // contacto que ya no existe.
      const ahora = await leerContactoDeCamara();
      const tablero = await tableroEnPad(page);
      const enContacto = tablero
        .filter((fila) => fila.estado === 'EN_CONTACTO')
        .map((fila) => fila.sala);
      const distanciaAhora =
        ahora?.binomio && ahora?.actor
          ? Math.hypot(ahora.binomio.x - ahora.actor.x, ahora.binomio.y - ahora.actor.y)
          : Number.NaN;
      fail(
        `persistencia: la cámara del binomio ve al rendido pero ${SALA_CONTACTO} figura ` +
          `${contactoRendido ?? 'ausente'} en el EKO-Pad ` +
          `(binomio en ${squad ? `${squad.x.toFixed(1)}, ${squad.y.toFixed(1)}` : 'sin binomio'}; ` +
          `rendido en ${lecturaCamara?.actor ? `${lecturaCamara.actor.x.toFixed(1)}, ${lecturaCamara.actor.y.toFixed(1)}` : '?'}; ` +
          `a ${Number.isNaN(distanciaBinomio) ? '?' : distanciaBinomio.toFixed(1)} px, alcance ${ALCANCE_CAMARA}; ` +
          `al leer el pad el binomio está en ` +
          `${ahora?.binomio ? `${ahora.binomio.x.toFixed(1)}, ${ahora.binomio.y.toFixed(1)}` : '?'}, ` +
          `el rendido en ${ahora?.actor ? `${ahora.actor.x.toFixed(1)}, ${ahora.actor.y.toFixed(1)}` : '?'} ` +
          `a ${Number.isNaN(distanciaAhora) ? '?' : distanciaAhora.toFixed(1)} px, la vista del binomio ` +
          `${ahora?.visibleToSquad === true}, la del operador ${ahora?.visibleToPlayer === true}, ` +
          `y en contacto ${enContacto.join(', ') || 'ninguna estancia'})`
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
  } finally {
    volcarTablaCaminatas();
  }
}
