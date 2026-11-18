/**
 * Presentación del buffer de arte en el canvas de pantalla.
 *
 * `BUFFER_W`x`BUFFER_H` es el tamaño interno del arte. `present` escala el buffer
 * con nearest-neighbor y lo centra, sin decidir la escala: esa política queda en
 * quien llama. La viñeta y el grano se pintan a resolución de pantalla: dentro
 * del buffer el reescalado los convertiría en bloques de arte.
 */

import { hash2 } from './bitmap';

// 640x360: el encaje entero cae en ×2 sobre los paneles 16:9 habituales
// (1280x800 deja 40 px de banda arriba y abajo) y muestra 640x360 unidades de
// mundo, 1,78x el área de 480x270, con el actor en 96 px de pantalla en vez de 144.
export const BUFFER_W = 640;
export const BUFFER_H = 360;

export function present(
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scale: number,
  label: string,
  time: number
) {
  const canvas = target.canvas;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.imageSmoothingEnabled = false;
  target.fillStyle = '#000';
  target.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = source.width * scale;
  const drawH = source.height * scale;
  const ox = Math.floor((canvas.width - drawW) / 2);
  const oy = Math.floor((canvas.height - drawH) / 2);
  target.drawImage(source, ox, oy, drawW, drawH);

  // Viñeta y grano a resolución de pantalla: dentro del buffer de 640x360 el
  // reescalado los convertiría en bloques de arte.
  target.save();
  target.beginPath();
  target.rect(ox, oy, drawW, drawH);
  target.clip();

  const cx = ox + drawW * 0.5;
  const cy = oy + drawH * 0.5;
  const vignette = target.createRadialGradient(
    cx,
    cy,
    Math.min(drawW, drawH) * 0.28,
    cx,
    cy,
    Math.max(drawW, drawH) * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(2, 5, 12, 0.55)');
  target.fillStyle = vignette;
  target.fillRect(ox, oy, drawW, drawH);

  // Grano de 1 píxel real, con la densidad por área del pase anterior
  target.globalAlpha = 0.05;
  target.fillStyle = '#93A4B8';
  const seed = Math.floor(time * 14) % 97;
  const grain = Math.min(4200, Math.round((drawW * drawH) / 520));
  for (let i = 0; i < grain; i++) {
    const rx = ox + hash2(i * 3.1 + seed, seed * 1.7) * drawW;
    const ry = oy + hash2(seed * 2.3, i * 5.7) * drawH;
    target.fillRect(Math.floor(rx), Math.floor(ry), 1, 1);
  }
  target.restore();

  target.font = '600 11px "JetBrains Mono", monospace';
  target.fillStyle = 'rgba(148, 163, 184, 0.85)';
  target.textAlign = 'left';
  target.textBaseline = 'bottom';
  // El arte puede desbordar y recortarse: la etiqueta se mantiene en el panel.
  const labelX = Math.max(8, ox + 8);
  const labelY = Math.min(canvas.height - 6, Math.max(14, oy + drawH - 6));
  target.fillText(label, labelX, labelY);
  target.restore();
}
