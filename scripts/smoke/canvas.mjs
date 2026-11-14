/** Lecturas del canvas: si se pinta algo y si la escena se mueve. */

/** Estadísticas de color del canvas: 8 tonos o un 5 % de píxeles visibles ya lo salvan. */
export const estadisticasCanvas = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('canvas');
    if (!el) return null;
    const ctx = el.getContext('2d');
    if (!ctx) return { error: 'sin contexto 2d' };
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    const tonos = new Set();
    let visibles = 0;
    let muestras = 0;
    for (let i = 0; i < data.length; i += 4 * 13) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      tonos.add(`${r >> 4},${g >> 4},${b >> 4}`);
      if (r + g + b > 30) visibles++;
      muestras++;
    }
    return { width: el.width, height: el.height, tonos: tonos.size, visibles, muestras };
  });

/** Firma de 32x32 luminancias del canvas: sirve para ver si la escena se mueve. */
export const firmaCanvas = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return null;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    const celdas = 32;
    const firma = [];
    for (let cy = 0; cy < celdas; cy += 1) {
      for (let cx = 0; cx < celdas; cx += 1) {
        const x = Math.floor(((cx + 0.5) / celdas) * el.width);
        const y = Math.floor(((cy + 0.5) / celdas) * el.height);
        const i = (y * el.width + x) * 4;
        firma.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
    }
    return firma;
  });

/** Porcentaje de celdas cuya luminancia cambia más de `umbral` niveles. */
export const cambioEntreFirmas = (a, b, umbral = 12) => {
  if (!a || !b || a.length !== b.length) return 1;
  let distintas = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > umbral) distintas += 1;
  return distintas / a.length;
};
