import { describe, expect, it } from 'vitest';
import { createGrazApartmentLayout } from './grazMap';
import { hitoEscuadron, rutaEntreSalas, salaDe, SQUAD_DOOR_APPROACH } from './squadNav';

const { rooms, doors } = createGrazApartmentLayout();

// Inserción A (escalera) y el rendido en la cocina: el caso que dejaba a Kobra-2
// clavado contra la pared oeste del piso.
const ESCALERA = { x: 233, y: 262 };
const COCINA = { x: 310, y: 205 };

const habitacionDe = (punto: { x: number; y: number }) => salaDe(rooms, punto)?.id;

describe('salaDe', () => {
  it('asigna cada punto a la estancia que lo contiene', () => {
    expect(habitacionDe(ESCALERA)).toBe('STIEGENHAUS');
    expect(habitacionDe(COCINA)).toBe('WOHNKUECHE');
  });

  it('no inventa estancia fuera del piso', () => {
    expect(salaDe(rooms, { x: 1270, y: 800 })).toBeNull();
  });
});

describe('rutaEntreSalas', () => {
  it('rodea el piso de la escalera a la cocina por las dos puertas', () => {
    const ruta = rutaEntreSalas(rooms, doors, ESCALERA, COCINA);

    expect(ruta.map(habitacionDe)).toEqual([
      'STIEGENHAUS',
      'VORRAUM',
      'VORRAUM',
      'WOHNKUECHE',
    ]);
    // Se planta al oeste de la puerta de entrada y cruza hacia el recibidor.
    expect(ruta[0].x).toBeLessThan(250);
    expect(ruta[0].y).toBeCloseTo(410, 0);
    expect(ruta[1].x).toBeGreaterThan(250);
    // Y entra en la cocina por el vano de la puerta interior.
    expect(ruta[3].y).toBeLessThan(280);
    expect(ruta[3].x).toBeGreaterThan(355);
    for (const punto of ruta) {
      expect(Math.hypot(punto.x - ESCALERA.x, punto.y - ESCALERA.y)).toBeGreaterThan(10);
    }
  });

  it('no devuelve ruta dentro de la misma estancia', () => {
    expect(rutaEntreSalas(rooms, doors, COCINA, { x: 500, y: 150 })).toEqual([]);
  });

  it('no devuelve ruta si el objetivo no está en ninguna estancia', () => {
    expect(rutaEntreSalas(rooms, doors, ESCALERA, { x: 1270, y: 800 })).toEqual([]);
  });

  it('arranca cruzando cuando el binomio ya está en el vano', () => {
    const ruta = rutaEntreSalas(rooms, doors, { x: 250, y: 410 }, COCINA);
    expect(ruta).toHaveLength(3);
    expect(ruta.map(habitacionDe)).toEqual(['VORRAUM', 'VORRAUM', 'WOHNKUECHE']);
    expect(ruta[0].x).toBeCloseTo(250 + SQUAD_DOOR_APPROACH, 0);
  });
});

describe('hitoEscuadron', () => {
  it('manda al binomio al primer hito de la ruta, no en línea recta al objetivo', () => {
    const hito = hitoEscuadron(rooms, doors, ESCALERA, COCINA);
    expect(hito.x).toBeLessThan(250);
    expect(Math.hypot(hito.x - COCINA.x, hito.y - COCINA.y)).toBeGreaterThan(150);
  });

  it('va directo al objetivo cuando ya comparte estancia', () => {
    expect(hitoEscuadron(rooms, doors, COCINA, { x: 500, y: 150 })).toEqual({ x: 500, y: 150 });
  });
});
