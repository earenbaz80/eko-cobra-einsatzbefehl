/**
 * Assets muertos: todo lo que se publica tiene que estar nombrado desde el HTML, el
 * JS, el CSS o el manifest. Un archivo que solo vive en `dist/` viaja en cada
 * despliegue sin que nadie lo use (sprites viejos, imágenes que quedaron sin código,
 * restos de un escenario retirado) y es justo lo que nadie revisa a ojo.
 *
 * La comparación es por nombre de archivo y no por ruta porque cada fuente escribe la
 * referencia a su manera: el HTML con la base del sitio delante, el CSS relativo a su
 * carpeta y el JS desde el trozo que lo importa. Los nombres llevan hash de contenido,
 * así que el nombre basta para saber si algo se usa.
 */

/** El HTML de entrada se sirve por ser la entrada del sitio; nadie tiene que nombrarlo. */
export const EXENTOS = ['index.html'];

/** Archivos del build que pueden nombrar a otros archivos del build. */
export const esFuenteDeReferencias = (ruta) => /\.(html|js|mjs|css|webmanifest|json)$/i.test(ruta);

const nombreDe = (ruta) => ruta.split('/').pop().toLowerCase();

/**
 * Extensiones que se publican como archivo: si una fuente las nombra, el archivo debe existir.
 * Exige un nombre delante del punto: el runtime de Vite contiene la cadena `.css` suelta
 * (`pathname.endsWith('.css')`) y no es una referencia a ningún archivo del build.
 */
const EXTENSIONES = /[^./\\]\.(?:js|mjs|css|html|json|webmanifest|png|jpe?g|webp|svg|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|webm|wasm)$/i;

/** Referencias que no son del build: otros orígenes, datos embebidos o anclas. */
const EXTERNAS = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// Cadenas entrecomilladas (HTML, manifest y JS) y `url()` de CSS sin comillas.
const PATRONES = [/["'`]([^"'`]{1,300}?)["'`]/g, /url\(\s*([^)"'\s]+)\s*\)/g];

/** Referencias con pinta de archivo del build que aparecen en un texto. */
function referenciasDe(texto) {
  const encontradas = new Set();
  for (const patron of PATRONES) {
    for (const [coincidencia, bruta] of texto.matchAll(patron)) {
      const referencia = bruta.split(/[?#]/)[0].trim();
      if (!referencia || EXTERNAS.test(referencia)) continue;
      if (referencia.includes('${') || /\s/.test(referencia)) continue;
      if (!EXTENSIONES.test(referencia)) continue;
      encontradas.add(referencia);
    }
  }
  return [...encontradas];
}

/**
 * Archivos de `archivos` (rutas relativas del build) que no aparecen en ninguno de los
 * `textos` fuente. Devuelve las rutas ordenadas para que el informe sea estable.
 */
export function assetsHuerfanos(archivos, textos, exentos = EXENTOS) {
  const exceptuados = new Set(exentos.map((ruta) => ruta.toLowerCase()));
  const fuentes = textos.join('\n').toLowerCase();
  return archivos
    .filter((ruta) => !exceptuados.has(ruta.toLowerCase()) && !fuentes.includes(nombreDe(ruta)))
    .sort();
}

/**
 * La dirección contraria: referencias del HTML, el JS, el CSS o el manifest que nombran
 * un archivo que no está en el build (un icono renombrado, un chunk que dejó de emitirse,
 * una imagen borrada a mano). Sin esto, ese enlace solo se nota con un 404 en producción.
 *
 * `fuentes` son `{ ruta, texto }` para poder decir en qué archivo está la referencia rota.
 */
export function referenciasRotas(archivos, fuentes) {
  const existentes = new Set(archivos.map((ruta) => nombreDe(ruta)));
  const vistas = new Set();
  const rotas = [];
  for (const { ruta, texto } of fuentes) {
    for (const referencia of referenciasDe(texto)) {
      if (existentes.has(nombreDe(referencia))) continue;
      const clave = `${ruta}\u0000${referencia}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      rotas.push({ fuente: ruta, referencia });
    }
  }
  return rotas.sort((a, b) => a.fuente.localeCompare(b.fuente) || a.referencia.localeCompare(b.referencia));
}
