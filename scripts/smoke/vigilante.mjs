/**
 * Vigilante de la línea de tiempo del motor.
 *
 * Cada comprobación del humo sólo deja el estado final: cuando «entrar en
 * WOHNZIMMER» avanza 0 px en 8 s, el mensaje dice dónde quedó el cuerpo pero no
 * cuándo dejó de moverse, si la puerta llegó a estar franca, si el binomio se
 * quedó atrás ni si el tick siguió corriendo. Este módulo muestrea cada 250 ms
 * el tick, el jugador, el binomio, los actores y las puertas del recorrido, y al
 * fallar vuelca esa secuencia en `.smoke-fallos/informe.txt`, junto a los
 * mensajes de fallo, para ver cómo se llegó al estado y no sólo cuál fue.
 *
 * El muestreo se dispara desde Node, no con un `setInterval` dentro de la
 * página: el humo recarga la pestaña, y un vigilante in-page moriría con cada
 * recarga, justo en la comprobación que más interesa (persistencia). La lectura
 * es un `evaluate` cada 250 ms que se salta el turno si el anterior sigue en
 * vuelo y que ignora los contextos destruidos por una navegación.
 */

/** Cadencia del muestreo, en ms. */
export const CADENCIA_VIGILANTE = 250;
/** Tope de muestras en memoria: 5 minutos de pasada a 250 ms. */
export const MUESTRAS_MAXIMAS = 1200;
/** Cada cuántas muestras se deja un latido aunque nada cambie (5 s). */
export const LATIDO_MUESTRAS = 20;
/**
 * Tope para dar por perdida una muestra en vuelo. Un `evaluate` lanzado mientras la
 * pestaña navega puede quedarse esperando su contexto de ejecución y no rechazar
 * nunca; sin este tope ese turno dejaba el vigilante congelado el resto de la pasada
 * (medido: se paró en el segundo 167 de una pasada de 210 y el fallo del arresto no
 * llegó al informe).
 */
export const TOPE_MUESTRA_MS = 2000;

/**
 * Puertas que abren el recorrido del humo: entrada, cocina y salón. Son las que
 * decide el paso y las que puede dejar a medias una pulsación de [E]; el resto
 * del mapa no se toca y sólo añadiría ruido a la línea de tiempo.
 */
export const PUERTAS_DEL_RECORRIDO = ['DOOR_MAIN_A', 'DOOR_KITCHEN', 'DOOR_LIVING'];

/**
 * Una sesión por pestaña: la pasada tiene la pestaña principal y, desde que la
 * comprobación de persistencia corre en su propio contexto, una segunda. Cada una
 * lleva su reloj y sus muestras, y el informe las publica por separado.
 */
const sesiones = new Map();

/** Nombre de la sesión que ya existía para esa pestaña, si la hay. */
const nombreDePagina = (page) => {
  for (const [nombre, sesion] of sesiones) if (sesion.page === page) return nombre;
  return null;
};

/** Una muestra del motor, o null si aún no hay partida cargada. */
const tomarMuestra = (page) =>
  page.evaluate((puertas) => {
    const snap = window.__eko?.snapshot();
    if (!snap) return null;
    const decima = (n) => Math.round(n * 10) / 10;
    return {
      estado: snap.gameState ?? null,
      tick: snap.tick ?? null,
      jugador: snap.player ? { x: decima(snap.player.x), y: decima(snap.player.y) } : null,
      binomio: snap.squad
        ? {
            x: decima(snap.squad.x),
            y: decima(snap.squad.y),
            orden: snap.squad.command ?? null,
            puerta: snap.squad.doorTargetId ?? null,
            brecha: snap.squad.breachMode ?? null,
          }
        : null,
      actores: (snap.actors ?? []).map((actor) => ({
        rol: actor.role,
        estado: actor.state,
        sala: actor.roomName,
        x: decima(actor.x),
        y: decima(actor.y),
        vistoOperador: Boolean(actor.visibleToPlayer),
        vistoBinomio: Boolean(actor.visibleToSquad),
        espejo: Boolean(actor.spottedByMirror),
      })),
      puertas: (snap.world?.doors ?? [])
        .filter((puerta) => puertas.includes(puerta.id))
        .map((puerta) => ({
          id: puerta.id,
          abierta: Boolean(puerta.isOpen),
          franca: Boolean(puerta.isFullyOpen),
          conLlave: Boolean(puerta.isLocked),
          brechada: Boolean(puerta.isBreached),
          destruida: Boolean(puerta.isDestroyed),
        })),
    };
  }, PUERTAS_DEL_RECORRIDO);

