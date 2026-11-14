import { describe, expect, it } from 'vitest';
import { coincideMarca, leerMarca } from './marca.mjs';

const htmlConMarca = (sha) => `<!doctype html><html><head><meta name="eko-build" content="${sha}" /></head><body></body></html>`;
const SHA = 'a1396cd2f1e4b3c5d6a7b8c9d0e1f2a3b4c5d6e7';

describe('leerMarca', () => {
  it('lee el SHA que escribe el build', () => {
    expect(leerMarca(htmlConMarca(SHA))).toBe(SHA);
  });

  it('acepta comillas simples y el orden content/name invertido', () => {
    expect(leerMarca(`<meta content='${SHA}' name='eko-build'>`)).toBe(SHA);
  });

  it('devuelve null si no hay marca', () => {
    expect(leerMarca('<html><head><title>x</title></head></html>')).toBe(null);
  });
});

describe('coincideMarca', () => {
  it('es verdadero con el mismo commit', () => {
    expect(coincideMarca(htmlConMarca(SHA), SHA)).toBe(true);
  });

  it('no confunde mayúsculas ni espacios del entorno', () => {
    expect(coincideMarca(htmlConMarca(SHA), ` ${SHA.toUpperCase()} `)).toBe(true);
  });

  it('es falso con el commit anterior (HTML cacheado)', () => {
    expect(coincideMarca(htmlConMarca('d97c5d7aaaa'), SHA)).toBe(false);
  });

  it('es falso si lo publicado no trae marca', () => {
    expect(coincideMarca('<html></html>', SHA)).toBe(false);
  });

  it('sin SHA esperado no se afirma nada', () => {
    expect(coincideMarca(htmlConMarca(SHA), '')).toBe(false);
  });
});
