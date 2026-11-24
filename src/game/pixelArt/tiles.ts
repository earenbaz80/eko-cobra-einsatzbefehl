/**
 * Catálogo de baldosas del render cenital de píxeles.
 *
 * Cada patrón es una rejilla de 8x8 caracteres con su paleta; el motor de
 * `bitmap.ts` los rasteriza y los repite con volteos. Las claves son las que
 * piden los pintores de `scene.ts` (suelo de cada tipo de sala, muro, muebles).
 *
 * Los muros no se repiten con volteos: se piden por máscara de vecinos. Las 16
 * variantes de `muro` llevan el caparazón iluminado (cap) en el borde libre
 * norte, el zócalo en sombra en el sur y el canto en los laterales, así que un
 * encuentro en L, una T o un extremo suelto se leen sin gradientes.
 *
 * Ningún color se escribe aquí: todos salen de `palette.ts`.
 */

import { art, createTileSet, type PixelArt } from './bitmap';
import { CONTORNO, PINCELES_ESCENA, TINTES } from './palette';

export const TILE = 16; // tamaño de baldosa en unidades de mundo
export const ART_SCALE = 2; // cada píxel de arte mide 2x2 en el buffer

const { asfalto, baldosa, cama, cuero, fuego, hormigon, madera, metal, muro, muroCanto, nieve, piedra } =
  PINCELES_ESCENA;

/* ------------------------------------------------------------------ */
/* Arte: patrones de 8x8 píxeles autorizados a mano                    */
/* ------------------------------------------------------------------ */

const SNOW_ART = art(
  { a: nieve.base, b: nieve.luz, c: nieve.sombra, d: nieve.brillo },
  [
    '..bbb...',
    '.bbdbb..',
    'bbbddbbb',
    '.bbbbbb.',
    '..bcbb..',
    '.bbbbab.',
    'bbdbbbbb',
    '..bab...',
  ]
);

const SNOW_DRIFT_ART = art(
  { a: nieve.base, b: nieve.luz, c: nieve.sombra, d: nieve.brillo },
  [
    'bbbbbbb.',
    'bbdbbbb.',
    '.bbbbb..',
    '..bbb...',
    '...b....',
    '..bbb...',
    '.bbbbb..',
    'bbbbbbbb',
  ]
);

const WOOD_ART = art(
  { a: madera.base, b: madera.luz, c: madera.sombra, d: madera.brillo, e: TINTES.maderaVeta },
  [
    'cccccccc',
    'baaaaaab',
    'aaeaaaaa',
    'aaaaaaaa',
    'aaaaadaa',
    'adeaaaaa',
    'aaaaaaae',
    'cccccccc',
  ]
);

const WOOD_ART_B = art(
  { a: madera.base, b: madera.luz, c: madera.sombra, d: madera.brillo, e: TINTES.maderaVeta },
  [
    'cccccccc',
    'baaaaaab',
    'aaadaaaa',
    'aaaaeaaa',
    'aaaaaaaa',
    'aaeaaaad',
    'aaaaaaaa',
    'cccccccc',
  ]
);

const STONE_FLOOR_ART = art(
  { a: piedra.base, b: piedra.sombra, c: piedra.luz, d: piedra.brillo },
  [
    'aaaaaaab',
    'acaacaab',
    'acaacaab',
    'aaaaaaab',
    'baaaaaaa',
    'acaacaab',
    'acaacaab',
    'aaaaaada',
  ]
);

const LEATHER_ART = art(
  { a: cuero.base, b: cuero.luz, c: cuero.brillo, d: cuero.sombra },
  [
    'bbbbbbbb',
    'bccbbbbd',
    'bcbbbbbd',
    'bbbbbbbd',
    'bbbbbbbd',
    'bbbbbbbd',
    'bbbbbbbd',
    'dddddddd',
  ]
);

const METAL_ART = art(
  { a: metal.base, b: metal.luz, c: metal.brillo, d: metal.sombra },
  [
    'bbbbbbbc',
    'bddddddb',
    'bdbbbbdb',
    'bdbbbbdb',
    'bdbbbbdb',
    'bdbbbbdb',
    'bddddddb',
    'cbbbbbbb',
  ]
);

const BED_ART = art(
  { a: cama.luz, b: cama.base, c: cama.sombra, d: cama.brillo },
  [
    'dddddddd',
    'dbbbbbbd',
    'dbaaaabd',
    'dbccaabd',
    'dbccaabd',
    'dbaaaabd',
    'dbbbbbbd',
    'cccccccc',
  ]
);

const ASPHALT_ART = art(
  { a: asfalto.base, b: asfalto.luz, c: asfalto.sombra, d: asfalto.brillo },
  [
    'abaaaaba',
    'aaaaadaa',
    'baaaaaab',
    'aaaabaaa',
    'adaaaaaa',
    'aaaacaaa',
    'baaaaadb',
    'aaaaaaba',
  ]
);

