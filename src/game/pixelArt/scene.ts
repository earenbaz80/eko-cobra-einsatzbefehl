/**
 * Renderer de escena cenital de píxeles.
 *
 * Pinta el mundo del juego sobre un buffer de `BUFFER_W`x`BUFFER_H`: suelos,
 * muebles, muros y vanos, actores, cargas y el pase de luz. No conoce la prueba
 * de arte ni decide la escala de pantalla; recibe la escena que ya existe en el
 * motor y una cámara, y no toca la simulación.
 *
 * REGLAS DE PROYECCIÓN CENITAL (invariantes del módulo)
 *
 * 1. Solo se dibuja lo que una cámara mirando hacia abajo vería. Las caras
 *    verticales (muro, hoja de puerta, canto de mueble) no existen en el plano.
 * 2. La altura no se pinta como lateral: se insinúa con la huella del objeto,
 *    su sombra de contacto y el AO de las esquinas.
 * 3. Prohibido dibujar agujeros, grietas, pomos o herrajes en una cara vertical.
 *    Un impacto deja chispas, polvo y escombro en el suelo, no un cráter en el muro.
 * 4. El suelo es el único plano que admite marcas persistentes: casquillos,
 *    escombros y huellas.
 * 5. La silueta del sprite original comunica estado (rendido, arrestado,
 *    neutralizado); el color nunca es el único portador de esa información.
 * 6. Todo elemento nuevo debe justificarse con esa cámara cenital; si necesita
 *    una vista lateral, no pertenece a este render.
 */

import type {
  ActiveC4Charge,
  ActorEntity,
  DoorEntity,
  FurnitureItem,
  PrimaryWeaponId,
  RoomZone,
  WallSegment,
  WallSconceLight,
} from '../types';
import type { ExteriorWindowSection, FloorDecal, SnowFootprint } from '../TacticalEngineCore';
import { drawPixelArtActor } from '../pixelSprites';
import type { C4PlantingState } from '../c4Charges';
import { createCanvas, hash2 } from './bitmap';
import { BUFFER_H, BUFFER_W } from './present';
import { TILE, fillTiles, getTile } from './tiles';

/** Lo que el renderer necesita del motor para pintar un cuadro. */
export interface PixelScene {
  rooms: RoomZone[];
  walls: WallSegment[];
  doors: DoorEntity[];
  windows: ExteriorWindowSection[];
  charges: ActiveC4Charge[];
  planting?: C4PlantingState;
  furniture: FurnitureItem[];
  actors: ActorEntity[];
  sconces: WallSconceLight[];
  decals: FloorDecal[];
  footprints: SnowFootprint[];
  nightMode: boolean;
  player?: ActorEntity;
  camX: number;
  camY: number;
  missionMode: string;
  primaryWeapon: PrimaryWeaponId;
  activeTool: 'PRIMARY' | 'TASER' | 'GADGET';
}

/** Centro de la cámara en coordenadas de mundo. */
export interface SceneCamera {
  x: number;
  y: number;
}

