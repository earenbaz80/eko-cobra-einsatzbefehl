/**
 * Motor de bitmaps del arte de píxeles.
 *
 * Un `PixelArt` es una rejilla de caracteres con su paleta. Se rasteriza a un
 * canvas de `scale` píxeles por celda y se cachea por baldosa; el relleno repite
 * la baldosa con volteos deterministas, que es lo que rompe la cuadrícula sin
 * recurrir a `Math.random`.
 *
 * No conoce ninguna escena: recibe el catálogo de patrones, su escala y el lado
 * de la baldosa en unidades de mundo.
 */

export interface PixelArt {
  rows: string[];
  map: Record<string, string>;
}

interface TileBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TileSet {
  getTile(name: string, variant?: number): HTMLCanvasElement;
  fillTiles(
    ctx: CanvasRenderingContext2D,
    tileName: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bounds?: TileBounds,
    variants?: number
  ): void;
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function art(map: Record<string, string>, rows: string[]): PixelArt {
  const width = Math.max(...rows.map((row) => row.length));
  return { map, rows: rows.map((row) => row.padEnd(width, '.')) };
}

export function hash2(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return Math.abs(value - Math.floor(value));
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

/**
 * Caché de baldosas del catálogo dado. `tileSize` es el lado de la baldosa en
 * unidades de mundo; `scale` es cuántos píxeles de canvas mide cada píxel de arte.
 */
export function createTileSet(
  tiles: Record<string, PixelArt[]>,
  scale: number,
  tileSize: number
): TileSet {
  const cache = new Map<string, HTMLCanvasElement>();

  function getTile(name: string, variant = 0): HTMLCanvasElement {
    const variants = tiles[name] ?? tiles.wall;
    const index = variant % variants.length;
    const key = `${name}:${index}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const canvas = renderArtToCanvas(variants[index], scale);
    cache.set(key, canvas);
    return canvas;
  }

  function tileVariant(x: number, y: number, count: number): number {
    return Math.floor(hash2(Math.floor(x / tileSize), Math.floor(y / tileSize)) * count);
  }

  /**
   * Rellena un rectángulo con baldosas, recortado a `bounds` (por defecto, el
   * propio rectángulo: nada se sale de él). `variants` limita cuántas variantes
   * del catálogo se reparten; con una sola, la textura no alterna.
   */
  function fillTiles(
    ctx: CanvasRenderingContext2D,
    tileName: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bounds: TileBounds = { x0: x, y0: y, x1: x + w, y1: y + h },
    variants = 1
  ) {
    const x0 = Math.max(x, bounds.x0);
    const y0 = Math.max(y, bounds.y0);
    const x1 = Math.min(x + w, bounds.x1);
    const y1 = Math.min(y + h, bounds.y1);
    if (x1 <= x0 || y1 <= y0) return;

    const startX = Math.floor(x0 / tileSize) * tileSize;
    const startY = Math.floor(y0 / tileSize) * tileSize;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();

    for (let ty = startY; ty < y1; ty += tileSize) {
      for (let tx = startX; tx < x1; tx += tileSize) {
        const sprite = getTile(tileName, tileVariant(tx, ty, variants));
        // Volteos pseudoaleatorios: rompen la repetición en cuadrícula
        const flip = hash2(tx * 1.7, ty * 2.3);
        if (flip > 0.75) {
          ctx.save();
          ctx.translate(tx + tileSize, ty);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, 0, 0);
          ctx.restore();
        } else if (flip > 0.5) {
          ctx.save();
          ctx.translate(tx, ty + tileSize);
          ctx.scale(1, -1);
          ctx.drawImage(sprite, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(sprite, tx, ty);
        }
      }
    }

    ctx.restore();
  }

  return { getTile, fillTiles };
}
