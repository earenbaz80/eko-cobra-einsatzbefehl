/**
 * PRUEBA DE ARTE — render alternativo experimental.
 *
 * Objetivo: demostrar el mismo juego con arte de píxeles real (tileset + sprites
 * dibujados a mano), sombras proyectadas y un pase de luz suave, renderizado a
 * una resolución interna de 480x270 y escalado por enteros.
 *
 * No toca la simulación: sólo lee el estado que ya existe en el motor.
 * Se activa con `?art=proof` (opcional `&focus=salon` para encuadrar el salón).
 */

import type {
  ActorEntity,
  DoorEntity,
  FurnitureItem,
  RoomZone,
  WallSegment,
  WallSconceLight,
} from './types';

export const PROOF_W = 480;
export const PROOF_H = 270;

const TILE = 16; // tamaño de baldosa en unidades de mundo
const ART_SCALE = 2; // cada píxel de arte mide 2x2 en el buffer

/* ------------------------------------------------------------------ */
/* Arte: patrones de 8x8 píxeles autorizados a mano                    */
/* ------------------------------------------------------------------ */

type PixelArt = { rows: string[]; map: Record<string, string> };

function pad(rows: string[]): string[] {
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => row.padEnd(width, '.'));
}

function art(map: Record<string, string>, rows: string[]): PixelArt {
  return { map, rows: pad(rows) };
}