/** Rectángulo visible en coordenadas de mundo. */
export interface SceneView {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let lightCtx: CanvasRenderingContext2D | null = null;

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.45) {
  ctx.save();
  ctx.fillStyle = `rgba(2, 5, 10, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

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

const FLOOR_BASE_COLOR: Record<string, string> = {
  snow: '#A9B8C8',
  wood: '#4E3826',
  stone: '#2A3441',
  asphalt: '#181E25',
  concrete: '#2F3741',
  tile: '#3C4652',
};

function drawFloors(ctx: CanvasRenderingContext2D, scene: PixelScene, view: { x0: number; y0: number; x1: number; y1: number }) {
  for (const room of scene.rooms) {
    const tile = floorTileFor(room, scene.missionMode);
    // Base opaca: evita que las esquinas transparentes del patrón dejen huecos
    ctx.fillStyle = FLOOR_BASE_COLOR[tile] ?? '#1B2430';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    fillTiles(ctx, tile, room.x, room.y, room.w, room.h, view, {
      variants: tile === 'snow' || tile === 'wood' ? 2 : 1,
    });
    // La nieve tiende a quemar el detalle: se enfría con un velo tenue.
    if (tile === 'snow') {
      ctx.fillStyle = 'rgba(24, 38, 52, 0.16)';
      ctx.fillRect(room.x, room.y, room.w, room.h);
    }
    // Veta de sombra en el borde interior para dar profundidad a la sala.
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(room.x + 0.5, room.y + 0.5, room.w - 1, room.h - 1);
    ctx.restore();
  }
}

/**
 * Quemadura en planta: hollín translúcido, borde raído y núcleo de carbón. Sin
 * agujeros ni volumen: todo se apoya en el piso y deja ver la textura debajo.
 */
function drawScorch(ctx: CanvasRenderingContext2D, decal: FloorDecal) {
  const rx = decal.radius;
  const ry = rx * decal.aspect;
  // Cuatro lóbulos tomados de la posición: el clúster del C4 no repite mancha.
  ctx.fillStyle = decal.color;
  ctx.globalAlpha = decal.alpha * 0.4;
  for (let i = 0; i < 4; i++) {
    const seed = hash2(decal.x + i * 5.7, decal.y - i * 3.3);
    const lobe = 0.55 + seed * 0.45;
    ctx.beginPath();
    ctx.ellipse(
      (seed - 0.5) * rx,
      (hash2(seed, i * 2.1) - 0.5) * ry,
      rx * lobe,
      ry * lobe,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  // Carbón: un núcleo más opaco y sin brillo, para que lea quemado y no sucio.
  ctx.fillStyle = '#0B1220';
  ctx.globalAlpha = decal.alpha * 0.55;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // Brasas apagadas: dos píxeles cálidos en el borde, nunca un anillo.
  ctx.fillStyle = '#92400E';
  ctx.globalAlpha = decal.alpha * 0.7;
  for (let i = 0; i < 2; i++) {
    const seed = hash2(decal.y + i * 2.9, decal.x - i * 6.1);
    ctx.fillRect(
      Math.round(Math.cos(seed * Math.PI * 2) * rx * 0.9),
      Math.round(Math.sin(seed * Math.PI * 2) * ry * 0.9),
      1,
      1
    );
  }
}

function drawFloorDecals(ctx: CanvasRenderingContext2D, decals: FloorDecal[], solids: SolidRect[]) {
  for (const decal of decals) {
    const isCasing = decal.type === 'CASING';
    // Sangre y otros tipos quedan fuera del proof táctico.
    if (!isCasing && decal.type !== 'DEBRIS' && decal.type !== 'SCORCH') continue;

    const halfHeight = decal.radius * decal.aspect;
    const position = nudgeOutOfSolids(decal.x, decal.y, solids, decal.radius + 1);
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(decal.angle);
    ctx.globalAlpha = decal.alpha;
    ctx.fillStyle = decal.color;
    if (decal.type === 'SCORCH') {
      drawScorch(ctx, decal);
    } else if (isCasing) {
      // Casquillo dorado con brillo en un extremo
      ctx.fillRect(-decal.radius, -halfHeight, decal.radius * 2, halfHeight * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(-decal.radius, -halfHeight, decal.radius, halfHeight * 2);
    } else {
      // Esquirla / resto de impacto
      ctx.beginPath();
      ctx.ellipse(0, 0, decal.radius, halfHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Nieve bajo un punto: decide si una marca se lee como pisada o como polvo. */
function isSnowAt(scene: PixelScene, x: number, y: number): boolean {
  const room = scene.rooms.find(
    (zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h
  );
  if (!room) return scene.missionMode === 'TIROL';
  return floorTileFor(room, scene.missionMode) === 'snow';
}

interface DustScuff {
  x: number;
  y: number;
  born: number;
}

const DUST_LIFE = 3.2;
const DUST_INTERVAL = 0.16;
let dustTrail: DustScuff[] = [];
let dustSession: ActorEntity[] | null = null;
let lastDustAt = -1;

/**
 * Polvo levantado al caminar en interiores. El motor solo registra huellas en
 * la nieve del Tirol, así que este rastro vive en el render y se deriva del
 * movimiento del operador: no toca la simulación ni el estado guardado.
 */
function updateDustTrail(scene: PixelScene, time: number) {
  // `resetMission` reconstruye el array de actores en cada partida nueva.
  if (dustSession !== scene.actors) {
    dustSession = scene.actors;
    dustTrail = [];
    lastDustAt = -1;
  }

  dustTrail = dustTrail.filter((scuff) => time - scuff.born < DUST_LIFE);

  const player = scene.player;
  if (!player || isSnowAt(scene, player.x, player.y)) return;
  const moving = Math.hypot(player.vx ?? 0, player.vy ?? 0) > 18;
  if (!moving || time - lastDustAt < DUST_INTERVAL) return;

  // Dispersión determinista por posición: sin contador ni Math.random.
  const jitterX = (hash2(player.x * 0.37, player.y * 0.53) - 0.5) * 5;
  const jitterY = (hash2(player.y * 0.29 + 3.1, player.x * 0.61) - 0.5) * 5;
  dustTrail.push({ x: player.x + jitterX, y: player.y + 2 + jitterY, born: time });
  lastDustAt = time;
}

function drawFootprints(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  view: { x0: number; y0: number; x1: number; y1: number },
  time: number
) {
  const inView = (x: number, y: number) => x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;

  // Huellas del motor: solo se leen como pisada en nieve. En interior las cubre
  // el rastro de polvo, que es el signo correcto sobre madera.
  for (const footprint of scene.footprints) {
    if (!inView(footprint.x, footprint.y) || !isSnowAt(scene, footprint.x, footprint.y)) continue;
    ctx.save();
    ctx.translate(footprint.x, footprint.y);
    ctx.rotate(footprint.angle);
    ctx.fillStyle = `rgba(24, 36, 50, ${Math.min(0.5, footprint.alpha)})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-2.2, side * 3.1, 3.4, 1.6, side * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Rastro tenue de polvo en interiores: se desvanece y nunca compite con actores.
  for (const scuff of dustTrail) {
    if (!inView(scuff.x, scuff.y)) continue;
    const fade = 1 - (time - scuff.born) / DUST_LIFE;
    if (fade <= 0) continue;
    ctx.fillStyle = `rgba(206, 216, 228, ${0.17 * fade})`;
    ctx.beginPath();
    ctx.ellipse(scuff.x, scuff.y, 3.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
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
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h * 0.26);
  ctx.lineTo(x + w / 2, y + h - 3);
  ctx.stroke();
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

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  time: number,
  isVisible: (x: number, y: number) => boolean
) {
  const items = [...scene.furniture].sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const item of items) {
    if (item.isDestroyed) continue;
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    if (!isVisible(cx, cy)) continue;
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

interface SolidRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function wallBounds(wall: WallSegment): { x: number; y: number; w: number; h: number } {
  const thickness = wall.thickness ?? TILE;
  const horizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1);
  return {
    x: horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.x1, wall.x2) - thickness / 2,
    y: horizontal ? Math.min(wall.y1, wall.y2) - thickness / 2 : Math.min(wall.y1, wall.y2),
    w: horizontal ? Math.abs(wall.x2 - wall.x1) : thickness,
    h: horizontal ? thickness : Math.abs(wall.y2 - wall.y1),
  };
}

