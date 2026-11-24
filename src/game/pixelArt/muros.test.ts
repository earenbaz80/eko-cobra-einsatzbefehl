import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { WallSegment } from '../types';
import { boundsMuro, celdasMuro, rematesMuro } from './muros';
import { CONTORNO, COLORES_PALETA, PINCELES_ESCENA } from './palette';
import { LADOS_MURO, MASCARAS_MURO, arteMuro } from './tiles';

const colorDe = (mascara: number, x: number, y: number): string => {
  const arte = arteMuro(mascara);
  return arte.map[arte.rows[y][x]];
};

const muro = (id: string, x1: number, y1: number, x2: number, y2: number): WallSegment => ({
  id,
  x1,
  y1,
  x2,
  y2,
});

describe('auto-tiling de muros', () => {
  it('produce 16 variantes distintas de 8×8', () => {
    const firmas = new Set<string>();
    for (let mascara = 0; mascara < MASCARAS_MURO; mascara++) {
      const { rows } = arteMuro(mascara);
      expect(rows).toHaveLength(8);
      for (const fila of rows) expect(fila).toHaveLength(8);
      firmas.add(rows.join('\n'));
    }
    expect(firmas.size).toBe(MASCARAS_MURO);
  });

  it('solo usa colores de la paleta cerrada', () => {
    for (let mascara = 0; mascara < MASCARAS_MURO; mascara++) {
      for (const color of Object.values(arteMuro(mascara).map)) {
        expect(COLORES_PALETA.has(color)).toBe(true);
      }
    }
  });

  it('pone el cap solo en el borde norte libre', () => {
    const sinNorte = MASCARAS_MURO - 1 - LADOS_MURO.norte;
    expect(colorDe(sinNorte, 0, 0)).toBe(PINCELES_ESCENA.muroCanto.luz);
    expect(colorDe(sinNorte, 7, 1)).toBe(PINCELES_ESCENA.muroCanto.base);

    // Con vecino al norte el canto no se ilumina: la celda es interior.
    expect(colorDe(MASCARAS_MURO - 1, 0, 0)).not.toBe(PINCELES_ESCENA.muroCanto.luz);
  });

  it('pone el zócalo solo en el borde sur libre', () => {
    const sinSur = MASCARAS_MURO - 1 - LADOS_MURO.sur;
    expect(colorDe(sinSur, 0, 7)).toBe(CONTORNO);
    expect(colorDe(sinSur, 7, 6)).toBe(PINCELES_ESCENA.muro.sombra);

    expect(colorDe(MASCARAS_MURO - 1, 0, 7)).not.toBe(CONTORNO);
  });

  it('cierra los cantos laterales donde no hay vecino', () => {
    const sinOeste = MASCARAS_MURO - 1 - LADOS_MURO.oeste;
    const sinEste = MASCARAS_MURO - 1 - LADOS_MURO.este;
    expect(colorDe(sinOeste, 0, 3)).toBe(PINCELES_ESCENA.muroCanto.sombra);
    expect(colorDe(sinOeste, 1, 3)).toBe(PINCELES_ESCENA.muro.luz);
    expect(colorDe(sinEste, 7, 3)).toBe(CONTORNO);
  });

  it('comparte máscara entre muros que se tocan', () => {
    const horizontal = muro('h', 90, 200, 250, 200);
    const vertical = muro('v', 250, 200, 250, 360);
    const celdas = celdasMuro([horizontal, vertical]);

    const fila = celdas.celdas(horizontal);
    expect(fila).toHaveLength(10);
    // Extremo oeste suelto: solo el este tiene vecino.
    expect(fila[0].mascara).toBe(LADOS_MURO.este);
    // Celda interior: vecinos a ambos lados.
    expect(fila[4].mascara).toBe(LADOS_MURO.este | LADOS_MURO.oeste);
    expect(celdas.celdas(vertical)).toHaveLength(10);

    // El vertical arranca exactamente donde termina el horizontal.
    expect(celdas.cubre(251, 200)).toBe(true);
    expect(celdas.cubre(89, 200)).toBe(false);
  });

  it('cierra con contorno el remate que da al aire', () => {
    const solo = muro('solo', 100, 400, 220, 400);
    const celdas = celdasMuro([solo]);
    expect(rematesMuro(boundsMuro(solo), celdas.cubre)).toHaveLength(2);

    const horizontal = muro('h', 90, 200, 250, 200);
    const vertical = muro('v', 250, 200, 250, 360);
    const juntas = celdasMuro([horizontal, vertical]);
    const remates = rematesMuro(boundsMuro(horizontal), juntas.cubre);
    // Solo el extremo oeste queda al aire; el este lo tapa el vertical.
    expect(remates).toHaveLength(1);
    expect(remates[0].x).toBe(boundsMuro(horizontal).x);
  });

  it('no deja colores literales en los pintores', () => {
    for (const archivo of ['./tiles.ts', './scene.ts']) {
      const fuente = readFileSync(new URL(archivo, import.meta.url), 'utf8');
      expect(fuente.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).toEqual([]);
    }
  });
});