const SNOW_ART = art(
  { a: '#B6C7D8', b: '#D6E3EF', c: '#A2B4C7', d: '#EEF5FB' },
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
  { a: '#B6C7D8', b: '#D6E3EF', c: '#A2B4C7', d: '#EEF5FB' },
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

const RUG_ART = art(
  { a: '#4A1220', b: '#571726', c: '#64202F', d: '#3B0E19' },
  [
    'dddddddd',
    'dabbbbad',
    'dbccccbd',
    'dbcbbccd',
    'dbcbbccd',
    'dbccccbd',
    'dabbbbad',
    'dddddddd',
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

const DOOR_ART = art(
  { a: '#3B2418', b: '#5A3A24', c: '#8B5A34', d: '#2A1810' },
  [
    '.dddddd.',
    '.dbbbbd.',
    '.dbccbd.',
    '.dbccbd.',
    '.dbbbbd.',
    '.dbccbd.',
    '.dbbbbd.',
    '..dddd..',
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

/* ------------------------------------------------------------------ */
/* Cachés de canvases                                                  */
/* ------------------------------------------------------------------ */

const tileCache = new Map<string, HTMLCanvasElement>();

let buffer: HTMLCanvasElement | null = null;
let bufferCtx: CanvasRenderingContext2D | null = null;
let lightBuffer: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function renderArtToCanvas(pixelArt: PixelArt, scale: number): HTMLCanvasElement {
  const width = pixelArt.rows[0].length;
  const height = pixelArt.rows.length;
  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  for (let y = 0; y < height; y++) {
    const row = pixelArt.rows[y];
    for (let x = 0; x < width; x++) {
      const color = pixelArt.map[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

const TILES: Record<string, PixelArt[]> = {
  snow: [SNOW_ART, SNOW_DRIFT_ART],
  wood: [WOOD_ART, WOOD_ART_B],
  stone: [STONE_FLOOR_ART],
  wall: [WALL_ART],
  rug: [RUG_ART],
  leather: [LEATHER_ART],
  metal: [METAL_ART],
  bed: [BED_ART],
  door: [DOOR_ART],
  fire: [FIRE_ART, FIRE_ART_B],
  asphalt: [ASPHALT_ART],
  concrete: [CONCRETE_ART],
  tile: [TILE_ART],
};

function getTile(name: string, variant = 0): HTMLCanvasElement {
  const variants = TILES[name] ?? TILES.wall;
  const index = variant % variants.length;
  const key = `${name}:${index}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const canvas = renderArtToCanvas(variants[index], ART_SCALE);
  tileCache.set(key, canvas);
  return canvas;
}


/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function hash2(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return Math.abs(value - Math.floor(value));
}

function tileVariant(x: number, y: number, count: number): number {
  return Math.floor(hash2(Math.floor(x / TILE), Math.floor(y / TILE)) * count);
}

/** Rellena un rectángulo con baldosas, recortado a los límites. */
function fillTiles(
  ctx: CanvasRenderingContext2D,
  tileName: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  options: { variants?: number; tint?: string; alpha?: number } = {}
) {
  const x0 = Math.max(x, bounds.x0);
  const y0 = Math.max(y, bounds.y0);
  const x1 = Math.min(x + w, bounds.x1);
  const y1 = Math.min(y + h, bounds.y1);
  if (x1 <= x0 || y1 <= y0) return;

  const variants = options.variants ?? 1;
  const startX = Math.floor(x0 / TILE) * TILE;
  const startY = Math.floor(y0 / TILE) * TILE;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;

  for (let ty = startY; ty < y1; ty += TILE) {
    for (let tx = startX; tx < x1; tx += TILE) {
      const sprite = getTile(tileName, tileVariant(tx, ty, variants));
      // Volteos pseudoaleatorios: rompen la repetición en cuadrícula
      const flip = hash2(tx * 1.7, ty * 2.3);
      if (flip > 0.75) {
        ctx.save();
        ctx.translate(tx + TILE, ty);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
        ctx.restore();
      } else if (flip > 0.5) {
        ctx.save();
        ctx.translate(tx, ty + TILE);
        ctx.scale(1, -1);
        ctx.drawImage(sprite, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, tx, ty);
      }
    }
  }

  if (options.tint) {
    ctx.fillStyle = options.tint;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.45) {
  ctx.save();
  ctx.fillStyle = `rgba(2, 5, 10, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Cámara                                                              */
/* ------------------------------------------------------------------ */

interface ArtProofScene {
  ctx: CanvasRenderingContext2D;
  rooms: RoomZone[];
  walls: WallSegment[];
  doors: DoorEntity[];
  furniture: FurnitureItem[];
  actors: ActorEntity[];
  sconces: WallSconceLight[];
  player?: ActorEntity;
  camX: number;
  camY: number;
  missionMode: string;
}

function resolveCamera(scene: ArtProofScene): { x: number; y: number } {
  const params = readParams();
  if (params.get('focus') === 'salon') {
    const salon = scene.rooms.find((room) => room.id === 'ALPEN_SALON');
    if (salon) return { x: salon.x + 200, y: salon.y + 155 };
  }
  return { x: scene.camX, y: scene.camY };
}

let cachedParams: URLSearchParams | null = null;

function readParams(): URLSearchParams {
  if (cachedParams) return cachedParams;
  if (typeof window === 'undefined') {
    cachedParams = new URLSearchParams();
    return cachedParams;
  }
  cachedParams = new URLSearchParams(window.location.search);
  return cachedParams;
}

export function isArtProofRequested(): boolean {
  return readParams().get('art') === 'proof';
}

/* ------------------------------------------------------------------ */
/* Escenario                                                           */
/* ------------------------------------------------------------------ */

const WOOD_ROOMS = ['SALON', 'SUITE', 'WOHNKUECHE', 'WOHNUNG', 'BUERO'];
const TILE_ROOMS = ['BADEZIMMER', 'LABOR', 'KONTROLLRAUM', 'TURBINE', 'VIP_LOUNGE', 'SCHALTERHALLE'];
const CONCRETE_ROOMS = [
  'GLEIS',
  'BAHNSTEIG',
  'PLATFORM',
  'GEPAECK',
  'LAGERHALLE',
  'HANGAR',
  'TUNNEL',
  'STELLWERK',
  'STIEGENHAUS',
  'VORRAUM',
  'VORPLATZ',
];

function floorTileFor(room: RoomZone, missionMode: string): string {
  const id = room.id;
  if (id.includes('EXTERIOR') || id.includes('TERRACE')) {
    return missionMode === 'TIROL' ? 'snow' : 'asphalt';
  }
  if (id.includes('OBSERVATORIUM')) return 'stone';
  if (WOOD_ROOMS.some((key) => id.includes(key))) return 'wood';
  if (TILE_ROOMS.some((key) => id.includes(key))) return 'tile';
  if (CONCRETE_ROOMS.some((key) => id.includes(key))) return 'concrete';
  return 'stone';
}

function drawFloors(ctx: CanvasRenderingContext2D, scene: ArtProofScene, view: { x0: number; y0: number; x1: number; y1: number }) {
  const baseColor: Record<string, string> = {
    snow: '#C6D4E2',
    wood: '#4E3826',
    stone: '#2A3441',
    asphalt: '#181E25',
    concrete: '#2F3741',
    tile: '#3C4652',
  };

  for (const room of scene.rooms) {
    const tile = floorTileFor(room, scene.missionMode);
    // Base opaca: evita que las esquinas transparentes del patrón dejen huecos
    ctx.fillStyle = baseColor[tile] ?? '#1B2430';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    fillTiles(ctx, tile, room.x, room.y, room.w, room.h, view, {
      variants: tile === 'snow' ? 2 : tile === 'wood' ? 2 : 1,
    });
    // Veta de sombra en el borde interior para dar profundidad a la sala.
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(room.x + 0.5, room.y + 0.5, room.w - 1, room.h - 1);
    ctx.restore();
  }
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#3B0E19';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#6A1F2E';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.strokeStyle = '#52182A';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
  // Motivo de rombos
  ctx.fillStyle = 'rgba(122, 36, 54, 0.75)';
  for (let ry = y + 22; ry < y + h - 16; ry += 22) {
    for (let rx = x + 22; rx < x + w - 16; rx += 22) {
      ctx.beginPath();
      ctx.moveTo(rx, ry - 4);
      ctx.lineTo(rx + 4, ry);
      ctx.lineTo(rx, ry + 4);
      ctx.lineTo(rx - 4, ry);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  ctx.restore();
}

function bevelBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  dark: string
) {
  ctx.save();
  ctx.strokeStyle = light;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + h - 0.5);
  ctx.lineTo(x + 0.5, y + 0.5);
  ctx.lineTo(x + w - 0.5, y + 0.5);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + w - 0.5, y + 0.5);
  ctx.lineTo(x + w - 0.5, y + h - 0.5);
  ctx.lineTo(x + 0.5, y + h - 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawFireplace(ctx: CanvasRenderingContext2D, item: FurnitureItem, time: number) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'wall', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  bevelBox(ctx, x, y, w, h, '#4B5865', '#0E141B');

  // Hornacina
  const mouthW = Math.round(w * 0.5);
  const mouthH = Math.round(h * 0.48);
  const mx = x + (w - mouthW) / 2;
  const my = y + h - mouthH - 4;
  ctx.fillStyle = '#0A0806';
  ctx.fillRect(mx, my, mouthW, mouthH);
  ctx.strokeStyle = '#2A2320';
  ctx.strokeRect(mx - 0.5, my - 0.5, mouthW + 1, mouthH + 1);

  const fire = getTile('fire', Math.floor(time * 6) % 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mouthW, mouthH);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    ctx.drawImage(fire, mx + 2 + i * 16, my + mouthH - fire.height - 1);
  }
  ctx.restore();

  // Repisa y hogar delantero
  ctx.fillStyle = '#1A1512';
  ctx.fillRect(x - 4, y + h - 2, w + 8, 6);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeRect(x - 3.5, y + h - 1.5, w + 7, 5);
}

function drawSofa(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'leather', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  // Respaldo con brillo de cuero
  ctx.fillStyle = '#4A1A14';
  ctx.fillRect(x + 3, y + 2, w - 6, Math.max(6, h * 0.2));
  ctx.fillStyle = 'rgba(160, 82, 62, 0.35)';
  ctx.fillRect(x + 4, y + 2, w - 8, 2);
  // Cojines
  ctx.strokeStyle = 'rgba(40, 12, 9, 0.75)';
  ctx.lineWidth = 1;
  const cushionW = w / 2;
  for (let i = 1; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + cushionW * i, y + h * 0.26);
    ctx.lineTo(x + cushionW * i, y + h - 3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(180, 96, 70, 0.22)';
  ctx.fillRect(x + 6, y + h * 0.3, w / 2 - 10, 2);
  ctx.fillRect(x + w / 2 + 4, y + h * 0.3, w / 2 - 10, 2);
  // Reposabrazos
  ctx.fillStyle = '#4A1A14';
  ctx.fillRect(x, y, 5, h);
  ctx.fillRect(x + w - 5, y, 5, h);
  ctx.fillStyle = 'rgba(170, 90, 66, 0.3)';
  ctx.fillRect(x + 1, y + 1, 2, h - 2);
  bevelBox(ctx, x, y, w, h, 'rgba(170, 90, 66, 0.6)', 'rgba(0, 0, 0, 0.65)');
}

function drawSafe(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'metal', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.strokeStyle = '#0F151B';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Rueda de combinación
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.06, 0, Math.PI * 2);
  ctx.fill();
  bevelBox(ctx, x, y, w, h, 'rgba(120, 140, 160, 0.5)', 'rgba(0, 0, 0, 0.65)');
}

function drawBed(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  // Marco de madera
  ctx.fillStyle = '#2A1B11';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  fillTiles(ctx, 'bed', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  // Almohadas
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x + 6, y + 5, w * 0.34, Math.max(7, h * 0.14));
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(x + w * 0.52, y + 5, w * 0.34, Math.max(7, h * 0.14));
  // Manta
  ctx.fillStyle = 'rgba(120, 20, 40, 0.75)';
  ctx.fillRect(x + 3, y + h * 0.42, w - 6, h * 0.54);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.strokeRect(x + 2.5, y + h * 0.41, w - 5, h * 0.56);
  bevelBox(ctx, x - 2, y - 2, w + 4, h + 4, 'rgba(140, 100, 70, 0.5)', 'rgba(0, 0, 0, 0.6)');
}

function drawCrate(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'wood', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.strokeStyle = 'rgba(20, 14, 9, 0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.strokeStyle = 'rgba(90, 66, 44, 0.75)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  bevelBox(ctx, x, y, w, h, 'rgba(150, 110, 70, 0.5)', 'rgba(0, 0, 0, 0.6)');
}

function drawTable(ctx: CanvasRenderingContext2D, item: FurnitureItem, metal = false) {
  const { x, y, w, h } = item;
  fillTiles(ctx, metal ? 'metal' : 'wood', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.fillStyle = metal ? 'rgba(120, 140, 160, 0.22)' : 'rgba(150, 108, 70, 0.22)';
  ctx.fillRect(x + 2, y + 2, w - 4, Math.max(3, h * 0.18));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y + h - 4, w, 4);
  bevelBox(ctx, x, y, w, h, metal ? 'rgba(150, 170, 190, 0.45)' : 'rgba(170, 126, 84, 0.5)', 'rgba(0, 0, 0, 0.6)');
}

function drawShelf(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'wood', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  // Baldaños y bultos
  const shelves = Math.max(2, Math.floor(h / 22));
  for (let i = 0; i < shelves; i++) {
    const sy = y + 4 + i * ((h - 8) / shelves);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 2, sy + 5, w - 4, 2);
    ctx.fillStyle = 'rgba(140, 100, 64, 0.75)';
    ctx.fillRect(x + 2, sy, w - 4, 2);
    // Cajas/objetos sobre el baldaño
    const items = Math.max(1, Math.floor(w / 26));
    for (let k = 0; k < items; k++) {
      const bx = x + 5 + k * ((w - 10) / items);
      ctx.fillStyle = k % 2 === 0 ? '#5B4A38' : '#37505E';
      ctx.fillRect(bx, sy - 7, Math.min(12, (w - 10) / items - 3), 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(bx, sy - 7, Math.min(12, (w - 10) / items - 3), 1);
    }
  }
  bevelBox(ctx, x, y, w, h, 'rgba(160, 118, 78, 0.5)', 'rgba(0, 0, 0, 0.65)');
}

function drawBench(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  const horizontal = w >= h;
  fillTiles(ctx, 'wood', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  if (horizontal) ctx.fillRect(x, y, w, Math.max(5, h * 0.28));
  else ctx.fillRect(x, y, Math.max(5, w * 0.28), h);
  ctx.fillStyle = 'rgba(150, 170, 190, 0.35)';
  if (horizontal) ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  else ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  bevelBox(ctx, x, y, w, h, 'rgba(170, 130, 90, 0.45)', 'rgba(0, 0, 0, 0.6)');
}

function drawAppliance(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'metal', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 6.5, w - 9, h - 12);
  // Puerta circular tipo lavadora
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.6, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#14181D';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 160, 180, 0.45)';
  ctx.stroke();
  // Piloto
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(x + w - 7, y + 4, 2, 2);
  bevelBox(ctx, x, y, w, h, 'rgba(160, 180, 200, 0.45)', 'rgba(0, 0, 0, 0.65)');
}

function drawTank(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  ctx.save();
  ctx.fillStyle = '#8A3B1F';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 180, 120, 0.25)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2A1208';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#C7D2DE';
  ctx.fillRect(cx - 3, cy - r - 3, 6, 6);
  ctx.restore();
}

function drawPlant(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.fillStyle = '#2F3A2A';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3E5140';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(angle) * w * 0.16,
      cy + Math.sin(angle) * h * 0.16,
      w * 0.16,
      h * 0.11,
      angle,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = '#6B4A2E';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPallet(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const { x, y, w, h } = item;
  fillTiles(ctx, 'wood', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  for (let i = 1; i < 4; i++) ctx.fillRect(x, y + (h * i) / 4 - 1, w, 2);
  ctx.strokeStyle = 'rgba(30, 20, 12, 0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawFurniture(ctx: CanvasRenderingContext2D, scene: ArtProofScene, time: number) {
  const items = [...scene.furniture].sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const item of items) {
    if (item.isDestroyed) continue;
    drawShadow(
      ctx,
      item.x + item.w / 2,
      item.y + item.h + 1,
      item.w * 0.58,
      Math.max(4, item.h * 0.16),
      0.32
    );
    const label = item.label.toLowerCase();
    const spriteId = item.spriteId ?? '';

    if (item.id.includes('kamin')) {
      drawFireplace(ctx, item, time);
    } else if (spriteId === 'SOFA_2SEAT' || label.includes('sof') || label.includes('sessel')) {
      drawSofa(ctx, item);
    } else if (label.includes('fuerte') || label.includes('tresor')) {
      drawSafe(ctx, item);
    } else if (spriteId === 'BED_DOUBLE' || label.includes('cama')) {
      drawBed(ctx, item);
    } else if (/estanter|schrank|regal|racks|panel/.test(label)) {
      drawShelf(ctx, item);
    } else if (/banco|asientos|treppe|mostrador|küchenzeile|ku chenzeile/.test(label)) {
      drawBench(ctx, item);
    } else if (/kühlschrank|kuehlschrank|washer|washing|refriger|waschbecken/.test(label)) {
      drawAppliance(ctx, item);
    } else if (/palets|pallet|tanque|propano|combustible/.test(label)) {
      if (/tanque|propano|combustible/.test(label)) drawTank(ctx, item);
      else drawPallet(ctx, item);
    } else if (/palme|planta/.test(label)) {
      drawPlant(ctx, item);
    } else if (/mesa|tisch|table|comunicaciones|síntesis|sinopsis/.test(label)) {
      drawTable(ctx, item);
    } else {
      drawCrate(ctx, item);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Muros y puertas                                                     */
/* ------------------------------------------------------------------ */

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function doorLeafSegment(door: DoorEntity): Segment {
  const length = Math.hypot(door.x2 - door.x1, door.y2 - door.y1);
  const angle = door.currentAngle;
  return {
    x1: door.hingeX,
    y1: door.hingeY,
    x2: door.hingeX + Math.cos(angle) * length,
    y2: door.hingeY + Math.sin(angle) * length,
  };
}

function drawWalls(ctx: CanvasRenderingContext2D, scene: ArtProofScene, view: { x0: number; y0: number; x1: number; y1: number }) {
  const snowCap = scene.missionMode === 'TIROL';

  for (const wall of scene.walls) {
    const thickness = wall.thickness ?? TILE;
    const horizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1);
    const x = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.x1, wall.x2) - thickness / 2;
    const y = horizontal ? Math.min(wall.y1, wall.y2) - thickness / 2 : Math.min(wall.y1, wall.y2);
    const w = horizontal ? Math.abs(wall.x2 - wall.x1) : thickness;
    const h = horizontal ? thickness : Math.abs(wall.y2 - wall.y1);

    if (x + w < view.x0 || x > view.x1 || y + h < view.y0 || y > view.y1) continue;

    // Sombra proyectada del muro (hacia abajo-derecha, luz superior izquierda)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x + 5, y + 7, w, h);
    ctx.restore();

    fillTiles(ctx, 'wall', x, y, w, h, { x0: x, y0: y, x1: x + w, y1: y + h });

    // Canto superior iluminado + nieve acumulada
    ctx.fillStyle = '#5A6878';
    ctx.fillRect(x, y, w, 2);
    if (snowCap) {
      ctx.fillStyle = '#DCE7F2';
      ctx.fillRect(x, y - 1, w, 2);
      ctx.fillStyle = 'rgba(182, 199, 216, 0.9)';
      ctx.fillRect(x, y + 1, w, 1);
    }
    // Base en sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y + h - 3, w, 3);

    // AO en esquinas/uniones de muros (oscurece los encuentros entre muros)
    ctx.save();
    for (const pt of [
      { px: wall.x1, py: wall.y1 },
      { px: wall.x2, py: wall.y2 },
    ]) {
      const g = ctx.createRadialGradient(pt.px, pt.py, 0, pt.px, pt.py, 16);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const door of scene.doors) {
    const leaf = doorLeafSegment(door);
    const length = Math.hypot(leaf.x2 - leaf.x1, leaf.y2 - leaf.y1);
    const angle = Math.atan2(leaf.y2 - leaf.y1, leaf.x2 - leaf.x1);

    // Marco
    ctx.fillStyle = '#3B2418';
    ctx.fillRect(door.x1 - 2, door.y1 - 3, 4, 6);
    ctx.fillRect(door.x2 - 2, door.y2 - 3, 4, 6);

    ctx.save();
    ctx.translate(leaf.x1, leaf.y1);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 1, length, 5);
    ctx.fillStyle = '#5A3A24';
    ctx.fillRect(0, -3, length, 6);
    ctx.fillStyle = '#8B5A34';
    ctx.fillRect(1, -2, length - 3, 1);
    ctx.fillStyle = '#2A1810';
    ctx.fillRect(0, 2, length, 1);
    // Pomo
    ctx.fillStyle = '#D6A24A';
    ctx.fillRect(length - 5, -1, 2, 2);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Iluminación                                                         */
/* ------------------------------------------------------------------ */

function rayHit(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxT: number,
  segments: Segment[]
): number {
  let best = maxT;
  for (const seg of segments) {
    const sx = seg.x2 - seg.x1;
    const sy = seg.y2 - seg.y1;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const t = ((seg.x1 - ox) * sy - (seg.y1 - oy) * sx) / denom;
    const u = ((seg.x1 - ox) * dy - (seg.y1 - oy) * dx) / denom;
    if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

function conePolygon(
  ox: number,
  oy: number,
  facing: number,
  spread: number,
  range: number,
  segments: Segment[]
): Array<{ x: number; y: number }> {
  const rays = 46;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < rays; i++) {
    const angle = facing - spread + (i / (rays - 1)) * spread * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const t = rayHit(ox, oy, dx, dy, range, segments);
    points.push({ x: ox + dx * t, y: oy + dy * t });
  }
  return points;
}

function occlusionSegments(scene: ArtProofScene): Segment[] {
  const segments: Segment[] = [];
  for (const wall of scene.walls) {
    segments.push({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 });
  }
  for (const door of scene.doors) {
    if (!door.isOpen && !door.isBreached) segments.push(doorLeafSegment(door));
  }
  for (const item of scene.furniture) {
    if (!item.blocksSight || item.isDestroyed) continue;
    const { x, y, w, h } = item;
    segments.push(
      { x1: x, y1: y, x2: x + w, y2: y },
      { x1: x + w, y1: y, x2: x + w, y2: y + h },
      { x1: x + w, y1: y + h, x2: x, y2: y + h },
      { x1: x, y1: y + h, x2: x, y2: y }
    );
  }
  return segments;
}

function drawLighting(
  ctx: CanvasRenderingContext2D,
  scene: ArtProofScene,
  cam: { x: number; y: number },
  time: number
) {
  if (!lightBuffer) {
    lightBuffer = createCanvas(PROOF_W, PROOF_H);
    lightCtx = lightBuffer.getContext('2d');
  }
  if (!lightBuffer || !lightCtx) return;
  const lctx = lightCtx;

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, PROOF_W, PROOF_H);
  lctx.fillStyle = 'rgba(6, 10, 18, 0.8)';
  lctx.fillRect(0, 0, PROOF_W, PROOF_H);
  lctx.globalCompositeOperation = 'destination-out';
  lctx.translate(PROOF_W / 2 - cam.x, PROOF_H / 2 - cam.y);

  // Luz ambiental mínima: la escena se lee sin linterna
  lctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  lctx.fillRect(cam.x - PROOF_W / 2, cam.y - PROOF_H / 2, PROOF_W, PROOF_H);

  const segments = occlusionSegments(scene);
  const player = scene.player;

  // Ambiente alrededor del operador
  if (player) {
    const ambient = lctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 72);
    ambient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    ambient.addColorStop(0.55, 'rgba(0, 0, 0, 0.5)');
    ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lctx.fillStyle = ambient;
    lctx.beginPath();
    lctx.arc(player.x, player.y, 72, 0, Math.PI * 2);
    lctx.fill();

    // Cono de linterna, recortado por geometría
    const points = conePolygon(player.x, player.y, player.angle, 0.44, 270, segments);
    const beam = lctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 270);
    beam.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
    beam.addColorStop(0.55, 'rgba(0, 0, 0, 0.9)');
    beam.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    lctx.fillStyle = beam;
    lctx.beginPath();
    lctx.moveTo(player.x, player.y);
    for (const p of points) lctx.lineTo(p.x, p.y);
    lctx.closePath();
    lctx.fill();
  }

  // Apliques de pared
  const glowSources: Array<{ x: number; y: number; radius: number; color: string }> = [];
  for (const sconce of scene.sconces) {
    if (sconce.isDestroyed || sconce.isOn === false) continue;
    const flicker = 0.94 + Math.sin(time * (sconce.flickerSpeed ?? 0.2) * 18) * 0.04;
    const radius = sconce.radius * 0.85 * flicker;
    const gradient = lctx.createRadialGradient(sconce.x, sconce.y, 6, sconce.x, sconce.y, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lctx.fillStyle = gradient;
    lctx.beginPath();
    lctx.arc(sconce.x, sconce.y, radius, 0, Math.PI * 2);
    lctx.fill();
    glowSources.push({ x: sconce.x, y: sconce.y, radius: radius * 0.9, color: sconce.coreColor });
  }

  // Chimenea
  for (const item of scene.furniture) {
    if (!item.id.includes('kamin') || item.isDestroyed) continue;
    const fx = item.x + item.w / 2;
    const fy = item.y + item.h * 0.86;
    const radius = 185 + Math.sin(time * 5) * 7;
    const gradient = lctx.createRadialGradient(fx, fy, 6, fx, fy, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.45)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lctx.fillStyle = gradient;
    lctx.beginPath();
    lctx.arc(fx, fy, radius, 0, Math.PI * 2);
    lctx.fill();
    glowSources.push({ x: fx, y: fy, radius: radius * 0.7, color: '#F59E0B' });
  }

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';

  // Oscuridad sobre la escena (el buffer de luz ya está en espacio de pantalla)
  ctx.drawImage(lightBuffer, 0, 0);

  // Halos cálidos aditivos, en coordenadas de mundo
  ctx.save();
  ctx.translate(PROOF_W / 2 - cam.x, PROOF_H / 2 - cam.y);
  ctx.globalCompositeOperation = 'lighter';
  for (const glow of glowSources) {
    const gradient = ctx.createRadialGradient(glow.x, glow.y, 2, glow.x, glow.y, glow.radius);
    gradient.addColorStop(0, `${hexToRgba(glow.color, 0.16)}`);
    gradient.addColorStop(0.5, `${hexToRgba(glow.color, 0.06)}`);
    gradient.addColorStop(1, `${hexToRgba(glow.color, 0)}`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, glow.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Partículas                                                          */
/* ------------------------------------------------------------------ */

function drawDustMotes(
  ctx: CanvasRenderingContext2D,
  cam: { x: number; y: number },
  time: number
) {
  const x0 = cam.x - PROOF_W / 2;
  const y0 = cam.y - PROOF_H / 2;
  const x1 = cam.x + PROOF_W / 2;
  const y1 = cam.y + PROOF_H / 2;
  ctx.save();
  for (let i = 0; i < 150; i++) {
    const rx = x0 + hash2(i * 13.7 + time * 0.17, i * 2.3) * (x1 - x0);
    const ry = y0 + hash2(i * 9.1, time * 0.17 + i * 1.7) * (y1 - y0);
    const a = 0.06 + hash2(i * 4.1, i * 6.7) * 0.14;
    ctx.fillStyle = `rgba(190, 205, 220, ${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 1);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Actores                                                             */
/* ------------------------------------------------------------------ */


const TOPDOWN_COLORS: Record<string, { body: string; helmet: string; visor: string; weapon: string }> = {
  PLAYER: { body: '#1E3A5F', helmet: '#334155', visor: '#93C5FD', weapon: '#0F172A' },
  SQUAD: { body: '#1E293B', helmet: '#475569', visor: '#94A3B8', weapon: '#0F172A' },
  SUSPECT: { body: '#3F2A1B', helmet: '#4E3524', visor: '#FCA5A5', weapon: '#1C1917' },
  HOSTAGE: { body: '#6B7280', helmet: '#9CA3AF', visor: '#E5E7EB', weapon: '#374151' },
};

function drawActors(ctx: CanvasRenderingContext2D, scene: ArtProofScene, time: number) {
  const actors = [...scene.actors].sort((a, b) => a.y - b.y);
  for (const actor of actors) {
    const moving = Math.hypot(actor.vx ?? 0, actor.vy ?? 0) > 6;
    const colors = TOPDOWN_COLORS[actor.role] ?? TOPDOWN_COLORS.SUSPECT;
    const wobble = moving ? Math.sin(time * 12 + actor.x * 0.05) * 0.04 : 0;

    // Sombra elíptica (vista cenital)
    drawShadow(ctx, actor.x, actor.y + 2, moving ? 11 : 10, 6, 0.5);

    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle + wobble);

    // Cuerpo (hombros) visto desde arriba
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Casco
    ctx.fillStyle = colors.helmet;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();

    // Visor frontal (indica dirección)
    ctx.fillStyle = colors.visor;
    ctx.fillRect(3.5, -2, 4, 4);

    // Arma (apunta hacia +X tras la rotación)
    ctx.fillStyle = colors.weapon;
    ctx.fillRect(7, -1.6, 13, 3.2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(7, -1.6, 13, 1);

    // Sombreado de 4 tonos: oscurece el lado derecho/inferior
    ctx.globalCompositeOperation = 'source-atop';
    const shade = ctx.createRadialGradient(2, 2, 1, 0, 0, 12);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Post-proceso y presentación                                         */
/* ------------------------------------------------------------------ */

function drawPost(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vignette = ctx.createRadialGradient(
    PROOF_W * 0.5,
    PROOF_H * 0.5,
    Math.min(PROOF_W, PROOF_H) * 0.28,
    PROOF_W * 0.5,
    PROOF_H * 0.5,
    Math.max(PROOF_W, PROOF_H) * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(2, 5, 12, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, PROOF_W, PROOF_H);

  // Grano sutil y estático de cámara
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#93A4B8';
  const seed = Math.floor(time * 14) % 97;
  for (let i = 0; i < 260; i++) {
    const rx = hash2(i * 3.1 + seed, seed * 1.7) * PROOF_W;
    const ry = hash2(seed * 2.3, i * 5.7) * PROOF_H;
    ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 1);
  }
  ctx.restore();
}

function present(
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scale: number,
  label: string
) {
  const canvas = target.canvas;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.imageSmoothingEnabled = false;
  target.fillStyle = '#000';
  target.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = PROOF_W * scale;
  const drawH = PROOF_H * scale;
  const ox = Math.floor((canvas.width - drawW) / 2);
  const oy = Math.floor((canvas.height - drawH) / 2);
  target.drawImage(source, ox, oy, drawW, drawH);

  target.font = '600 11px "JetBrains Mono", monospace';
  target.fillStyle = 'rgba(148, 163, 184, 0.85)';
  target.textAlign = 'left';
  target.textBaseline = 'bottom';
  target.fillText(label, ox + 8, oy + drawH - 6);
  target.restore();
}

/* ------------------------------------------------------------------ */
/* Entrada pública                                                     */
/* ------------------------------------------------------------------ */

export function renderArtProof(scene: ArtProofScene): void {
  const { ctx } = scene;
  if (!buffer) {
    buffer = createCanvas(PROOF_W, PROOF_H);
    bufferCtx = buffer.getContext('2d');
  }
  if (!buffer || !bufferCtx) return;

  const bctx = bufferCtx;
  const time = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  const cam = resolveCamera(scene);
  const view = {
    x0: cam.x - PROOF_W / 2,
    y0: cam.y - PROOF_H / 2,
    x1: cam.x + PROOF_W / 2,
    y1: cam.y + PROOF_H / 2,
  };

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.imageSmoothingEnabled = false;
  bctx.fillStyle = '#05080D';
  bctx.fillRect(0, 0, PROOF_W, PROOF_H);

  bctx.save();
  bctx.translate(PROOF_W / 2 - cam.x, PROOF_H / 2 - cam.y);

  drawFloors(bctx, scene, view);

  // Partículas de polvo flotante (ambientales)
  drawDustMotes(bctx, cam, time);

  // Alfombra bajo el salón
  const salon = scene.rooms.find((room) => room.id === 'ALPEN_SALON');
  if (salon && scene.missionMode === 'TIROL') {
    drawRug(bctx, salon.x + 190, salon.y + 190, 210, 130);
  }

  drawFurniture(bctx, scene, time);
  drawActors(bctx, scene, time);
  drawWalls(bctx, scene, view);

  bctx.restore();

  drawLighting(bctx, scene, cam, time);
  drawPost(bctx, time);

  const canvas = ctx.canvas;
  const scale = Math.max(
    1,
    Math.floor(Math.min(canvas.width / PROOF_W, canvas.height / PROOF_H))
  );
  present(ctx, buffer, scale, `ART PROOF · 480×270 ×${scale} · ${scene.missionMode}`);
}
