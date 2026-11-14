import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exigirCache, exigirTipo, fallos } from './informe.mjs';

/** Respuesta mínima: lo único que miran estos helpers son las cabeceras. */
const respuesta = (cabeceras) => ({ headers: new Headers(cabeceras) });

beforeEach(() => {
  fallos.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exigirTipo', () => {
  it('acepta el tipo esperado aunque lleve charset', () => {
    exigirTipo('JS de entrada', respuesta({ 'content-type': 'application/javascript; charset=utf-8' }), [
      'application/javascript',
      'text/javascript',
    ]);
    expect(fallos).toEqual([]);
  });

  it('falla con un Content-Type raro', () => {
    exigirTipo('sprite', respuesta({ 'content-type': 'application/octet-stream' }), ['image/webp']);
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toBe('sprite: Content-Type application/octet-stream, se esperaba image/webp');
  });

  it('falla si no hay Content-Type', () => {
    exigirTipo('manifest', respuesta({}), ['application/manifest+json']);
    expect(fallos[0]).toContain('(ninguno)');
  });

  it('no acepta un tipo parecido pero distinto', () => {
    exigirTipo('tarjeta social', respuesta({ 'content-type': 'image/jpg' }), ['image/jpeg']);
    expect(fallos).toHaveLength(1);
  });
});

describe('exigirCache', () => {
  it('acepta la caché corta de Pages', () => {
    exigirCache('index.html', respuesta({ 'cache-control': 'max-age=600' }), 3600);
    expect(fallos).toEqual([]);
  });

  it('falla con una caché immutable', () => {
    exigirCache('index.html', respuesta({ 'cache-control': 'public, max-age=31536000, immutable' }), 3600);
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain('immutable');
    expect(fallos[0]).toContain('dejaría el próximo despliegue sin verse');
  });

  it('falla si no hay Cache-Control', () => {
    exigirCache('sprite', respuesta({}), 3600);
    expect(fallos[0]).toBe('sprite: no envía Cache-Control');
  });

  it('falla si el max-age supera el tope aunque no sea immutable', () => {
    exigirCache('sprite', respuesta({ 'cache-control': 'public, max-age=86400' }), 3600);
    expect(fallos[0]).toBe('sprite: Cache-Control public, max-age=86400 caduca en más de 3600s');
  });

  it('acepta un max-age justo en el tope', () => {
    exigirCache('sprite', respuesta({ 'cache-control': 'max-age=3600' }), 3600);
    expect(fallos).toEqual([]);
  });
});
