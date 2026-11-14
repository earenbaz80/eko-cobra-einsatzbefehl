import { describe, expect, it } from 'vitest';
import { cambioEntreFirmas } from './canvas.mjs';

const firma = (...valores) => valores;

describe('cambioEntreFirmas', () => {
  it('dos fotogramas idénticos no cambian nada', () => {
    expect(cambioEntreFirmas(firma(10, 20, 30, 40), firma(10, 20, 30, 40))).toBe(0);
  });

  it('cuenta la proporción de celdas que cambian', () => {
    const antes = firma(10, 10, 10, 10);
    const despues = firma(10, 60, 10, 60);
    expect(cambioEntreFirmas(antes, despues)).toBe(0.5);
  });

  it('ignora el ruido por debajo del umbral', () => {
    const antes = firma(100, 100, 100);
    const despues = firma(112, 88, 100); // ±12 no supera el umbral por defecto
    expect(cambioEntreFirmas(antes, despues)).toBe(0);
  });

  it('cuenta justo por encima del umbral', () => {
    expect(cambioEntreFirmas(firma(100, 100), firma(113, 87))).toBe(1);
  });

  it('respeta un umbral propio', () => {
    const antes = firma(100, 100);
    const despues = firma(140, 60); // 40 de diferencia
    expect(cambioEntreFirmas(antes, despues, 50)).toBe(0);
    expect(cambioEntreFirmas(antes, despues, 30)).toBe(1);
  });

  it('una firma ausente o de otro tamaño cuenta como cambio total', () => {
    expect(cambioEntreFirmas(null, firma(1, 2))).toBe(1);
    expect(cambioEntreFirmas(firma(1, 2), firma(1, 2, 3))).toBe(1);
  });
});
