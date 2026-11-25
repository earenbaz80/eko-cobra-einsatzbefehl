import { describe, expect, it } from 'vitest';
import { canonizarMundo, contarMundo, fnv1a, huellaDelMundo } from './huella-mundo.mjs';

const mundo = (cambios = {}) => ({
  mission: 'Misión 1: Piso Graz - Lend',
  walls: [{ id: 'w1', x1: 100, y1: 0, x2: 100, y2: 400 }],
  doors: [{ id: 'DOOR_KITCHEN', x1: 355, y1: 280, x2: 425, y2: 280, isLocked: false }],
  furniture: [
    { id: 'ESSTISCH', x: 480, y: 210, w: 60, h: 40, blocksMovement: true, blocksSight: false },
  ],
  ...cambios,
});

describe('huellaDelMundo', () => {
  it('devuelve el mismo valor para el mismo mundo', () => {
    expect(huellaDelMundo(mundo())).toBe(huellaDelMundo(mundo()));
  });

  it('cambia si se mueve un mueble', () => {
    const movido = mundo({
      furniture: [
        { id: 'ESSTISCH', x: 500, y: 210, w: 60, h: 40, blocksMovement: true, blocksSight: false },
      ],
    });
    expect(huellaDelMundo(movido)).not.toBe(huellaDelMundo(mundo()));
  });

  it('distingue un mueble que bloquea la vista de uno que no', () => {
    const conVista = mundo({
      furniture: [
        { id: 'ESSTISCH', x: 480, y: 210, w: 60, h: 40, blocksMovement: true, blocksSight: true },
      ],
    });
    expect(huellaDelMundo(conVista)).not.toBe(huellaDelMundo(mundo()));
  });

  it('no se inmuta con el ruido de coma flotante por debajo de la centésima', () => {
    const ruidoso = mundo({
      furniture: [
        { id: 'ESSTISCH', x: 480.0004, y: 210.0001, w: 60, h: 40, blocksMovement: true, blocksSight: false },
      ],
    });
    expect(huellaDelMundo(ruidoso)).toBe(huellaDelMundo(mundo()));
  });

  it('tolera un mundo vacío', () => {
    expect(huellaDelMundo({})).toBe(fnv1a(''));
    expect(contarMundo({})).toEqual({ muros: 0, puertas: 0, muebles: 0 });
  });
});

describe('canonizarMundo', () => {
  it('ordena por el orden del escenario y marca qué bloquea cada mueble', () => {
    expect(canonizarMundo(mundo())).toContain('f|ESSTISCH|480,210,60,40|10');
    expect(canonizarMundo(mundo())).toContain('d|DOOR_KITCHEN|355,280|425,280|0');
  });
});
