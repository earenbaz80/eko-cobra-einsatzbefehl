/**
 * Catálogo de baldosas del render cenital de píxeles.
 *
 * Cada patrón es una rejilla de 8x8 caracteres con su paleta; el motor de
 * `bitmap.ts` los rasteriza y los repite con volteos. Las claves son las que
 * piden los pintores de `scene.ts` (suelo de cada tipo de sala, muro, muebles).
 */

import { art, createTileSet, type PixelArt } from './bitmap';

export const TILE = 16; // tamaño de baldosa en unidades de mundo
export const ART_SCALE = 2; // cada píxel de arte mide 2x2 en el buffer

/* ------------------------------------------------------------------ */
/* Arte: patrones de 8x8 píxeles autorizados a mano                    */
/* ------------------------------------------------------------------ */

const SNOW_ART = art(
  { a: '#9FB2C4', b: '#C2D2E2', c: '#8FA3B6', d: '#DBE7F2' },
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
  { a: '#9FB2C4', b: '#C2D2E2', c: '#8FA3B6', d: '#DBE7F2' },
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
  { a: '#4E3826', b: '#63492F', c: '#2B1D13', d: '#5A4029', e: '#3E2B1C' },
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
  { a: '#4E3826', b: '#63492F', c: '#2B1D13', d: '#5A4029', e: '#3E2B1C' },
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
  { a: '#2A3441', b: '#1D2531', c: '#33404F', d: '#3D4B5A' },
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

const WALL_ART = art(
  { a: '#39434F', b: '#1A2029', c: '#2C3540', d: '#46525F' },
  [
    'aabaaaba',
    'aabaaabd',
    'bbbbbbbb',
    'aaaaaaaa',
    'abaaaaba',
    'abaaaaba',
    'bbbbbbbb',
    'cccccccc',
  ]
);

const LEATHER_ART = art(
  { a: '#5E241C', b: '#6E2C22', c: '#8A3B2C', d: '#3A1410' },
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
  { a: '#2E3742', b: '#3E4A57', c: '#55636F', d: '#20262E' },
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
  { a: '#C9CDD6', b: '#AEB4BF', c: '#8F95A1', d: '#E4E8EE' },
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
  { a: '#181E25', b: '#1F262E', c: '#0E1318', d: '#262E37' },
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
  { a: '#2F3741', b: '#3A434E', c: '#262D35', d: '#454F5B' },
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
  { a: '#3C4652', b: '#48535F', c: '#2A323C', d: '#555F6C' },
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
  { a: '#F59E0B', b: '#FDE68A', c: '#DC2626', d: '#7C2D12', e: '#B45309' },
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
  { a: '#F59E0B', b: '#FDE68A', c: '#DC2626', d: '#7C2D12', e: '#B45309' },
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

const TILES: Record<string, PixelArt[]> = {
  snow: [SNOW_ART, SNOW_DRIFT_ART],
  wood: [WOOD_ART, WOOD_ART_B],
  stone: [STONE_FLOOR_ART],
  wall: [WALL_ART],
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
