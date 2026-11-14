/** utilidades de lectura de archivos y de cabeceras de imagen. */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Ancho y alto de un PNG o JPEG a partir de sus cabeceras. */
export const imageSize = (buffer) => {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), tipo: 'png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marcador = buffer[offset + 1];
      if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), tipo: 'jpeg' };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
};

/** Suma recursiva del tamaño de dist/, para vigilar el peso total publicado. */
export const pesoDirectorio = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((total, entrada) => {
    const ruta = join(dir, entrada.name);
    return total + (entrada.isDirectory() ? pesoDirectorio(ruta) : statSync(ruta).size);
  }, 0);
