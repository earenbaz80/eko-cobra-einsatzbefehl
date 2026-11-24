/**
 * Sprites nativos del operador (Kobra-1) y del binomio (Kobra-2).
 *
 * Cada fotograma se compone a 48×48 píxeles de buffer y se dibuja uno a uno: no
 * hay hoja grande reducida ni rotación fraccional. Las ocho direcciones salen de
 * girar la misma descripción de cuerpo en pasos de 45°, y los cuatro fotogramas
 * del paso alternan las piernas, así que la silueta, el arma y el parche de
 * identificación coinciden en todas las poses.
 *
 * Reglas del módulo:
 * 1. Un píxel de arte = un píxel de buffer; el sprite no se reescala al pintarse.
 * 2. Solo se usan colores de `PINCELES_OPERADOR` (paleta cerrada).
 * 3. El volumen es un borde: luz arriba-izquierda, sombra abajo-derecha, sobre la
 *    propia rampa del pincel. Nada de degradados.
 * 4. El sprite se dibuja mirando al este y se gira en pasos de 45°; no se rota
 *    con el ángulo exacto del cursor, para que la rejilla quede intacta.
 */

import { createCanvas } from './bitmap';
import { PINCELES_OPERADOR, type ClavePincel, type Pincel } from './palette';

export const OPERADOR_LADO = 48;
export const OPERADOR_DIRECCIONES = 8;
export const OPERADOR_FRAMES = 4;

export type RolOperador = 'PLAYER' | 'SQUAD';
export type ArmaOperador = 'AUG' | 'CORTA' | 'ESCUDO';
export type AlertaOperador = 'CALM' | 'READY' | 'COMBAT';

export interface OpcionesOperador {
  rol: RolOperador;
  arma: ArmaOperador;
  alerta: AlertaOperador;
  /** 0 = este, 1 = sudeste, 2 = sur, … 7 = nordeste. */
  direccion: number;
  /** 0..3: neutral, paso izquierdo, neutral, paso derecho. */
  frame: number;
}

const LADO = OPERADOR_LADO;
const MEDIO = LADO / 2;
const VACIO = '.';

const CLAVES = {
  contorno: '#',
  uniforme: 'U',
  chaleco: 'V',
  casco: 'H',
  equipo: 'E',
  pantalon: 'P',
  bota: 'B',
  guante: 'G',
  arma: 'A',
  acero: 'S',
  parcheJugador: 'J',
  parcheBinomio: 'b',
  opticaCalma: 'c',
  opticaLista: 'l',
  opticaCombate: 'o',
  escudo: 'D',
  visor: 'W',
} as const satisfies Record<ClavePincel, string>;

const PINCEL_POR_CLAVE: Record<string, ClavePincel> = Object.fromEntries(
  (Object.keys(CLAVES) as ClavePincel[]).map((clave) => [CLAVES[clave], clave])
);

type Rejilla = string[][];

interface Prueba {
  (adelante: number, costado: number): boolean;
}

interface Marco {
  readonly cos: number;
  readonly sin: number;
}

function rejillaVacia(): Rejilla {
  return Array.from({ length: LADO }, () => Array<string>(LADO).fill(VACIO));
}

/**
 * Rasteriza una forma descrita en coordenadas del cuerpo: `adelante` crece hacia
 * donde mira el operador y `costado` hacia su izquierda. La rejilla de 48×48 se
 * recorre una sola vez por forma, así el resultado cae siempre en píxeles enteros.
 */
function pintar(rejilla: Rejilla, clave: ClavePincel, prueba: Prueba, marco: Marco): void {
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const dx = x + 0.5 - MEDIO;
      const dy = y + 0.5 - MEDIO;
      const adelante = dx * marco.cos + dy * marco.sin;
      const costado = dy * marco.cos - dx * marco.sin;
      if (prueba(adelante, costado)) rejilla[y][x] = CLAVES[clave];
    }
  }
}

const recto =
  (adelante0: number, adelante1: number, costado0: number, costado1: number): Prueba =>
  (adelante, costado) =>
    adelante >= adelante0 && adelante <= adelante1 && costado >= costado0 && costado <= costado1;

function caja(
  adelante0: number,
  adelante1: number,
  costado0: number,
  costado1: number,
  radio: number
): Prueba {
  return (adelante, costado) => {
    const f = Math.min(Math.max(adelante, adelante0 + radio), adelante1 - radio);
    const c = Math.min(Math.max(costado, costado0 + radio), costado1 - radio);
    return Math.hypot(adelante - f, costado - c) <= radio;
  };
}

function circulo(adelante: number, costado: number, radio: number): Prueba {
  return (f, c) => Math.hypot(f - adelante, c - costado) <= radio;
}

