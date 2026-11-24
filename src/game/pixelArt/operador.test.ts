import { describe, expect, it } from 'vitest';
import {
  OPERADOR_DIRECCIONES,
  OPERADOR_FRAMES,
  OPERADOR_LADO,
  coloresOperador,
  cuadroOperador,
  fogonazoOperador,
  type OpcionesOperador,
} from './operador';
import { COLORES_PALETA, PINCELES_OPERADOR } from './palette';

const BASE: OpcionesOperador = { rol: 'PLAYER', arma: 'AUG', alerta: 'READY', direccion: 0, frame: 0 };

const firma = (lineas: string[]): string => lineas.join('\n');

describe('sprite nativo del operador', () => {
  it('mide 48×48 en todas las direcciones y fotogramas', () => {
    for (let direccion = 0; direccion < OPERADOR_DIRECCIONES; direccion++) {
      for (let frame = 0; frame < OPERADOR_FRAMES; frame++) {
        const cuadro = cuadroOperador({ ...BASE, direccion, frame });
        expect(cuadro).toHaveLength(OPERADOR_LADO);
        for (const fila of cuadro) expect(fila).toHaveLength(OPERADOR_LADO);
      }
    }
  });

  it('dibuja silueta y armas, no un cuadro vacío', () => {
    for (let direccion = 0; direccion < OPERADOR_DIRECCIONES; direccion++) {
      const cuadro = cuadroOperador({ ...BASE, direccion });
      const pintados = cuadro.join('').replace(/\./g, '').length;
      expect(pintados).toBeGreaterThan(280);
    }
  });

  it('distingue las ocho direcciones entre sí', () => {
    const firmas = new Set<string>();
    for (let direccion = 0; direccion < OPERADOR_DIRECCIONES; direccion++) {
      firmas.add(firma(cuadroOperador({ ...BASE, direccion })));
    }
    expect(firmas.size).toBe(OPERADOR_DIRECCIONES);
  });

  it('anima los cuatro fotogramas del paso', () => {
    for (let direccion = 0; direccion < OPERADOR_DIRECCIONES; direccion++) {
      const firmas = new Set<string>();
      for (let frame = 0; frame < OPERADOR_FRAMES; frame++) {
        firmas.add(firma(cuadroOperador({ ...BASE, direccion, frame })));
      }
      // El ciclo es 0, paso izquierdo, 0, paso derecho: tres poses, no cuatro.
      expect(firmas.size).toBe(3);
    }
  });

  it('distingue al binomio del operador y a cada arma', () => {
    const operador = firma(cuadroOperador(BASE));
    const binomio = firma(cuadroOperador({ ...BASE, rol: 'SQUAD' }));
    const corta = firma(cuadroOperador({ ...BASE, arma: 'CORTA' }));
    const escudo = firma(cuadroOperador({ ...BASE, arma: 'ESCUDO' }));
    expect(new Set([operador, binomio, corta, escudo]).size).toBe(4);
  });

  it('gira el fogonazo con la pose de 45° del sprite', () => {
    expect(fogonazoOperador('AUG', 0).angulo).toBeCloseTo(0);
    expect(fogonazoOperador('AUG', 1).angulo).toBeCloseTo(Math.PI / 4);
    // Un cursor a 15° pinta la pose 0: el destello no sigue el ángulo exacto.
    expect(fogonazoOperador('AUG', Math.PI / 12).angulo).toBeCloseTo(0);
    expect(fogonazoOperador('CORTA', -1).angulo).toBeCloseTo((7 * Math.PI) / 4);
  });

  it('no cuelga el fogonazo del escudo en la boca del fusil', () => {
    const fusil = fogonazoOperador('AUG', 2);
    const escudo = fogonazoOperador('ESCUDO', 2);
    expect(escudo.adelante).toBeLessThan(fusil.adelante);
    expect(escudo.costado).not.toBe(fusil.costado);
  });

  it('solo usa colores de la paleta cerrada', () => {
    // La paleta es cerrada: cada paso de cada rampa figura en el conjunto.
    for (const pincel of Object.values(PINCELES_OPERADOR)) {
      for (const color of [pincel.sombra, pincel.base, pincel.luz]) {
        expect(COLORES_PALETA.has(color)).toBe(true);
      }
    }

    for (let direccion = 0; direccion < OPERADOR_DIRECCIONES; direccion++) {
      for (const alerta of ['CALM', 'READY', 'COMBAT'] as const) {
        const colores = coloresOperador({ ...BASE, direccion, alerta });
        for (const fila of colores) {
          for (const color of fila) {
            if (color === null) continue;
            expect(COLORES_PALETA.has(color)).toBe(true);
          }
        }
      }
    }
  });
});