const CONCRETE_ART = art(
  { a: hormigon.base, b: hormigon.luz, c: hormigon.sombra, d: hormigon.brillo },
  [
    'aaaaaaab',
    'aadaaaaa',
    'aaaaacaa',
    'baaaaaaa',
    'aaaabaaa',
    'aadaaaaa',
    'aaaaaaad',
    'baaaaaba',
  ]
);

const TILE_ART = art(
  { a: baldosa.base, b: baldosa.luz, c: baldosa.sombra, d: baldosa.brillo },
  [
    'cccccccc',
    'cdbbbbbc',
    'cabbbbbc',
    'cabbbbbc',
    'cabbbbbc',
    'cabbbbbc',
    'cabbbbbc',
    'cccccccc',
  ]
);

const FIRE_ART = art(
  { a: fuego.luz, b: fuego.brillo, c: TINTES.ascuas, d: fuego.sombra, e: fuego.base },
  [
    '...dd...',
    '..dcb...',
    '.dccba..',
    'dcbccbb.',
    'dcbccbbd',
    '.dccba..',
    '..dcc...',
    '...dd...',
  ]
);

const FIRE_ART_B = art(
  { a: fuego.luz, b: fuego.brillo, c: TINTES.ascuas, d: fuego.sombra, e: fuego.base },
  [
    '..dd....',
    '..dcb...',
    '..dccb..',
    '.dccbba.',
    'dcbccbbd',
    'dccbccbd',
    '.dccba..',
    '..dd....',
  ]
);

/* ------------------------------------------------------------------ */
/* Muros: 16 variantes por máscara de vecinos                          */
/* ------------------------------------------------------------------ */

/** Bits de `arteMuro`: un bit encendido es un vecino del mismo material. */
export const LADOS_MURO = {
  norte: 1,
  este: 2,
  sur: 4,
  oeste: 8,
} as const;

export const MASCARAS_MURO = 16;

/** Ladrillo base: juntas verticales alternadas y hiladas de mortero. */
const CUERPO_MURO = [
  'blbsbbbb',
  'bbbsbbbb',
  'bbbsbbbb',
  'ssssssss',
  'bbbbbbls',
  'bbbbbbbs',
  'bbbbbbbs',
  'ssssssss',
];

const COLORES_MURO: Record<string, string> = {
  b: muro.base,
  l: muro.luz,
  r: muro.brillo,
  s: muro.sombra,
  c: muroCanto.base,
  C: muroCanto.luz,
  k: muroCanto.sombra,
  '#': CONTORNO,
};

/**
 * Baldosa de muro para una máscara de vecinos. El cap (filas 0-1) solo aparece
 * cuando no hay muro al norte; el zócalo (filas 6-7) cuando no lo hay al sur; y
 * los cantos laterales cuando la celda queda expuesta a este u oeste.
 */
export function arteMuro(mascara: number): PixelArt {
  const m = ((Math.round(mascara) % MASCARAS_MURO) + MASCARAS_MURO) % MASCARAS_MURO;
  const filas = CUERPO_MURO.map((fila) => fila.split(''));
  const abierto = (lado: number): boolean => (m & lado) === 0;

  if (abierto(LADOS_MURO.norte)) {
    filas[0] = Array(8).fill('C');
    filas[1] = Array(8).fill('c');
  }
  if (abierto(LADOS_MURO.sur)) {
    filas[6] = Array(8).fill('s');
    filas[7] = Array(8).fill('#');
  }
  if (abierto(LADOS_MURO.oeste)) {
    for (let y = 1; y < 7; y++) {
      filas[y][0] = 'k';
      if (y > 1 && y < 6) filas[y][1] = 'l';
    }
    filas[1][0] = '#';
  }
  if (abierto(LADOS_MURO.este)) {
    for (let y = 1; y < 7; y++) {
      filas[y][7] = '#';
      if (y > 1 && y < 6) filas[y][6] = 's';
    }
  }

  return art(COLORES_MURO, filas.map((fila) => fila.join('')));
}

const VARIANTES_MURO = Array.from({ length: MASCARAS_MURO }, (_, mascara) => arteMuro(mascara));

const TILES: Record<string, PixelArt[]> = {
  snow: [SNOW_ART, SNOW_DRIFT_ART],
  wood: [WOOD_ART, WOOD_ART_B],
  stone: [STONE_FLOOR_ART],
  muro: VARIANTES_MURO,
  // Muro interior para el hogar de la chimenea: cuerpo macizo, sin bordes.
  wall: [arteMuro(15)],
  leather: [LEATHER_ART],
  metal: [METAL_ART],
  bed: [BED_ART],
  fire: [FIRE_ART, FIRE_ART_B],
  asphalt: [ASPHALT_ART],
  concrete: [CONCRETE_ART],
  tile: [TILE_ART],
};

/** Baldosas ya rasterizadas del catálogo, compartidas por todos los pintores. */
export const { getTile, fillTiles } = createTileSet(TILES, ART_SCALE, TILE);