function decalSolids(scene: PixelScene): SolidRect[] {
  const solids: SolidRect[] = [];
  for (const wall of scene.walls) {
    const { x, y, w, h } = wallBounds(wall);
    solids.push({ x0: x, y0: y, x1: x + w, y1: y + h });
  }
  for (const item of scene.furniture) {
    if (item.isDestroyed || (!item.blocksMovement && !item.blocksSight)) continue;
    solids.push({ x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h });
  }
  return solids;
}

/** Saca el decal del interior de muros/muebles para que su capa no lo tape. */
function nudgeOutOfSolids(x: number, y: number, solids: SolidRect[], margin: number) {
  let px = x;
  let py = y;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const solid of solids) {
      if (px <= solid.x0 || px >= solid.x1 || py <= solid.y0 || py >= solid.y1) continue;
      const left = px - solid.x0;
      const right = solid.x1 - px;
      const top = py - solid.y0;
      const bottom = solid.y1 - py;
      const nearest = Math.min(left, right, top, bottom);
      if (nearest === left) px = solid.x0 - margin;
      else if (nearest === right) px = solid.x1 + margin;
      else if (nearest === top) py = solid.y0 - margin;
      else py = solid.y1 + margin;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, y: py };
}

/**
 * Ventana en planta: el vano es una ranura en el muro con vidrio y marcos, no
 * una cara con reflejos. Rota solo si se rompió el vidrio.
 */