function capsula(adelante0: number, adelante1: number, costado: number, grosor: number): Prueba {
  const radio = grosor / 2;
  const inicio = Math.min(adelante0, adelante1);
  const fin = Math.max(adelante0, adelante1);
  return (f, c) => {
    const dc = c - costado;
    if (f >= inicio && f <= fin) return Math.abs(dc) <= radio;
    const borde = f < inicio ? inicio : fin;
    return Math.hypot(f - borde, dc) <= radio;
  };
}

function segmento(
  adelante0: number,
  costado0: number,
  adelante1: number,
  costado1: number,
  grosor: number
): Prueba {
  const radio = grosor / 2;
  const df = adelante1 - adelante0;
  const dc = costado1 - costado0;
  const largo2 = df * df + dc * dc;
  return (f, c) => {
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((f - adelante0) * df + (c - costado0) * dc) / largo2));
    return Math.hypot(f - (adelante0 + df * t), c - (costado0 + dc * t)) <= radio;
  };
}

/** Borde de un píxel: completo, sin escalones de dos píxeles. */
function contornear(rejilla: Rejilla): void {
  const original = rejilla.map((fila) => fila.slice());
  const vecinos = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      if (original[y][x] !== VACIO) continue;
      const toca = vecinos.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= LADO || ny >= LADO) return false;
        return original[ny][nx] !== VACIO;
      });
      if (toca) rejilla[y][x] = CLAVES.contorno;
    }
  }
}

/** Dirección 0..7 dentro de las ocho poses, sin importar el ángulo de entrada. */
export function normalizarDireccion(direccion: number): number {
  return ((Math.round(direccion) % OPERADOR_DIRECCIONES) + OPERADOR_DIRECCIONES) % OPERADOR_DIRECCIONES;
}

function pincelDe(clave: string): Pincel | null {
  const nombre = PINCEL_POR_CLAVE[clave];
  return nombre ? PINCELES_OPERADOR[nombre] : null;
}

