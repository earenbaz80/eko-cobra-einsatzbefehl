import { describe, expect, it } from 'vitest';
import { desgloseDeArranque, nombreDelRecurso } from './checks/entrega.mjs';

const PAGINA = 'http://127.0.0.1:4173/';

const KB = 1024;

describe('desgloseDeArranque', () => {
  const recursos = [
    { nombre: 'index-abc.js', bytes: 452 * KB },
    { nombre: 'vendor-def.js', bytes: 206 * KB },
    { nombre: 'index-ghi.css', bytes: 72 * KB },
    { nombre: 'battlemap-jkl.js', bytes: 60 * KB },
  ];

  it('pone primero el recurso más pesado', () => {
    const lineas = desgloseDeArranque(recursos, 790 * KB);
    expect(lineas[0]).toContain('index-abc.js');
    expect(lineas.at(-1)).toContain('battlemap-jkl.js');
  });

  it('da peso y porcentaje del total en cada línea', () => {
    expect(desgloseDeArranque(recursos, 790 * KB)).toEqual([
      '  index-abc.js 452 KB (57 %)',
      '  vendor-def.js 206 KB (26 %)',
      '  index-ghi.css 72 KB (9 %)',
      '  battlemap-jkl.js 60 KB (8 %)',
    ]);
  });

  it('no toca el orden del arreglo que recibe', () => {
    const original = [...recursos];
    desgloseDeArranque(recursos, 790 * KB);
    expect(recursos).toEqual(original);
  });
});

describe('nombreDelRecurso', () => {
  it('usa el nombre del archivo', () => {
    expect(nombreDelRecurso('http://127.0.0.1:4173/assets/index-abc.js', PAGINA)).toBe('index-abc.js');
  });

  it('llama index.html al documento, que no trae archivo en la URL', () => {
    expect(nombreDelRecurso('http://127.0.0.1:4173/', PAGINA)).toBe('index.html');
  });

  it('antepone el host cuando el recurso es de otro origen', () => {
    expect(
      nombreDelRecurso('https://fonts.googleapis.com/css2?family=JetBrains+Mono', PAGINA)
    ).toBe('fonts.googleapis.com/css2');
  });
});
