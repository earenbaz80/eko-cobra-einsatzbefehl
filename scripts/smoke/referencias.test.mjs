import { describe, expect, it } from 'vitest';
import { assetsHuerfanos, esFuenteDeReferencias } from './referencias.mjs';

const html =
  '<link rel="stylesheet" href="/eko-cobra-einsatzbefehl/assets/index-DAeinCnT.css" />' +
  '<script type="module" src="/eko-cobra-einsatzbefehl/assets/index-ChfuXwfe.js"></script>' +
  '<link rel="manifest" href="./manifest.webmanifest" />';
const css = '.mapa{background:url(/eko-cobra-einsatzbefehl/assets/asphalt_dark_cracks.svg)}';
const js = 'const sprite = "assets/aistudio/operador-8dir.webp"; import("./assets/Metro-U3-abc123.js");';
const manifest = '{ "icons": [{ "src": "./icon-192.png" }] }';

const build = [
  'index.html',
  'assets/index-ChfuXwfe.js',
  'assets/index-DAeinCnT.css',
  'assets/Metro-U3-abc123.js',
  'assets/aistudio/operador-8dir.webp',
  'assets/asphalt_dark_cracks.svg',
  'manifest.webmanifest',
  'icon-192.png',
  'social-card.jpg',
];

describe('assetsHuerfanos', () => {
  it('no marca nada cuando todo está referenciado', () => {
    const textos = [html, css, js, manifest, 'const tarjeta = "social-card.jpg";'];
    expect(assetsHuerfanos(build, textos)).toEqual([]);
  });

  it('detecta el asset que no nombra ninguna fuente', () => {
    const textos = [html, css, js, manifest];
    expect(assetsHuerfanos(build, textos)).toEqual(['social-card.jpg']);
  });

  it('detecta restos de escenarios retirados en subcarpetas', () => {
    const archivos = [...build, 'assets/aistudio/graz-viejo.webp', 'assets/aistudio/graz-viejo.webp.map'];
    const textos = [html, css, js, manifest, '"social-card.jpg"'];
    expect(assetsHuerfanos(archivos, textos)).toEqual(['assets/aistudio/graz-viejo.webp', 'assets/aistudio/graz-viejo.webp.map']);
  });

  it('no exige que nadie nombre el HTML de entrada', () => {
    expect(assetsHuerfanos(['index.html'], [])).toEqual([]);
  });

  it('ignora mayúsculas del nombre y de la referencia', () => {
    expect(assetsHuerfanos(['assets/Operador-8DIR.webp'], ['"assets/aistudio/operador-8dir.webp"'])).toEqual([]);
  });

  it('ordena el resultado para que el informe no cambie de una pasada a otra', () => {
    expect(assetsHuerfanos(['z.webp', 'a.webp', 'm.webp'], [])).toEqual(['a.webp', 'm.webp', 'z.webp']);
  });

  it('admite exenciones propias', () => {
    expect(assetsHuerfanos(['robots.txt'], [], ['index.html', 'robots.txt'])).toEqual([]);
  });
});

describe('esFuenteDeReferencias', () => {
  it('acepta HTML, JS, CSS, manifest y JSON', () => {
    for (const ruta of ['index.html', 'assets/index-abc.js', 'orquestador.mjs', 'assets/index.css', 'manifest.webmanifest', 'datos.json']) {
      expect(esFuenteDeReferencias(ruta), ruta).toBe(true);
    }
  });

  it('no trata imágenes, fuentes ni vídeos como fuentes de referencias', () => {
    for (const ruta of ['social-card.jpg', 'assets/aistudio/operador-8dir.webp', 'icon-192.png', 'fuente.woff2', 'clip.mp4']) {
      expect(esFuenteDeReferencias(ruta), ruta).toBe(false);
    }
  });
});