function componer(opciones: OpcionesOperador): Rejilla {
  const direccion = normalizarDireccion(opciones.direccion);
  const frame = ((Math.round(opciones.frame) % OPERADOR_FRAMES) + OPERADOR_FRAMES) % OPERADOR_FRAMES;
  const angulo = (direccion * Math.PI) / 4;
  const marco: Marco = { cos: Math.cos(angulo), sin: Math.sin(angulo) };
  const rejilla = rejillaVacia();

  const parche: ClavePincel = opciones.rol === 'SQUAD' ? 'parcheBinomio' : 'parcheJugador';
  const optica: ClavePincel =
    opciones.alerta === 'COMBAT' ? 'opticaCombate' : opciones.alerta === 'CALM' ? 'opticaCalma' : 'opticaLista';

  // Cada pieza se dibuja con un anillo de contorno propio antes de su relleno.
  // Esas costuras de un píxel son las que separan piernas, hombros, chaleco y
  // casco dentro de una misma silueta; sin ellas el operador lee como una caja.

  // 1. Piernas y botas: la zancada alterna el pie delantero sin mover la cadera.
  const zancada = [0, 2, 0, -2][frame];
  for (const lado of [-1, 1] as const) {
    const paso = zancada * lado;
    const bota = -11.2 + paso;
    pintar(rejilla, 'contorno', capsula(-10.8, -1.5, lado * 4.9, 5), marco);
    pintar(rejilla, 'pantalon', capsula(-10.4, -1.9, lado * 4.9, 3.8), marco);
    pintar(rejilla, 'contorno', circulo(bota, lado * 4.9, 2.9), marco);
    pintar(rejilla, 'bota', circulo(bota, lado * 4.9, 2.3), marco);
  }

  // 2. Mochila de brecha y radio TETRA, detrás del chaleco.
  pintar(rejilla, 'contorno', caja(-10.4, -5, -4.2, 4.2, 1.8), marco);
  pintar(rejilla, 'equipo', caja(-9.6, -5, -3.4, 3.4, 1.4), marco);

  // 3. Hombreras: más anchas que el torso, que es lo que da la silueta humana
  // vista desde arriba. El torso va después y su contorno deja la costura.
  for (const lado of [-1, 1] as const) {
    pintar(rejilla, 'contorno', capsula(-5.8, 4.4, lado * 8.8, 6), marco);
    pintar(rejilla, 'uniforme', capsula(-5.2, 3.8, lado * 8.8, 5), marco);
  }
  pintar(rejilla, 'contorno', caja(-6.8, 5.4, -6.8, 6.8, 2.7), marco);
  pintar(rejilla, 'chaleco', caja(-6, 4.6, -5.4, 5.4, 2.3), marco);
  for (const costado of [-3.2, 0, 3.2]) {
    pintar(rejilla, 'equipo', recto(1.8, 3.8, costado - 1, costado + 1), marco);
  }
  // Banda reflectante del pecho: da el frente del cuerpo sin usar texto.
  pintar(rejilla, 'visor', recto(4.4, 5.2, -1.6, 1.6), marco);

  // 4. Brazos hacia la empuñadura, antes del arma: el fusil tiene que quedar
  //    delante del cuerpo y no partido por dos anillos oscuros.
  for (const lado of [-1, 1] as const) {
    pintar(rejilla, 'uniforme', segmento(0.5, lado * 7.4, 9.4, lado * 2.8, 3.2), marco);
  }

  // 5. Arma larga por delante del torso, con culata, cargador y cañón.
  if (opciones.arma === 'ESCUDO') {
    pintar(rejilla, 'contorno', caja(5.4, 8.4, -9.6, 9.6, 2.6), marco);
    pintar(rejilla, 'escudo', caja(6, 7.8, -9, 9, 2.2), marco);
    pintar(rejilla, 'visor', recto(6.4, 7.4, -3, 3), marco);
    pintar(rejilla, 'contorno', caja(1, 6.6, 0.4, 3.4, 0.8), marco);
    pintar(rejilla, 'arma', caja(1.4, 6.2, 0.8, 3, 0.5), marco);
    pintar(rejilla, 'acero', recto(6.2, 7.2, 1.2, 2.4), marco);
  } else {
    const largo = opciones.arma === 'AUG' ? 23 : 15;
    const cuerpo = opciones.arma === 'AUG' ? 13 : 10;
    if (opciones.arma === 'AUG') {
      pintar(rejilla, 'contorno', caja(-5, 2, -2.6, 2.6, 0.9), marco);
      pintar(rejilla, 'arma', caja(-4.2, 2, -2.1, 2.1, 0.6), marco);
    }
    // El arma va en acero claro: contra el chaleco casi negro es lo que la hace
    // legible, y es la única pieza del sprite con ese gris.
    pintar(rejilla, 'contorno', caja(2, cuerpo, -2.5, 2.5, 0.8), marco);
    pintar(rejilla, 'arma', caja(2.4, cuerpo - 0.4, -1.9, 1.9, 0.5), marco);
    pintar(rejilla, 'acero', recto(2.6, cuerpo - 0.6, -1.9, -0.3), marco);
    pintar(rejilla, 'contorno', caja(cuerpo, largo, -1.6, 1.6, 0.6), marco);
    pintar(rejilla, 'acero', caja(cuerpo, largo - 1.6, -1.2, 1.2, 0.4), marco);
    pintar(rejilla, 'arma', caja(largo - 1.6, largo, -1.4, 1.4, 0.4), marco);
    pintar(rejilla, 'contorno', caja(3.6, 8, -4.8, -1.8, 0.7), marco);
    pintar(rejilla, 'arma', caja(4, 7.6, -4.4, -2.2, 0.5), marco);
    pintar(rejilla, 'acero', recto(4.2, 7.4, -4.2, -3.4), marco);
  }

  // 6. Guantes cerrados sobre el arma: bloques pequeños y sin contorno propio,
  //    para que el cañón se lea continuo de la culata a la boca.
  for (const lado of [-1, 1] as const) {
    pintar(rejilla, 'guante', caja(9, 11.8, lado * 2.8 - 1.5, lado * 2.8 + 1.5, 0.8), marco);
  }

  // 7. Parche de identificación en la hombrera izquierda: azul para Kobra-1,
  // cian para Kobra-2.
  pintar(rejilla, 'contorno', recto(0.2, 3.4, -10, -7.4), marco);
  pintar(rejilla, parche, recto(0.6, 3, -9.6, -7.8), marco);

  // 8. Casco, orejeras y visor nocturno con el color del estado de alerta. El
  //    casco es más chico que el torso: si iguala el ancho, la silueta se lee
  //    como una olla y no como un operador.
  pintar(rejilla, 'contorno', circulo(3.4, 0, 5.2), marco);
  pintar(rejilla, 'casco', circulo(3.4, 0, 4.5), marco);
  for (const lado of [-1, 1] as const) {
    // Orejeras: apenas sobresalen del casco; si asoman dos círculos enteros,
    // el operador parece un oso de peluche visto desde arriba.
    pintar(rejilla, 'contorno', circulo(2.2, lado * 3.9, 1.7), marco);
    pintar(rejilla, 'equipo', circulo(2.2, lado * 3.9, 1.2), marco);
  }
  pintar(rejilla, 'contorno', recto(6.8, 9.2, -1.8, 1.8), marco);
  pintar(rejilla, 'equipo', recto(7, 8.8, -1.4, 1.4), marco);
  pintar(rejilla, optica, recto(7.8, 8.8, -0.9, 0.9), marco);

  // El contorno final solo cierra lo que quedó abierto (mochila, hombros): las
  // costuras internas ya las puso cada pieza.
  contornear(rejilla);
  return rejilla;
}

