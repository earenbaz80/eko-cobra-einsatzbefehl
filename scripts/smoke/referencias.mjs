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
