import { describe, expect, it } from 'vitest';
import { cabeElCuerpo, obstaculosDelMundo, planificarRuta } from './ruta.mjs';

/** Habitación de 400x400 con una pared central y, opcionalmente, un vano en ella. */
const mapa = ({ vano = { y1: 150, y2: 220 }, abierta = true, muebles = [], murosExtra = [] } = {}) => ({
  mission: 'prueba',
  walls: [
    { id: 'n', x1: 0, y1: 0, x2: 400, y2: 0 },
    { id: 's', x1: 0, y1: 400, x2: 400, y2: 400 },
    { id: 'w', x1: 0, y1: 0, x2: 0, y2: 400 },
    { id: 'e', x1: 400, y1: 0, x2: 400, y2: 400 },
    { id: 'n1', x1: 200, y1: 0, x2: 200, y2: vano ? vano.y1 : 400 },
    ...(vano ? [{ id: 'n2', x1: 200, y1: vano.y2, x2: 200, y2: 400 }] : []),
    ...murosExtra,
  ],
  doors: vano
    ? [
        {
          id: 'DOOR_PRUEBA',
          x1: 200,
          y1: vano.y1,
          x2: 200,
          y2: vano.y2,
          isFullyOpen: abierta,
          isOpen: abierta,
          isLocked: false,
          isBreached: false,
          isDestroyed: false,
        },
      ]
    : [],
  furniture: muebles,
});

describe('planificarRuta', () => {
  it('cruza el vano por el punto medio del hueco', () => {
    const ruta = planificarRuta(mapa(), { x: 100, y: 200 }, { x: 300, y: 200 });
    expect(ruta.motivo).toBeNull();
    expect(ruta.puntos.some((punto) => punto.x === 200 && punto.y === 185)).toBe(true);
    expect(ruta.puntos[ruta.puntos.length - 1]).toEqual({ x: 300, y: 200 });
  });

  it('alinea el carril con la hoja cerrada antes y después del vano', () => {
    const ruta = planificarRuta(mapa(), { x: 100, y: 200 }, { x: 300, y: 200 });
    expect(ruta.motivo).toBeNull();
    // Los puntos de carril están a 17 px de la hoja cerrada (x = 200), a la altura
    // de su punto medio: el cuerpo se centra antes de cruzar y sale centrado.
    expect(ruta.puntos).toContainEqual({ x: 183, y: 185 });
    expect(ruta.puntos).toContainEqual({ x: 200, y: 185 });
    expect(ruta.puntos).toContainEqual({ x: 217, y: 185 });
    const entrada = ruta.puntos.findIndex((punto) => punto.x === 183 && punto.y === 185);
    const medio = ruta.puntos.findIndex((punto) => punto.x === 200 && punto.y === 185);
    const salida = ruta.puntos.findIndex((punto) => punto.x === 217 && punto.y === 185);
    expect(entrada).toBeLessThan(medio);
    expect(medio).toBeLessThan(salida);
  });

  it('se centra en el carril aunque arranque pegado a un jamb del vano', () => {
    // Reproduce el enganche del salón: cuerpo a 8 px de la hoja cerrada y a 17,6 px
    // del jamb, con el destino al otro lado a la misma altura. Sin alineación la
    // ruta cruza en diagonal por la esquina; con ella primero va al carril.
    const ruta = planificarRuta(mapa(), { x: 192, y: 204.3 }, { x: 240, y: 204.3 });
    expect(ruta.motivo).toBeNull();
    expect(ruta.puntos).toContainEqual({ x: 183, y: 185 });
    expect(ruta.puntos).toContainEqual({ x: 200, y: 185 });
    // El destino pedido se sigue afirmando al final de la ruta.
    expect(ruta.puntos[ruta.puntos.length - 1]).toEqual({ x: 240, y: 204.3 });
  });

  it('no cruza una hoja que no está franca', () => {
    const ruta = planificarRuta(mapa({ abierta: false }), { x: 100, y: 200 }, { x: 300, y: 200 });
    expect(ruta.puntos).toEqual([]);
    expect(ruta.motivo).toContain('no hay paso');
  });

  it('rodea un mueble que bloquea la línea recta', () => {
    const ruta = planificarRuta(
      mapa({ muebles: [{ id: 'MESA', x: 250, y: 150, w: 80, h: 100, blocksMovement: true }] }),
      { x: 100, y: 200 },
      { x: 380, y: 200 }
    );
    expect(ruta.motivo).toBeNull();
    // Ningún punto de la ruta pisa la holgura del mueble.
    for (const punto of ruta.puntos) {
      const cx = Math.max(250, Math.min(punto.x, 330));
      const cy = Math.max(150, Math.min(punto.y, 250));
      expect(Math.hypot(punto.x - cx, punto.y - cy)).toBeGreaterThanOrEqual(17);
    }
  });

  it('avisa cuando el destino no tiene holgura', () => {
    const ruta = planificarRuta(
      mapa({ muebles: [{ id: 'ARMARIO', x: 340, y: 180, w: 60, h: 40, blocksMovement: true }] }),
      { x: 100, y: 200 },
      { x: 365, y: 200 }
    );
    expect(ruta.puntos).toEqual([]);
    expect(ruta.motivo).toContain('holgura');
  });

  it('en campo abierto va en línea recta al destino', () => {
    const ruta = planificarRuta(mapa(), { x: 60, y: 60 }, { x: 150, y: 90 });
    expect(ruta.puntos).toHaveLength(2);
    expect(ruta.puntos[1]).toEqual({ x: 150, y: 90 });
  });
});

describe('cabeElCuerpo', () => {
  it('no deja el cuerpo a menos de 17 px de un muro', () => {
    const obstaculos = obstaculosDelMundo(mapa());
    expect(cabeElCuerpo(50, 16, obstaculos)).toBe(false);
    expect(cabeElCuerpo(50, 60, obstaculos)).toBe(true);
  });

  it('trata la hoja cerrada como muro y la franca como paso', () => {
    const cerrada = obstaculosDelMundo(mapa({ abierta: false }));
    const abierta = obstaculosDelMundo(mapa({ abierta: true }));
    expect(cabeElCuerpo(200, 185, cerrada)).toBe(false);
    expect(cabeElCuerpo(200, 185, abierta)).toBe(true);
  });

  it('deja fuera del paso un mueble que bloquea aunque no tape la vista', () => {
    const obstaculos = obstaculosDelMundo(
      mapa({ muebles: [{ id: 'MESA', x: 240, y: 170, w: 60, h: 60, blocksMovement: true }] })
    );
    expect(cabeElCuerpo(270, 200, obstaculos)).toBe(false);
    expect(cabeElCuerpo(270, 260, obstaculos)).toBe(true);
  });
});