function drawWindow(
  ctx: CanvasRenderingContext2D,
  win: ExteriorWindowSection,
  view: { x0: number; y0: number; x1: number; y1: number }
) {
  if (Math.max(win.x1, win.x2) < view.x0 || Math.min(win.x1, win.x2) > view.x1) return;
  if (Math.max(win.y1, win.y2) < view.y0 || Math.min(win.y1, win.y2) > view.y1) return;

  const length = Math.hypot(win.x2 - win.x1, win.y2 - win.y1);
  if (length < 2) return;
  const angle = Math.atan2(win.y2 - win.y1, win.x2 - win.x1);

  ctx.save();
  ctx.translate(win.x1, win.y1);
  ctx.rotate(angle);

  // Vano
  ctx.fillStyle = '#0A1018';
  ctx.fillRect(0, -3.5, length, 7);

  if (win.isBreached) {
    // Vidrio roto: borde astillado y esquirlas en el suelo al pie del vano
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const bx = (i + 0.5) * (length / 4);
      ctx.beginPath();
      ctx.moveTo(bx - 2, -4);
      ctx.lineTo(bx, -2);
      ctx.lineTo(bx - 1, 1);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(226, 240, 255, 0.45)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect((i + 0.4) * (length / 5), 4 + (i % 2) * 2, 1.6, 1.1);
    }
  } else {
    // Vidrio y marcos
    ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.fillRect(1.5, -2.5, length - 3, 5);
    ctx.fillStyle = 'rgba(226, 240, 255, 0.35)';
    ctx.fillRect(1.5, -2.5, Math.max(3, length * 0.22), 1);
    ctx.fillStyle = '#8194A8';
    ctx.fillRect(0.5, -3.5, 1.6, 7);
    ctx.fillRect(length - 2.1, -3.5, 1.6, 7);
    ctx.fillRect(length * 0.5 - 0.6, -3.5, 1.2, 7);

    // Impactos acumulados: fisuras en el vidrio
    if (win.damageHits > 0) {
      ctx.strokeStyle = 'rgba(226, 240, 255, 0.55)';
      ctx.lineWidth = 0.7;
      const fisuras = Math.min(3, win.damageHits);
      for (let i = 0; i < fisuras; i++) {
        const cx = length * (0.3 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(cx - 3, -1.5);
        ctx.lineTo(cx, 0);
        ctx.lineTo(cx + 2.5, 1.8);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Puerta en planta: umbral, arco de barrido y estado. La hoja nunca se dibuja
 * con pomo en una cara: el pomo es una marca en su canto.
 */
function drawDoor(ctx: CanvasRenderingContext2D, door: DoorEntity) {
  const leaf = doorLeafSegment(door);
  const length = Math.hypot(door.x2 - door.x1, door.y2 - door.y1);
  const angle = Math.atan2(leaf.y2 - leaf.y1, leaf.x2 - leaf.x1);
  const opening = Math.atan2(door.y2 - door.y1, door.x2 - door.x1);

  // Umbral: el hueco de paso es suelo, se ve desde arriba
  ctx.save();
  ctx.translate(door.x1, door.y1);
  ctx.rotate(opening);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.fillRect(0, -5, length, 10);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(length, -5);
  ctx.moveTo(0, 5);
  ctx.lineTo(length, 5);
  ctx.stroke();
  ctx.fillStyle = '#3B2418';
  ctx.fillRect(-1.5, -3, 3, 6);
  ctx.restore();

  // Arco de barrido: símbolo de plano, marca el recorrido de la hoja
  if (!door.isDestroyed) {
    let delta = door.openAngle - door.closedAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.38)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(door.hingeX, door.hingeY, length, door.closedAngle, door.closedAngle + delta, delta < 0);
    ctx.stroke();
    ctx.restore();
  }

  // Marco
  ctx.fillStyle = '#3B2418';
  ctx.fillRect(door.x1 - 2, door.y1 - 3, 4, 6);
  ctx.fillRect(door.x2 - 2, door.y2 - 3, 4, 6);

  if (door.isDestroyed) {
    // Sin hoja: quicio astillado y restos en el umbral
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(door.hingeX - 1, door.hingeY - 4, 2, 8);
    ctx.fillStyle = 'rgba(120, 84, 54, 0.7)';
    ctx.fillRect(door.hingeX + 4, door.hingeY - 1, 3, 1.5);
    return;
  }

  const breached = door.isBreached;
  const leafLength = breached ? length * 0.45 : length;

  ctx.save();
  ctx.translate(leaf.x1, leaf.y1);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 1, leafLength, 5);
  ctx.fillStyle = breached ? '#4A2E1C' : '#5A3A24';
  ctx.fillRect(0, -3, leafLength, 6);
  ctx.fillStyle = breached ? '#7A522E' : '#8B5A34';
  ctx.fillRect(1, -2, Math.max(1, leafLength - 3), 1);
  ctx.fillStyle = '#2A1810';
  ctx.fillRect(0, 2, leafLength, 1);

  // Pomo y cerradura: marcas de canto, no objetos de una cara vertical. El
  // acero separa el pomo del amarillo del C4, que se planta en la misma hoja;
  // el candado ya lo dice la pestaña ámbar, sin un segundo marrón casi igual.
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(Math.max(1, leafLength - 4), -1, 2, 2);
  if (door.isLocked) {
    ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
    ctx.fillRect(Math.max(1, leafLength - 5.5), -2.5, 1, 5);
  }

  // Brecha: hoja recortada y astillas
  if (breached) {
    ctx.strokeStyle = 'rgba(12, 8, 5, 0.85)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const bx = leafLength * (0.45 + i * 0.15);
      ctx.beginPath();
      ctx.moveTo(bx, -3);
      ctx.lineTo(bx + 2, 0);
      ctx.lineTo(bx - 1, 3);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Lo mínimo que necesita el render para situar una carga. */
interface ChargeTarget {
  x: number;
  y: number;
  doorId?: string;
  windowId?: string;
  isWindow: boolean;
  face?: { x: number; y: number };
}

/** Mitad del grosor del listón: hoja de puerta y vano de ventana. */
const DOOR_HALF = 3;
const WINDOW_HALF = 3.5;

/**
 * Estuche del C4 en coordenadas del anclaje: la cara que lo recibe queda en
 * y=0, así que su borde de fuera está en Y y el estuche se mete 1.4 px en el
 * listón. La sombra, las marcas de destino y la placa salen de esta caja.
 */
const CHARGE_BOX = { x: -4.6, y: -7.2, w: 9.2, h: 8.6 };
/** Aire que se deja entre el estuche (o el vano) y la placa de progreso. */
const PLATE_GAP = 2;

/** Punto de apoyo de la carga, con el medio grosor del listón que la recibe. */
interface ChargeAnchor {
  x: number;
  y: number;
  angle: number;
  half: number;
}

/**
 * Cara del listón que recibe la carga. `angle` es el del listón y `half` su
 * medio grosor; `toward` dice de qué lado está el operador y elige el canto.
 */
function faceAnchor(
  mx: number,
  my: number,
  angle: number,
  half: number,
  toward?: { x: number; y: number }
): ChargeAnchor {
  const nx = Math.sin(angle);
  const ny = -Math.cos(angle);
  // El estuche gira con la hoja; si ese canto no mira al operador se gira media
  // vuelta, y así el detonador queda de su lado.
  const finalAngle = toward && toward.x * nx + toward.y * ny < 0 ? angle + Math.PI : angle;
  const ox = Math.sin(finalAngle);
  const oy = -Math.cos(finalAngle);
  return { x: mx + ox * half, y: my + oy * half, angle: finalAngle, half };
}

/**
 * Dónde se apoya la carga: sobre la cara del listón que mira al operador, no
 * encima del canto. Si no reconoce su puerta o ventana conserva el punto que
 * da el motor.
 */
function chargeAnchor(scene: PixelScene, target: ChargeTarget): ChargeAnchor {
  if (target.isWindow) {
    const win = scene.windows.find((item) => item.id === target.windowId);
    if (win) {
      // Sin operador registrado, la carga va del lado interior: la única cara
      // del vano que ve el jugador desde dentro.
      const toward = target.face ?? { x: Math.cos(win.normalAngle), y: Math.sin(win.normalAngle) };
      const angle = Math.atan2(win.y2 - win.y1, win.x2 - win.x1);
      const mx = (win.x1 + win.x2) / 2;
      const my = (win.y1 + win.y2) / 2;
      return faceAnchor(mx, my, angle, WINDOW_HALF, toward);
    }
  } else {
    const door = scene.doors.find((item) => item.id === target.doorId);
    if (door && !door.isDestroyed) {
      const leaf = doorLeafSegment(door);
      const angle = Math.atan2(leaf.y2 - leaf.y1, leaf.x2 - leaf.x1);
      const mx = (leaf.x1 + leaf.x2) / 2;
      const my = (leaf.y1 + leaf.y2) / 2;
      return faceAnchor(mx, my, angle, DOOR_HALF, target.face);
    }
  }
  return { x: target.x, y: target.y, angle: 0, half: DOOR_HALF };
}

/* ------------------------------------------------------------------ */
/* Plantado de C4                                                      */
/* ------------------------------------------------------------------ */

// Texto de 3x5 píxeles: a 480x270 una fuente del sistema se ve sucia y no
// sobrevive al reescalado.
const PIXEL_GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '%': ['101', '001', '010', '100', '101'],
  C: ['111', '100', '100', '100', '111'],
  ' ': ['000', '000', '000', '000', '000'],
};

function pixelTextWidth(text: string): number {
  return text.length * 4 - 1;
}

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
) {
  ctx.fillStyle = color;
  const top = Math.round(y);
  let cursor = Math.round(x);
  for (const char of text) {
    const glyph = PIXEL_GLYPHS[char];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row][col] === '1') ctx.fillRect(cursor + col, top + row, 1, 1);
        }
      }
    }
    cursor += 4;
  }
}

