import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { imageSize, listarArchivos } from './archivos.mjs';

/** PNG mínimo: firma de 8 bytes y dimensiones en la cabecera IHDR (offsets 16 y 20). */
const png = (width, height) => {
  const buffer = Buffer.alloc(26);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

/** JPEG mínimo: SOI y un SOF0 con la altura y la anchura donde las busca el lector. */
const jpeg = (width, height) => {
  const buffer = Buffer.alloc(16);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(0x0011, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
};

describe('listarArchivos', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'eko-archivos-'));
  mkdirSync(join(raiz, 'assets', 'aistudio'), { recursive: true });
  writeFileSync(join(raiz, 'index.html'), '<html></html>');
  writeFileSync(join(raiz, 'assets', 'index-abc.js'), '');
  writeFileSync(join(raiz, 'assets', 'aistudio', 'operador.webp'), '');
  afterAll(() => rmSync(raiz, { recursive: true, force: true }));

  it('lista todo con rutas relativas y separadores /', () => {
    expect(listarArchivos(raiz).sort()).toEqual(['assets/aistudio/operador.webp', 'assets/index-abc.js', 'index.html']);
  });

  it('antepone el prefijo que se le pase', () => {
    expect(listarArchivos(join(raiz, 'assets')).sort()).toEqual(['aistudio/operador.webp', 'index-abc.js']);
  });
});

describe('imageSize', () => {
  it('lee las dimensiones de un PNG', () => {
    expect(imageSize(png(1200, 630))).toEqual({ width: 1200, height: 630, tipo: 'png' });
  });

  it('lee las dimensiones de un JPEG', () => {
    expect(imageSize(jpeg(192, 192))).toEqual({ width: 192, height: 192, tipo: 'jpeg' });
  });

  it('devuelve null si no reconoce el formato', () => {
    expect(imageSize(Buffer.from('no soy una imagen'))).toBe(null);
  });

  it('devuelve null con un PNG truncado', () => {
    expect(imageSize(png(1200, 630).subarray(0, 12))).toBe(null);
  });

  it('no intenta medir WebP: para eso están las comprobaciones de Content-Type', () => {
    const webp = Buffer.alloc(32);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');
    expect(imageSize(webp)).toBe(null);
  });
});