/** Fotograma como texto: una cadena de 48 caracteres por fila. */
export function cuadroOperador(opciones: OpcionesOperador): string[] {
  return componer(opciones).map((fila) => fila.join(''));
}

/**
 * Colores finales del fotograma, ya con la luz resuelta sobre la rampa de cada
 * pincel. `null` donde no hay sprite.
 */
export function coloresOperador(opciones: OpcionesOperador): Array<Array<string | null>> {
  const rejilla = componer(opciones);
  const vacio = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= LADO || y >= LADO || rejilla[y][x] === VACIO;

  return rejilla.map((fila, y) =>
    fila.map((clave, x) => {
      if (clave === VACIO) return null;
      const pincel = pincelDe(clave);
      if (!pincel) return null;
      // El contorno no se ilumina: su rampa es el mismo negro en los tres pasos.
      if (vacíoArribaIzquierda(vacio, x, y)) return pincel.luz;
      if (vacíoAbajoDerecha(vacio, x, y)) return pincel.sombra;
      return pincel.base;
    })
  );
}

function vacíoArribaIzquierda(vacio: (x: number, y: number) => boolean, x: number, y: number): boolean {
  return vacio(x - 1, y - 1);
}

function vacíoAbajoDerecha(vacio: (x: number, y: number) => boolean, x: number, y: number): boolean {
  return vacio(x + 1, y + 1);
}

function hexARgb(hex: string): [number, number, number] {
  const valor = hex.replace('#', '');
  return [
    parseInt(valor.slice(0, 2), 16),
    parseInt(valor.slice(2, 4), 16),
    parseInt(valor.slice(4, 6), 16),
  ];
}

const cache = new Map<string, HTMLCanvasElement>();

/** Lienzo de 48×48 del fotograma, cacheado por pose. */
export function lienzoOperador(opciones: OpcionesOperador): HTMLCanvasElement {
  const direccion = normalizarDireccion(opciones.direccion);
  const frame = ((Math.round(opciones.frame) % OPERADOR_FRAMES) + OPERADOR_FRAMES) % OPERADOR_FRAMES;
  const clave = `${opciones.rol}-${opciones.arma}-${opciones.alerta}-${direccion}-${frame}`;
  const cacheado = cache.get(clave);
  if (cacheado) return cacheado;

  const lienzo = createCanvas(LADO, LADO);
  const ctx = lienzo.getContext('2d');
  if (ctx) {
    const datos = ctx.createImageData(LADO, LADO);
    const colores = coloresOperador({ ...opciones, direccion, frame });
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        const hex = colores[y][x];
        if (!hex) continue;
        const [r, g, b] = hexARgb(hex);
        const i = (y * LADO + x) * 4;
        datos.data[i] = r;
        datos.data[i + 1] = g;
        datos.data[i + 2] = b;
        datos.data[i + 3] = 255;
      }
    }
    ctx.putImageData(datos, 0, 0);
  }

  cache.set(clave, lienzo);
  return lienzo;
}

/** Pinta el fotograma centrado en el actor, sin escalado ni suavizado. */
export function dibujarOperador(ctx: CanvasRenderingContext2D, opciones: OpcionesOperador): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lienzoOperador(opciones), -LADO / 2, -LADO / 2);
  ctx.restore();
}

/**
 * Fogonazo del disparo en coordenadas del cuerpo: `adelante` es dónde arranca
 * el núcleo (4×4 px hacia adelante, 4 de ancho) y `costado` su centro lateral.
 * El ángulo sale de la misma pose de 45° que el sprite, no del cursor: si el
 * destello girase con el ángulo exacto, se separaría hasta 22,5° del cañón.
 */
export interface FogonazoOperador {
  angulo: number;
  adelante: number;
  costado: number;
}

const BOCAS: Record<ArmaOperador, { adelante: number; costado: number }> = {
  AUG: { adelante: 19, costado: 0 },
  CORTA: { adelante: 11, costado: 0 },
  // Con escudo el arma corta va detrás de la placa: el destello asoma por el
  // borde delantero (8,4), a la altura de la pistola y no a la del fusil.
  ESCUDO: { adelante: 8, costado: 2 },
};

export function fogonazoOperador(arma: ArmaOperador, direccion: number): FogonazoOperador {
  const pose = normalizarDireccion(direccion);
  const boca = BOCAS[arma];
  return { angulo: (pose * Math.PI) / 4, adelante: boca.adelante, costado: boca.costado };
}