/** Arranca el muestreo. Reemplaza al anterior si ya había uno. */
export function arrancarVigilante(page, nombre = 'principal') {
  const previa = sesiones.get(nombre);
  if (previa?.intervalo) clearInterval(previa.intervalo);
  const sesion = { page, nombre, inicio: Date.now(), muestras: [], intervalo: null, enVueloDesde: 0 };
  sesiones.set(nombre, sesion);
  const latido = async () => {
    const ahora = Date.now();
    // Se espera a la muestra en vuelo, pero no para siempre: pasados `TOPE_MUESTRA_MS`
    // se da por perdida y se lanza otra, para que una navegación no apague el vigilante.
    if (sesion.enVueloDesde && ahora - sesion.enVueloDesde < TOPE_MUESTRA_MS) return;
    const turno = ahora;
    sesion.enVueloDesde = turno;
    try {
      const muestra = await tomarMuestra(page);
      // Una muestra que llegó cuando ya había otro turno se descarta: puede ser de un
      // documento anterior y ordenaría mal la línea de tiempo.
      if (sesion.enVueloDesde !== turno) return;
      if (!muestra) return;
      sesion.muestras.push({ ms: Date.now() - sesion.inicio, ...muestra });
      if (sesion.muestras.length > MUESTRAS_MAXIMAS) sesion.muestras.shift();
    } catch {
      // Página recargando o cerrándose: el siguiente latido vuelve a intentarlo.
    } finally {
      if (sesion.enVueloDesde === turno) sesion.enVueloDesde = 0;
    }
  };
  void latido();
  sesion.intervalo = setInterval(latido, CADENCIA_VIGILANTE);
  // No debe mantener vivo el proceso si todo lo demás terminó.
  sesion.intervalo.unref?.();
}

/**
 * Corta el muestreo y conserva lo recogido para el volcado. Sin nombre corta todas
 * las sesiones; con nombre, la de esa pestaña.
 */
export function detenerVigilante(nombre) {
  const objetivo = nombre ? sesiones.get(nombre) : null;
  const detener = (sesion) => {
    if (sesion.intervalo) clearInterval(sesion.intervalo);
    sesion.intervalo = null;
    sesion.enVueloDesde = 0;
  };
  if (nombre) {
    if (objetivo) detener(objetivo);
    return;
  }
  for (const sesion of sesiones.values()) detener(sesion);
}

/** Nombre legible del estado de una puerta. */
const describirPuerta = (puerta) => {
  if (puerta.destruida) return 'destruida';
  if (puerta.brechada) return 'brechada';
  if (puerta.franca) return 'franca';
  if (puerta.abierta) return 'a medias';
  if (puerta.conLlave) return 'con llave';
  return 'cerrada';
};

const segundos = (ms) => `${(ms / 1000).toFixed(2).padStart(6)} s`;
const punto = (p) => (p ? `(${p.x}, ${p.y})` : 'sin lectura');

/** Huella de lo observable (sin tick ni reloj) para detectar cambios. */
const huella = (muestra) =>
  JSON.stringify([
    muestra.estado,
    muestra.jugador,
    muestra.binomio,
    muestra.actores,
    muestra.puertas,
  ]);