/**
 * Barra y porcentaje del plantado. La placa vive en el lado del operador y a su
 * derecha, con las distancias sacadas del estuche y del medio grosor del vano:
 * así no depende del giro del anclaje ni se va al quicio.
 */
function drawPlantProgress(
  ctx: CanvasRenderingContext2D,
  anchor: ChargeAnchor,
  ratio: number
) {
  const label = `C4 ${Math.round(ratio * 100)}%`;
  const width = Math.max(34, pixelTextWidth(label) + 6);
  const height = 13;
  // El -y local del anclaje apunta al operador: ésa es la normal exterior.
  const outwardX = Math.sin(anchor.angle);
  const outwardY = -Math.cos(anchor.angle);
  // Derecha del operador en pantalla: (-dy, dx) de su mirada, que va hacia el
  // anclaje en dirección -outward. Queda igual en cualquier puerta o ventana.
  const rightX = outwardY;
  const rightY = -outwardX;
  // Huella de la placa sobre un eje: en vertical apoya el alto, no el ancho.
  const reach = (ux: number, uy: number) =>
    Math.abs(ux) * (width / 2) + Math.abs(uy) * (height / 2);
  // Por delante del vano (su medio grosor) y corrida a un lado del estuche.
  const outward = anchor.half + PLATE_GAP + reach(outwardX, outwardY);
  const lateral = CHARGE_BOX.w / 2 + PLATE_GAP + reach(rightX, rightY);
  const x = Math.round(anchor.x + outwardX * outward + rightX * lateral - width / 2);
  const y = Math.round(anchor.y + outwardY * outward + rightY * lateral - height / 2);

  ctx.fillStyle = 'rgba(8, 12, 17, 0.86)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + height - 1, width, 1);
  ctx.fillRect(x, y, 1, height);
  ctx.fillRect(x + width - 1, y, 1, height);

  const barW = width - 4;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + 2, y + 2, barW, 3);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(x + 2, y + 2, Math.round(barW * ratio), 3);
  // Ticks: el relleno se lee como gauge aunque la luz apague el color.
  ctx.fillStyle = 'rgba(8, 12, 17, 0.55)';
  for (let tick = 4; tick < barW; tick += 4) ctx.fillRect(x + 2 + tick, y + 2, 1, 3);

  drawPixelText(ctx, label, x + (width - pixelTextWidth(label)) / 2, y + 6, '#FCA5A5');
}

