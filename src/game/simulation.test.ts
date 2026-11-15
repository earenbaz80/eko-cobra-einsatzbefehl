import { describe, expect, it } from 'vitest';
import {
  avanzar,
  colisiona,
  crearPartida,
  crearPartidaDesdeMundo,
  crearAzar,
  deslizarConColision,
  distanciaASegmento,
  PASO_MAXIMO,
  type Partida,
} from './simulation';

const PASO = 0.05;

/** Avanza n pasos de 50 ms. */
const correr = (partida: Partida, pasos: number) => {
  for (let i = 0; i < pasos; i += 1) partida.avanzar(PASO);
};

describe('distanciaASegmento', () => {
  it('mide la perpendicular y los extremos', () => {
    expect(distanciaASegmento(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distanciaASegmento(-4, 0, 0, 0, 10, 0)).toBe(4);
    expect(distanciaASegmento(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe('colisiona', () => {
  const paredes = [{ x1: 0, y1: 100, x2: 100, y2: 100 }];
  const puertas = [{ x1: 200, y1: 0, x2: 200, y2: 100, isOpen: false }];
  const muebles = [{ x: 300, y: 300, w: 40, h: 40, blocksMovement: true }];

  it('choca con la pared dentro del margen y no fuera', () => {
    expect(colisiona(50, 100, 9, paredes, [], [])).toBe(true);
    expect(colisiona(50, 112, 9, paredes, [], [])).toBe(false); // 12 px = radio + margen
    expect(colisiona(50, 111.9, 9, paredes, [], [])).toBe(true);
  });

  it('la puerta sin datos de giro deja pasar su hueco al abrirse o destruirse', () => {
    expect(colisiona(200, 50, 9, [], puertas, [])).toBe(true);
    expect(colisiona(200, 50, 9, [], [{ ...puertas[0], isOpen: true }], [])).toBe(false);
    expect(colisiona(200, 50, 9, [], [{ ...puertas[0], isDestroyed: true }], [])).toBe(false);
  });

  it('la hoja abierta sigue siendo un obstáculo aunque el hueco quede libre', () => {
    const puertaAbierta = {
      ...puertas[0],
      x1: 100,
      y1: 100,
      x2: 180,
      y2: 100,
      hingeX: 100,
      hingeY: 100,
      currentAngle: Math.PI / 2,
      isOpen: true,
    };

    // El hueco original queda libre...
    expect(colisiona(140, 100, 9, [], [puertaAbierta], [])).toBe(false);
    // ...pero la hoja girada hacia el interior no se puede atravesar.
    expect(colisiona(100, 140, 9, [], [puertaAbierta], [])).toBe(true);
    expect(colisiona(180, 100, 9, [], [{ ...puertaAbierta, isDestroyed: true }], [])).toBe(false);
  });

  it('un paso grande no atraviesa una pared fina', () => {
    const actor = { x: 0, y: 0 };
    const pared = [{ x1: 40, y1: -100, x2: 40, y2: 100 }];
    deslizarConColision(actor, 100, 0, (x, y) => colisiona(x, y, 9, pared, [], []));
    expect(actor.x).toBeLessThan(28);
  });

  it('el mueble bloquea solo si blocksMovement y no está destruido', () => {
    expect(colisiona(310, 320, 9, [], [], muebles)).toBe(true);
    expect(colisiona(310, 320, 9, [], [], [{ ...muebles[0], blocksMovement: false }])).toBe(false);
    expect(colisiona(310, 320, 9, [], [], [{ ...muebles[0], isDestroyed: true }])).toBe(false);
    expect(colisiona(280, 320, 9, [], [], muebles)).toBe(false); // 20 px del borde
  });
});

describe('crearAzar', () => {
  it('es determinista con la misma semilla', () => {
    const a = crearAzar(7);
    const b = crearAzar(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('cambia con otra semilla y se queda en [0, 1)', () => {
    const a = crearAzar(7);
    const b = crearAzar(8);
    expect(a()).not.toBe(b());
    const azar = crearAzar(123);
    for (let i = 0; i < 50; i += 1) {
      const valor = azar();
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    }
  });
});

describe('crearPartida', () => {
  it('es determinista: misma misión y semilla, mismo estado inicial', () => {
    const a = crearPartida('pasillo', 42);
    const b = crearPartida('pasillo', 42);
    expect(a.jugador).toEqual(b.jugador);
    expect(a.mundo).toEqual(b.mundo);
    expect(a.tick).toBe(0);
  });

  it('la semilla cambia la orientación inicial', () => {
    expect(crearPartida('pasillo', 42).jugador.orientacion).not.toBe(crearPartida('pasillo', 43).jugador.orientacion);
  });

  it('cada partida tiene su propio mundo: abrir una puerta no afecta a la siguiente', () => {
    const a = crearPartida('pasillo', 1);
    a.mundo.puertas[0].isOpen = true;
    expect(crearPartida('pasillo', 1).mundo.puertas[0].isOpen).toBe(false);
  });

  it('rechaza misiones que no existen', () => {
    expect(() => crearPartida('inexistente' as never, 1)).toThrow(/misión desconocida/);
  });
});

describe('movimiento y colisión', () => {
  it('avanza a la velocidad del jugador y acumula tick y tiempo', () => {
    const partida = crearPartida('pasillo', 1);
    partida.entrada.x = 1;
    partida.avanzar(PASO);
    expect(partida.jugador.x).toBeCloseTo(66); // 60 + 120 * 0.05
    expect(partida.jugador.y).toBe(80);
    expect(partida.tick).toBe(1);
    expect(partida.tiempo).toBeCloseTo(PASO);
  });

  it('la diagonal no es más rápida que la recta', () => {
    const recta = crearPartida('pasillo', 1);
    recta.entrada = { x: 1, y: 0 };
    recta.avanzar(PASO);
    const diagonal = crearPartida('pasillo', 1);
    diagonal.entrada = { x: 1, y: 1 };
    diagonal.avanzar(PASO);
    const recorrido = Math.hypot(diagonal.jugador.x - 60, diagonal.jugador.y - 80);
    expect(recorrido).toBeCloseTo(recta.jugador.x - 60);
  });

  it('la entrada quieta no mueve al jugador pero cuenta el paso', () => {
    const partida = crearPartida('almacen', 1);
    partida.avanzar(PASO);
    expect(partida.jugador.x).toBe(80);
    expect(partida.jugador.y).toBe(130);
    expect(partida.tick).toBe(1);
  });

  it('no atraviesa la puerta cerrada y se queda justo antes', () => {
    const partida = crearPartida('pasillo', 1);
    partida.entrada = { x: 1, y: 0 };
    correr(partida, 60);
    expect(partida.jugador.x).toBe(288); // 300 - (radio 9 + margen 3)
    expect(partida.jugador.x).toBeLessThan(300);
  });

  it('con la puerta abierta sigue avanzando', () => {
    const partida = crearPartida('pasillo', 1);
    partida.entrada = { x: 1, y: 0 };
    correr(partida, 40);
    expect(partida.jugador.x).toBe(288);
    partida.mundo.puertas[0].isOpen = true;
    correr(partida, 5);
    expect(partida.jugador.x).toBe(318);
  });

  it('el mueble corta el paso antes de su borde', () => {
    const partida = crearPartida('almacen', 1);
    partida.entrada = { x: 1, y: 0 };
    correr(partida, 40);
    expect(partida.jugador.x).toBe(140); // 150 - radio 9, sin margen de pared
  });

  it('se desliza contra la pared: el eje libre sigue avanzando', () => {
    const partida = crearPartida('pasillo', 1);
    partida.entrada = { x: 1, y: 1 };
    correr(partida, 45);
    // 160 - (radio 9 + margen 3): se queda en el último paso válido, sin pasarse.
    expect(partida.jugador.y).toBeLessThanOrEqual(148);
    expect(partida.jugador.y).toBeGreaterThan(147);
    expect(partida.jugador.x).toBeGreaterThan(240); // sigue avanzando por el eje libre
  });

  it('un frame larguísimo se recorta al paso máximo', () => {
    const partida = crearPartida('pasillo', 1);
    partida.entrada = { x: 1, y: 0 };
    partida.avanzar(10);
    expect(partida.jugador.x).toBeCloseTo(60 + 120 * PASO_MAXIMO);
    expect(partida.tiempo).toBeCloseTo(PASO_MAXIMO);
  });

  it('avanzar() y partida.avanzar() son la misma ruta', () => {
    const a = crearPartida('almacen', 5);
    const b = crearPartida('almacen', 5);
    a.entrada = { x: -1, y: 0.5 };
    b.entrada = { x: -1, y: 0.5 };
    b.avanzar(PASO);
    avanzar(a, PASO);
    expect(a.jugador).toEqual(b.jugador);
    expect(a.tick).toBe(b.tick);
  });

  it('contra una pared real de Graz el jugador se detiene antes del muro', () => {
    const partida = crearPartida('graz', 7);
    partida.entrada = { x: -1, y: 0 };
    correr(partida, 200);
    // Pared exterior izquierda en x = 90: el jugador (radio 9 + margen 3) no puede atravesarla.
    expect(partida.jugador.x).toBeGreaterThan(90);
    expect(partida.jugador.x).toBeLessThanOrEqual(110);
    const antes = partida.jugador.x;
    correr(partida, 10);
    expect(partida.jugador.x).toBe(antes);
  });

  it('la ruta del motor (mundo propio) frena en la misma pared y avanza tick y tiempo', () => {
    const base = crearPartida('graz', 7);
    const partida = crearPartidaDesdeMundo('APARTMENT', base.mundo, { x: 185, y: 410 }, 7);
    partida.jugador.velocidad = 168; // velocidad base del motor
    partida.entrada = { x: -1, y: 0 };
    correr(partida, 200);
    expect(partida.jugador.x).toBeGreaterThan(90);
    expect(partida.jugador.x).toBeLessThanOrEqual(110);
    const antes = partida.jugador.x;
    correr(partida, 10);
    expect(partida.jugador.x).toBe(antes);
    expect(partida.tick).toBe(210);
    expect(partida.tiempo).toBeCloseTo(210 * PASO);
  });

  it('dos partidas con la misma semilla recorren lo mismo', () => {
    const a = crearPartida('almacen', 99);
    const b = crearPartida('almacen', 99);
    a.entrada = { x: 1, y: -1 };
    b.entrada = { x: 1, y: -1 };
    correr(a, 25);
    correr(b, 25);
    expect(a.jugador).toEqual(b.jugador);
    expect(a.tiempo).toBeCloseTo(b.tiempo);
  });
});