/** Cabecera de una muestra: tick, estado, jugador y binomio. */
export const cabeceraDeMuestra = (muestra) =>
  `+${segundos(muestra.ms)} · tick ${muestra.tick ?? '?'} · ${muestra.estado ?? '?'} · ` +
  `jugador ${punto(muestra.jugador)} · binomio ${punto(muestra.binomio)}` +
  (muestra.binomio?.orden ? ` ${muestra.binomio.orden}` : '') +
  (muestra.binomio?.puerta ? ` →${muestra.binomio.puerta}` : '') +
  (muestra.binomio?.brecha ? ` brecha ${muestra.binomio.brecha}` : '');

/** Detalle de actores: rol, estado, sala, posición y quién lo ve. */
export const detalleDeActores = (muestra) =>
  `    actores: ${
    muestra.actores.length
      ? muestra.actores
          .map(
            (actor) =>
              `${actor.rol}/${actor.estado}/${actor.sala} (${actor.x}, ${actor.y}) ` +
              `${actor.vistoOperador ? 'J' : 'j'}${actor.vistoBinomio ? 'B' : 'b'}` +
              `${actor.espejo ? 'M' : 'm'}`
          )
          .join('; ')
      : 'ninguno'
  }`;

/** Detalle de las puertas del recorrido. */
export const detalleDePuertas = (muestra) =>
  `    puertas: ${
    muestra.puertas.length
      ? muestra.puertas.map((puerta) => `${puerta.id} ${describirPuerta(puerta)}`).join(', ')
      : 'ninguna del recorrido en el mundo'
  }`;

/**
 * Texto de la línea de tiempo. Con cuatro muestras por segundo y una pasada de
 * minutos, volcar todo son miles de líneas: se emiten sólo las muestras en las
 * que cambia algo observable, más un latido cada `LATIDO_MUESTRAS` para poder
 * distinguir «el motor no avanza» de «el operador no se mueve».
 */
export function formatearLineaDeTiempo(lista, { latido = LATIDO_MUESTRAS, titulo = '' } = {}) {
  if (!lista.length) return '';
  const lineas = [
    titulo ? `## Línea de tiempo del motor — ${titulo}` : '## Línea de tiempo del motor',
    `${lista.length} muestras cada ${CADENCIA_VIGILANTE} ms sobre ` +
      `${(lista[lista.length - 1].ms / 1000).toFixed(1)} s; se listan los cambios de estado ` +
      `y un latido cada ${((latido * CADENCIA_VIGILANTE) / 1000).toFixed(0)} s ` +
      `(J/B/M = visto por operador/binomio/espejo).`,
  ];
  let anterior = null;
  lista.forEach((muestra, indice) => {
    const cambio = anterior === null || huella(muestra) !== huella(anterior);
    const tocaLatido = indice % latido === 0;
    if (cambio) {
      lineas.push(cabeceraDeMuestra(muestra));
      lineas.push(detalleDeActores(muestra));
      lineas.push(detalleDePuertas(muestra));
    } else if (tocaLatido) {
      lineas.push(`${cabeceraDeMuestra(muestra)} (sin cambios)`);
    }
    anterior = muestra;
  });
  return lineas.join('\n');
}

/**
 * Líneas de tiempo recogidas hasta ahora, listas para anexar al informe. Con una
 * sola pestaña el título se omite; con varias, cada bloque dice de cuál es.
 */
export const textoLineaDeTiempo = () =>
  [...sesiones.values()]
    .map((sesion) =>
      formatearLineaDeTiempo(sesion.muestras, {
        titulo: sesiones.size > 1 ? sesion.nombre : '',
      })
    )
    .filter(Boolean)
    .join('\n\n');

/** Sólo para las pruebas: cuántas muestras hay en memoria. */
export const muestrasRecogidas = () =>
  [...sesiones.values()].reduce((total, sesion) => total + sesion.muestras.length, 0);

/** Sesión de la pestaña, para las pruebas. */
export const sesionDe = (page) => {
  const nombre = nombreDePagina(page);
  return nombre ? sesiones.get(nombre) : null;
};
