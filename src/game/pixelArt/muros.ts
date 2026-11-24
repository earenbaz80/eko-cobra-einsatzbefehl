/**
 * Auto-tiling de muros para el render cenital.
 *
 * Los muros del motor son rectángulos axis-aligned de una baldosa de grosor, con
 * coordenadas que no caen en la grilla de `TILE`. Por eso las celdas se anclan a
 * cada muro (empiezan en su esquina) en vez de a una grilla global: así el cap
 * cae siempre en el borde norte real y el zócalo en el sur, sin cortes a mitad de
 * pared. La máscara de cada celda sí se calcula en coordenadas de mundo,
 * consultando la unión de todos los muros, así que un encuentro en L, una T o un
 * tabique que arranca de otro muro comparten la lectura.
 *
 * Reglas:
 * 1. `LADOS_MURO` (en `tiles.ts`) dice qué lado tiene vecino; las 16 variantes
 *    salen de esa máscara.
 * 2. El recorte es por muro: una celda parcial no invade el hueco de una puerta
 *    ni el vano de una ventana.
 * 3. Los remates se cierran aparte (`rematesMuro`), porque la última celda puede
 *    quedar recortada y perdería su canto.
 * 4. Las celdas se cachean por identidad del array de muros (el motor conserva
 *    `this.walls` entre cuadros) y las variantes se rasterizan una sola vez.
 */

import type { WallSegment } from '../types';
import { TILE, getTile } from './tiles';

export interface CajaMuro {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Celda de muro con su máscara de vecinos ya resuelta. */
export interface CeldaMuro extends CajaMuro {
  mascara: number;
}

const NORTE = 1;
const ESTE = 2;
const SUR = 4;
const OESTE = 8;

/** Rectángulo en planta de un muro: el grosor se reparte a los lados. */
export function boundsMuro(wall: WallSegment): CajaMuro {
  const grosor = wall.thickness ?? TILE;
  const horizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1);
  return {
    x: horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.x1, wall.x2) - grosor / 2,
    y: horizontal ? Math.min(wall.y1, wall.y2) - grosor / 2 : Math.min(wall.y1, wall.y2),
    w: horizontal ? Math.abs(wall.x2 - wall.x1) : grosor,
    h: horizontal ? grosor : Math.abs(wall.y2 - wall.y1),
  };
}

export interface CeldasMuro {
  /** ¿El punto de mundo cae dentro de algún muro? */
  cubre(px: number, py: number): boolean;
  /** Celdas del muro, ya con su máscara. Vacío si el muro no se dibujó antes. */
  celdas(wall: WallSegment): readonly CeldaMuro[];
}

const cacheCeldas = new WeakMap<readonly WallSegment[], CeldasMuro>();

export function celdasMuro(walls: readonly WallSegment[]): CeldasMuro {
  const cacheado = cacheCeldas.get(walls);
  if (cacheado) return cacheado;

  const cajas = walls.map(boundsMuro);
  const cubre = (px: number, py: number): boolean =>
    cajas.some((caja) => px >= caja.x && px < caja.x + caja.w && py >= caja.y && py < caja.y + caja.h);

  const porMuro = new WeakMap<WallSegment, CeldaMuro[]>();

  const celdas = (wall: WallSegment): readonly CeldaMuro[] => {
    const guardadas = porMuro.get(wall);
    if (guardadas) return guardadas;

    const b = boundsMuro(wall);
    const salida: CeldaMuro[] = [];
    for (let y = b.y; y < b.y + b.h; y += TILE) {
      for (let x = b.x; x < b.x + b.w; x += TILE) {
        const celda: CeldaMuro = {
          x,
          y,
          w: Math.min(TILE, b.x + b.w - x),
          h: Math.min(TILE, b.y + b.h - y),
          mascara: 0,
        };
        // Tres muestras por lado: en una T el muro vecino solo toca una parte
        // del canto, y con una sola muestra el cap se colaría en la unión.
        const toca = (x0: number, y0: number, x1: number, y1: number): boolean =>
          [-0.34, 0, 0.34].some((t) =>
            x0 === x1 ? cubre(x0, y0 + (y1 - y0) * (0.5 + t)) : cubre(x0 + (x1 - x0) * (0.5 + t), y0)
          );
        celda.mascara =
          (toca(celda.x, celda.y - 1, celda.x + celda.w, celda.y - 1) ? NORTE : 0) |
          (toca(celda.x + celda.w + 1, celda.y, celda.x + celda.w + 1, celda.y + celda.h) ? ESTE : 0) |
          (toca(celda.x, celda.y + celda.h + 1, celda.x + celda.w, celda.y + celda.h + 1) ? SUR : 0) |
          (toca(celda.x - 1, celda.y, celda.x - 1, celda.y + celda.h) ? OESTE : 0);
        salida.push(celda);
      }
    }

    porMuro.set(wall, salida);
    return salida;
  };

  const resultado: CeldasMuro = { cubre, celdas };
  cacheCeldas.set(walls, resultado);
  return resultado;
}

/**
 * Remate de un muro suelto: el borde que da al aire se cierra con dos píxeles de
 * contorno, aunque la última celda haya quedado recortada por la longitud.
 */
export function rematesMuro(b: CajaMuro, cubre: (px: number, py: number) => boolean): CajaMuro[] {
  const salida: CajaMuro[] = [];
  const horizontal = b.w >= b.h;
  if (horizontal) {
    const cy = b.y + b.h / 2;
    if (!cubre(b.x - 1, cy)) salida.push({ x: b.x, y: b.y, w: 2, h: b.h });
    if (!cubre(b.x + b.w + 1, cy)) salida.push({ x: b.x + b.w - 2, y: b.y, w: 2, h: b.h });
  } else {
    const cx = b.x + b.w / 2;
    if (!cubre(cx, b.y - 1)) salida.push({ x: b.x, y: b.y, w: b.w, h: 2 });
    if (!cubre(cx, b.y + b.h + 1)) salida.push({ x: b.x, y: b.y + b.h - 2, w: b.w, h: 2 });
  }
  return salida;
}

/** Lienzo de la variante de muro ya rasterizada (16 unidades de mundo de lado). */
export function lienzoMuro(mascara: number): HTMLCanvasElement {
  return getTile('muro', mascara);
}
