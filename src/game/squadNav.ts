/**
 * Ruta de Kobra-2 entre estancias para llegar a un objetivo que no está a la
 * vista. La esquiva local del binomio resuelve esquinas y muebles, pero no puede
 * rodear un piso: si el objetivo está al otro lado de una pared, la línea recta
 * lo deja clavado contra el muro. Esta ruta usa el grafo de estancias y puertas
 * del mapa (sólo puertas, nunca cercanía geométrica) y devuelve los hitos para
 * acercarse a cada puerta y cruzarla.
 *
 * Los hitos están desplazados hacia el centro de la estancia correspondiente, no
 * en el vano: así el binomio no se queda parado en el umbral, donde la estancia
 * de origen y la de destino se tocan y la ruta podría volver atrás.
 */

export interface SalaRuta {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PuertaRuta {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly roomA: string;
  readonly roomB: string;
}

export interface PuntoRuta {
  readonly x: number;
  readonly y: number;
}

/** Distancia a la que el binomio se planta antes y después de cruzar una puerta. */
export const SQUAD_DOOR_APPROACH = 30;
/** Radio del vano en el que ya se considera que está cruzando la puerta. */
const UMBRAL_PUERTA = 26;

const centro = (sala: SalaRuta): PuntoRuta => ({
  x: sala.x + sala.w * 0.5,
  y: sala.y + sala.h * 0.5,
});

/** Estancia que contiene el punto, o null si está fuera de todas. */
export function salaDe(
  salas: readonly SalaRuta[],
  punto: PuntoRuta
): SalaRuta | null {
  return (
    salas.find(
      (sala) =>
        punto.x >= sala.x &&
        punto.x <= sala.x + sala.w &&
        punto.y >= sala.y &&
        punto.y <= sala.y + sala.h
    ) ?? null
  );
}

/** Punto a `distancia` del vano, en dirección al centro de la estancia. */
function desplazar(
  desde: PuntoRuta,
  hacia: PuntoRuta,
  distancia: number = SQUAD_DOOR_APPROACH
): PuntoRuta {
  const dx = hacia.x - desde.x;
  const dy = hacia.y - desde.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 1e-6) return { x: desde.x, y: desde.y };
  return { x: desde.x + (dx / largo) * distancia, y: desde.y + (dy / largo) * distancia };
}

/**
 * Hitos para ir de `desde` a `hasta` cruzando las puertas del mapa. Devuelve una
 * lista vacía cuando ya están en la misma estancia o cuando no hay ruta.
 */
export function rutaEntreSalas(
  salas: readonly SalaRuta[],
  puertas: readonly PuertaRuta[],
  desde: PuntoRuta,
  hasta: PuntoRuta
): PuntoRuta[] {
  const origen = salaDe(salas, desde);
  const destino = salaDe(salas, hasta);
  if (!origen || !destino || origen.id === destino.id) return [];

  const porSala = new Map<string, readonly PuertaRuta[]>();
  for (const puerta of puertas) {
    if (!puerta.roomA || !puerta.roomB) continue;
    porSala.set(puerta.roomA, [...(porSala.get(puerta.roomA) ?? []), puerta]);
    porSala.set(puerta.roomB, [...(porSala.get(puerta.roomB) ?? []), puerta]);
  }

  // Anchura por estancias: cada paso guarda con qué puerta se llegó y desde cuál.
  const pasos = new Map<string, { desde: string; puerta: PuertaRuta }>();
  const vistos = new Set([origen.id]);
  const cola = [origen.id];
  while (cola.length > 0) {
    const actual = cola.shift() as string;
    for (const puerta of porSala.get(actual) ?? []) {
      const otra = puerta.roomA === actual ? puerta.roomB : puerta.roomA;
      if (vistos.has(otra)) continue;
      vistos.add(otra);
      pasos.set(otra, { desde: actual, puerta });
      cola.push(otra);
    }
  }
  if (!pasos.has(destino.id)) return [];

  // Reconstrucción hacia atrás: las puertas en el orden en que hay que cruzarlas.
  const camino: { desde: string; puerta: PuertaRuta }[] = [];
  let actual = destino.id;
  while (actual !== origen.id) {
    const paso = pasos.get(actual);
    if (!paso) return [];
    camino.unshift(paso);
    actual = paso.desde;
  }

  const puntos: PuntoRuta[] = [];
  for (const { desde: salaDesde, puerta } of camino) {
    const vano = { x: (puerta.x1 + puerta.x2) * 0.5, y: (puerta.y1 + puerta.y2) * 0.5 };
    const origenSala = salas.find((sala) => sala.id === salaDesde);
    const destinoSala = salas.find(
      (sala) => sala.id === (puerta.roomA === salaDesde ? puerta.roomB : puerta.roomA)
    );
    if (!origenSala || !destinoSala) return [];
    puntos.push(desplazar(vano, centro(origenSala)));
    puntos.push(desplazar(vano, centro(destinoSala)));
  }

  // Ya en el vano de la primera puerta: se descarta el punto de acercamiento.
  const primero = camino[0]?.puerta;
  if (primero) {
    const vano = { x: (primero.x1 + primero.x2) * 0.5, y: (primero.y1 + primero.y2) * 0.5 };
    if (Math.hypot(desde.x - vano.x, desde.y - vano.y) < UMBRAL_PUERTA) puntos.shift();
  }

  return puntos;
}

/**
 * Primer hito de la ruta que el binomio todavía no pisa (o el destino si ya está
 * en la estancia del objetivo). Evita que el punto de acercamiento, una vez
 * alcanzado, lo deje quieto encima del hito.
 */
export function hitoEscuadron(
  salas: readonly SalaRuta[],
  puertas: readonly PuertaRuta[],
  origen: PuntoRuta,
  destino: PuntoRuta
): PuntoRuta {
  return (
    rutaEntreSalas(salas, puertas, origen, destino).find(
      (punto) => Math.hypot(punto.x - origen.x, punto.y - origen.y) > 10
    ) ?? { x: destino.x, y: destino.y }
  );
}