/** La carga en las manos, unas décimas antes de quedar apoyada. */
function drawHeldCharge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-4.2, -3.4, 9.2, 8.6);
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(-4.6, -4.6, 9.2, 8.6);
  ctx.fillStyle = '#D9A21B';
  ctx.fillRect(-3.8, -3.8, 2.9, 6);
  ctx.fillRect(0.9, -3.8, 2.9, 6);
  ctx.fillStyle = '#F2C14E';
  ctx.fillRect(-3.8, -3.8, 2.9, 1.1);
  ctx.fillRect(0.9, -3.8, 2.9, 1.1);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.fillRect(-0.9, -4.6, 1.8, 8.6);
  ctx.fillStyle = Math.floor(time * 6) % 2 === 0 ? '#EF4444' : '#7F1D1D';
  ctx.fillRect(-1.9, -5.4, 1.6, 1);
  ctx.restore();
}

/**
 * Gesto de plantado: la caja sale de las manos del operador y viaja al anclaje,
 * donde el hueco destino y la barra marcan el progreso hasta armarla.
 */
function drawPlanting(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  anchor: ChargeAnchor,
  view: { x0: number; y0: number; x1: number; y1: number },
  time: number
) {
  const planting = scene.planting;
  if (!planting) return;
  if (anchor.x < view.x0 || anchor.x > view.x1 || anchor.y < view.y0 || anchor.y > view.y1) return;

  const ratio = Math.min(1, planting.progress / planting.maxProgress);

  // Hueco destino: cuatro esquinas marcan dónde va a quedar el estuche.
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(anchor.angle);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
  const right = CHARGE_BOX.x + CHARGE_BOX.w;
  const bottom = CHARGE_BOX.y + CHARGE_BOX.h;
  for (const [cx, cy] of [
    [CHARGE_BOX.x, CHARGE_BOX.y],
    [right, CHARGE_BOX.y],
    [CHARGE_BOX.x, bottom],
    [right, bottom],
  ]) {
    ctx.fillRect(cx, cy, 1, 1);
  }
  ctx.restore();

  const player = scene.player;
  if (player && player.state !== 'DEAD' && Math.hypot(player.x - anchor.x, player.y - anchor.y) < 130) {
    const dx = anchor.x - player.x;
    const dy = anchor.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const t = ratio * ratio * (3 - 2 * ratio);
    const handX = player.x + (dx / dist) * 8;
    const handY = player.y + (dy / dist) * 8;
    drawHeldCharge(ctx, handX + (anchor.x - handX) * t, handY + (anchor.y - handY) * t, anchor.angle, time);
  }

  drawPlantProgress(ctx, anchor, ratio);
}

/**
 * Carga C4 en planta: el estuche se apoya en la cara del listón que mira al
 * operador y se mete un píxel en la hoja; la cincha cruza el listón entero
 * hasta el canto opuesto y el detonador queda del lado del operador.
 */
