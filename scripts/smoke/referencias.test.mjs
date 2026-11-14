import { describe, expect, it } from 'vitest';
import { assetsHuerfanos, esFuenteDeReferencias, referenciasRotas } from './referencias.mjs';

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

const fuentes = () => [
  { ruta: 'index.html', texto: html },
  { ruta: 'assets/index-DAeinCnT.css', texto: css },
  { ruta: 'assets/index-ChfuXwfe.js', texto: js },
  { ruta: 'manifest.webmanifest', texto: manifest },
];

describe('referenciasRotas', () => {
  it('no marca nada cuando todas las referencias existen', () => {
    expect(referenciasRotas(build, fuentes())).toEqual([]);
  });

  it('detecta un chunk que ya no se emite, y dice en qué archivo está', () => {
    const rotas = fuentes().map((fuente) =>
      fuente.ruta === 'assets/index-ChfuXwfe.js' ? { ...fuente, texto: 'import("./assets/Viejo-modal-abc123.js");' } : fuente
    );
    expect(referenciasRotas(build, rotas)).toEqual([{ fuente: 'assets/index-ChfuXwfe.js', referencia: './assets/Viejo-modal-abc123.js' }]);
  });

  it('detecta un icono del manifest que falta', () => {
    const roto = fuentes().map((fuente) =>
      fuente.ruta === 'manifest.webmanifest' ? { ...fuente, texto: '{ "icons": [{ "src": "./icon-512-viejo.png" }] }' } : fuente
    );
    expect(referenciasRotas(build, roto)).toEqual([{ fuente: 'manifest.webmanifest', referencia: './icon-512-viejo.png' }]);
  });

  it('detecta un url() de CSS que falta', () => {
    const roto = fuentes().map((fuente) =>
      fuente.ruta === 'assets/index-DAeinCnT.css' ? { ...fuente, texto: '.mapa{background:url(assets/asfalto-que-ya-no-esta.svg)}' } : fuente
    );
    expect(referenciasRotas(build, roto)).toEqual([{ fuente: 'assets/index-DAeinCnT.css', referencia: 'assets/asfalto-que-ya-no-esta.svg' }]);
  });

  it('encuentra la referencia aunque lleve la base del sitio delante', () => {
    expect(referenciasRotas(build, [{ ruta: 'index.html', texto: '<script src="/eko-cobra-einsatzbefehl/assets/NoExiste-1.js"></script>' }])).toEqual([
      { fuente: 'index.html', referencia: '/eko-cobra-einsatzbefehl/assets/NoExiste-1.js' },
    ]);
  });

  it('ignora orígenes externos, datos embebidos y anclas', () => {
    const texto = [
      '<link href="https://fonts.googleapis.com/css2?family=Rajdhani" rel="stylesheet" />',
      '<meta property="og:image" content="https://earenbaz80.github.io/eko-cobra-einsatzbefehl/social-card.jpg" />',
      '<img src="data:image/png;base64,AAA" />',
      '<a href="#seccion">ir</a>',
      '<a href="//ejemplo.com/foto.png">fuera</a>',
    ].join('\n');
    expect(referenciasRotas(build, [{ ruta: 'index.html', texto }])).toEqual([]);
  });

  it('ignora cadenas que no parecen un archivo del build', () => {
    expect(referenciasRotas(build, [{ ruta: 'assets/index-ChfuXwfe.js', texto: 'const aviso = "vamos allá"; const v = "1.2.3";' }])).toEqual([]);
  });

  it('ignora plantillas de JS con interpolación', () => {
    expect(referenciasRotas(build, [{ ruta: 'assets/index-ChfuXwfe.js', texto: 'import(`./assets/${nombre}.js`)' }])).toEqual([]);
  });

  it('acepta query y hash en la referencia', () => {
    expect(referenciasRotas(build, [{ ruta: 'index.html', texto: '<link href="./icon-192.png?v=2#top" />' }])).toEqual([]);
  });

  it('no repite la misma referencia en el mismo archivo', () => {
    const texto = '<img src="./no-esta.png"><img src="./no-esta.png">';
    expect(referenciasRotas(build, [{ ruta: 'index.html', texto }])).toHaveLength(1);
  });

  it('ordena por archivo y referencia', () => {
    const rotas = referenciasRotas(build, [
      { ruta: 'index.html', texto: '"./z.png" "./a.png"' },
      { ruta: 'manifest.webmanifest', texto: '"./m.png"' },
    ]);
    expect(rotas.map((rota) => rota.referencia)).toEqual(['./a.png', './z.png', './m.png']);
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
