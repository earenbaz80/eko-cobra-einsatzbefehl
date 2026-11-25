import { describe, expect, it } from 'vitest';
import { CADENCIA_VIGILANTE, cabeceraDeMuestra, formatearLineaDeTiempo } from './vigilante.mjs';

/** Muestra mínima con todo lo que mira el formateador. */
const muestra = (ms, cambios = {}) => ({
  ms,
  estado: 'EN_JUEGO',
  tick: 100 + ms,
  jugador: { x: 390, y: 430 },
  binomio: { x: 880, y: 470, orden: 'HOLD', puerta: null, brecha: null },
  actores: [
    {
      rol: 'SUSPECT',
      estado: 'ALERTED',
      sala: 'WOHNKUECHE',
      x: 374.2,
      y: 263,
      vistoOperador: false,
      vistoBinomio: true,
      espejo: false,
    },
  ],
  puertas: [
    { id: 'DOOR_LIVING', abierta: false, franca: false, conLlave: false, brechada: false, destruida: false },
  ],
  ...cambios,
});

describe('formatearLineaDeTiempo', () => {
  it('no escribe nada sin muestras', () => {
    expect(formatearLineaDeTiempo([])).toBe('');
  });

  it('titula con la cadencia y la duración real', () => {
    const texto = formatearLineaDeTiempo([muestra(0)]);
    expect(texto.split('\n')[0]).toBe('## Línea de tiempo del motor');
    expect(texto).toContain(`cada ${CADENCIA_VIGILANTE} ms`);
    expect(texto).toContain('sobre 0.0 s');
  });

  it('emite el cambio de estado con el detalle de actores y puertas', () => {
    const texto = formatearLineaDeTiempo([
      muestra(0),
      muestra(250, { jugador: { x: 390, y: 430 }, puertas: [] }),
      muestra(500),
    ]);
    expect(texto).toContain('jugador (390, 430)');
    expect(texto).toContain('binomio (880, 470) HOLD');
    expect(texto).toContain('actores: SUSPECT/ALERTED/WOHNKUECHE (374.2, 263) jBm');
    expect(texto).toContain('puertas: DOOR_LIVING cerrada');
    expect(texto).toContain('puertas: ninguna del recorrido en el mundo');
  });

  it('nombra el estado de la puerta sin perder el franco', () => {
    const franca = muestra(250, {
      puertas: [
        { id: 'DOOR_KITCHEN', abierta: true, franca: true, conLlave: false, brechada: false, destruida: false },
      ],
    });
    const aMedias = muestra(250, {
      puertas: [
        { id: 'DOOR_KITCHEN', abierta: true, franca: false, conLlave: false, brechada: false, destruida: false },
      ],
    });
    expect(formatearLineaDeTiempo([franca])).toContain('DOOR_KITCHEN franca');
    expect(formatearLineaDeTiempo([aMedias])).toContain('DOOR_KITCHEN a medias');
  });

  it('deja latidos en vez de repetir cada cuarto de segundo', () => {
    const quietas = Array.from({ length: 3 }, (_, indice) => muestra(indice * 250));
    const texto = formatearLineaDeTiempo(quietas, { latido: 2 });
    expect(texto.match(/sin cambios/g)).toHaveLength(1);
    expect(texto).toContain('(sin cambios)');
  });
});

describe('cabeceraDeMuestra', () => {
  it('marca el tick, el estado y el objetivo del binomio', () => {
    const texto = cabeceraDeMuestra(
      muestra(1250, {
        binomio: { x: 520, y: 430, orden: 'FOLLOW', puerta: 'DOOR_LIVING', brecha: null },
      })
    );
    expect(texto).toBe(
      '+  1.25 s · tick 1350 · EN_JUEGO · jugador (390, 430) · binomio (520, 430) FOLLOW →DOOR_LIVING'
    );
  });
});