function drawCharge(
  ctx: CanvasRenderingContext2D,
  anchor: ChargeAnchor,
  view: { x0: number; y0: number; x1: number; y1: number },
  time: number
) {
  if (anchor.x < view.x0 || anchor.x > view.x1 || anchor.y < view.y0 || anchor.y > view.y1) return;

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(anchor.angle);

  // Sombra al pie del estuche: cae hacia abajo-derecha en coordenadas del
  // mundo, así que el desplazamiento se gira al revés antes de dibujarla.
  const shadowX = 1.6 * Math.cos(anchor.angle) + 2 * Math.sin(anchor.angle);
  const shadowY = -1.6 * Math.sin(anchor.angle) + 2 * Math.cos(anchor.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(CHARGE_BOX.x + shadowX, CHARGE_BOX.y + shadowY, CHARGE_BOX.w, CHARGE_BOX.h);

  // Cuerpo sobre la cara del listón: el anclaje está en su canto y el estuche
  // se mete 1.4 px en la hoja, así se apoya en la puerta y no flota al lado.
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(CHARGE_BOX.x, CHARGE_BOX.y, CHARGE_BOX.w, CHARGE_BOX.h);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-3.9, -6.5, 7.8, 7.4);
  // Dos bloques de explosivo con un hueco en medio: lectura de carga, no caja.
  ctx.fillStyle = '#D9A21B';
  ctx.fillRect(-3.4, -6, 2.9, 6);
  ctx.fillRect(0.5, -6, 2.9, 6);
  ctx.fillStyle = '#F2C14E';
  ctx.fillRect(-3.4, -6, 2.9, 1.1);
  ctx.fillRect(0.5, -6, 2.9, 1.1);

  // Cincha: pasa por encima del estuche y cruza el listón hasta el canto
  // opuesto, para que se lea abrazada a la hoja desde cualquier lado.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.fillRect(-0.8, -7.2, 1.6, 14);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
  ctx.fillRect(-0.8, -7.2, 1.6, 1);
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(-1.4, -1.6, 2.8, 2.4);
  ctx.fillStyle = '#64748B';
  ctx.fillRect(-1.2, -1.4, 2.4, 2);

  // Detonador en el canto exterior, de cara al operador, con su LED.
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(-1.9, -8.4, 3.8, 1.4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-1.5, -8.2, 3, 1);

  const ledOn = Math.floor(time * 3) % 2 === 0;
  if (ledOn) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.26)';
    ctx.beginPath();
    ctx.arc(0, -7.6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = ledOn ? '#EF4444' : '#7F1D1D';
  ctx.beginPath();
  ctx.arc(0, -7.6, 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D, scene: PixelScene, view: { x0: number; y0: number; x1: number; y1: number }) {
  const snowCap = scene.missionMode === 'TIROL';

  for (const wall of scene.walls) {
    const { x, y, w, h } = wallBounds(wall);

    if (x + w < view.x0 || x > view.x1 || y + h < view.y0 || y > view.y1) continue;

    // Sombra proyectada del muro (hacia abajo-derecha, luz superior izquierda)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x + 5, y + 7, w, h);

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

  for (const win of scene.windows) {
    drawWindow(ctx, win, view);
  }
  for (const door of scene.doors) {
    drawDoor(ctx, door);
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

function wallAndDoorSegments(scene: PixelScene): Segment[] {
  const segments: Segment[] = [];
  for (const wall of scene.walls) {
    segments.push({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 });
  }
  for (const door of scene.doors) {
    if (!door.isOpen && !door.isBreached) segments.push(doorLeafSegment(door));
  }
  return segments;
}

function occlusionSegments(scene: PixelScene): Segment[] {
  const segments = wallAndDoorSegments(scene);
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

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Un punto es visible si está cerca del operador, dentro de un charco de luz
 * (aplique/chimenea) o dentro del cono de linterna con línea de visión libre.
 * Evita que muebles y actores de salas a oscuras floten sobre el mapa.
 */
function createVisibilityTest(scene: PixelScene, sightSegments: Segment[]) {
  const player = scene.player;
  if (!player) return () => true;
  const litSconces = scene.sconces.filter((sconce) => !sconce.isDestroyed && sconce.isOn !== false);
  const fireplaces = scene.furniture
    .filter((item) => item.id.includes('kamin') && !item.isDestroyed)
    .map((item) => ({ x: item.x + item.w / 2, y: item.y + item.h * 0.86 }));

  return (x: number, y: number): boolean => {
    const dx = x - player.x;
    const dy = y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 80) return true;

    for (const sconce of litSconces) {
      if (Math.hypot(x - sconce.x, y - sconce.y) <= sconce.radius * 0.85) return true;
    }
    for (const fire of fireplaces) {
      if (Math.hypot(x - fire.x, y - fire.y) <= 185) return true;
    }

    if (dist > 270) return false;
    if (Math.abs(normalizeAngle(Math.atan2(dy, dx) - player.angle)) > 0.44) return false;

    const t = rayHit(player.x, player.y, dx / dist, dy / dist, dist, sightSegments);
    return t >= dist - 1;
  };
}

function drawLighting(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  cam: { x: number; y: number },
  time: number
) {
  if (!lightCtx) lightCtx = createCanvas(BUFFER_W, BUFFER_H).getContext('2d');
  if (!lightCtx) return;
  const lctx = lightCtx;

  // En misiones nocturnas se rebaja la oscuridad base y se sube la luz
  // ambiental para que los muros sigan leyéndose fuera del cono.
  const night = scene.nightMode || scene.missionMode === 'SCHWECHAT';

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, BUFFER_W, BUFFER_H);
  lctx.fillStyle = night ? 'rgba(6, 10, 18, 0.74)' : 'rgba(6, 10, 18, 0.8)';
  lctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
  lctx.globalCompositeOperation = 'destination-out';
  lctx.translate(BUFFER_W / 2 - cam.x, BUFFER_H / 2 - cam.y);

  // Luz ambiental mínima: la escena se lee sin linterna
  lctx.fillStyle = night ? 'rgba(0, 0, 0, 0.24)' : 'rgba(0, 0, 0, 0.16)';
  lctx.fillRect(cam.x - BUFFER_W / 2, cam.y - BUFFER_H / 2, BUFFER_W, BUFFER_H);

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
  ctx.drawImage(lctx.canvas, 0, 0);

  // Halos cálidos aditivos, en coordenadas de mundo
  ctx.save();
  ctx.translate(BUFFER_W / 2 - cam.x, BUFFER_H / 2 - cam.y);
  ctx.globalCompositeOperation = 'lighter';
  for (const glow of glowSources) {
    const gradient = ctx.createRadialGradient(glow.x, glow.y, 2, glow.x, glow.y, glow.radius);
    gradient.addColorStop(0, hexToRgba(glow.color, 0.16));
    gradient.addColorStop(0.5, hexToRgba(glow.color, 0.06));
    gradient.addColorStop(1, hexToRgba(glow.color, 0));
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
  const x0 = cam.x - BUFFER_W / 2;
  const y0 = cam.y - BUFFER_H / 2;
  const x1 = cam.x + BUFFER_W / 2;
  const y1 = cam.y + BUFFER_H / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(190, 205, 220, 0.14)';
  for (let i = 0; i < 150; i++) {
    const rx = x0 + hash2(i * 13.7 + time * 0.17, i * 2.3) * (x1 - x0);
    const ry = y0 + hash2(i * 9.1, time * 0.17 + i * 1.7) * (y1 - y0);
    ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 1);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Actores                                                             */
/* ------------------------------------------------------------------ */

// `drawPixelArtActor` pinta el sprite a su tamaño de mundo (48 px) y una puerta mide 70,
// así que el agente ocupa algo más de la mitad del hueco, como en la vista táctica.

function drawActors(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  time: number,
  isVisible: (x: number, y: number) => boolean
) {
  // Los cuerpos en el suelo van primero para no tapar a los que siguen en pie.
  const rank = (actor: ActorEntity) => (actor.state === 'DEAD' ? 0 : 1);
  const actors = [...scene.actors].sort((a, b) => rank(a) - rank(b) || a.y - b.y);

  for (const actor of actors) {
    if (!isVisible(actor.x, actor.y)) continue;
    const dead = actor.state === 'DEAD';

    ctx.save();
    ctx.translate(actor.x, actor.y);

    // Plantando: se inclina hacia el objetivo y agacha el cuerpo, para que el
    // gesto se lea aunque el sprite no tenga una pose propia de plantado.
    if (!dead && scene.planting && actor.role === 'PLAYER') {
      const anchor = chargeAnchor(scene, scene.planting);
      const dx = anchor.x - actor.x;
      const dy = anchor.y - actor.y;
      const dist = Math.hypot(dx, dy) || 1;
      ctx.translate((dx / dist) * 2.5, (dy / dist) * 2.5);
      ctx.scale(0.95, 0.95);
    }

    // Neutralizado: el sprite de pie no se distingue de un sospechoso armado,
    // así que el cuerpo se tiende de lado y deja su charco en el suelo.
    if (dead) {
      ctx.fillStyle = 'rgba(96, 20, 22, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 13, 7, actor.angle, 0, Math.PI * 2);
      ctx.fill();
      // Tendido: girado con su ángulo, estirado a lo largo y aplastado de lado.
      ctx.rotate(actor.angle);
      ctx.scale(0.72, 1.32);
    } else if (actor.role !== 'PLAYER' && actor.role !== 'SQUAD') {
      // Los operadores resuelven la dirección con la hoja de 8 direcciones.
      ctx.rotate(actor.angle);
    }

    drawPixelArtActor(ctx, actor, scene.primaryWeapon, scene.activeTool, time);
    ctx.restore();
  }
}

/**
 * Pinta un cuadro completo de la escena en `ctx`, que debe ser el buffer de
 * arte. El marco (limpieza, traslación de cámara y pase de luz) forma parte del
 * renderer; la presentación a pantalla queda fuera.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: PixelScene,
  cam: SceneCamera,
  time: number
): void {
  const view: SceneView = {
    x0: cam.x - BUFFER_W / 2,
    y0: cam.y - BUFFER_H / 2,
    x1: cam.x + BUFFER_W / 2,
    y1: cam.y + BUFFER_H / 2,
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#05080D';
  ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);

  ctx.save();
  ctx.translate(BUFFER_W / 2 - cam.x, BUFFER_H / 2 - cam.y);

  drawFloors(ctx, scene, view);

  // Partículas de polvo flotante (ambientales)
  drawDustMotes(ctx, cam, time);

  // Alfombra bajo el salón
  const salon = scene.rooms.find((room) => room.id === 'ALPEN_SALON');
  if (salon && scene.missionMode === 'TIROL') {
    drawRug(ctx, salon.x + 190, salon.y + 190, 210, 130);
  }

  // Huellas en la nieve y rastro tenue de polvo en interiores
  updateDustTrail(scene, time);
  drawFootprints(ctx, scene, view, time);

  // Casquillos y marcas de impacto persistentes del motor
  drawFloorDecals(ctx, scene.decals, decalSolids(scene));

  const isVisible = createVisibilityTest(scene, wallAndDoorSegments(scene));
  drawFurniture(ctx, scene, time, isVisible);
  drawActors(ctx, scene, time, isVisible);
  drawWalls(ctx, scene, view);
  for (const charge of scene.charges) {
    drawCharge(ctx, chargeAnchor(scene, charge), view, time);
  }
  if (scene.planting) {
    drawPlanting(ctx, scene, chargeAnchor(scene, scene.planting), view, time);
  }

  ctx.restore();

  drawLighting(ctx, scene, cam, time);
}
