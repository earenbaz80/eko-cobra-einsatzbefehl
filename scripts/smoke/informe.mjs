/**
 * Informe compartido: todas las comprobaciones apuntan aquí sus fallos y los
 * helpers de cabeceras (Content-Type y caché) que solo tienen sentido en remoto.
 */

/** Fallos acumulados; el orquestador los imprime y decide el código de salida. */
export const fallos = [];

export const fail = (mensaje) => fallos.push(mensaje);

export const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Content-Type sin charset y en minúsculas ("application/javascript; charset=utf-8"). */
const tipoDe = (respuesta) => (respuesta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

export const exigirTipo = (etiqueta, respuesta, esperados) => {
  const cabecera = respuesta.headers.get('content-type') ?? '';
  if (!esperados.includes(tipoDe(respuesta))) {
    fail(`${etiqueta}: Content-Type ${cabecera || '(ninguno)'}, se esperaba ${esperados.join(' o ')}`);
  } else console.log(`${etiqueta}: ${tipoDe(respuesta)}`);
};

export const exigirCache = (etiqueta, respuesta, maximoSegundos) => {
  const cache = respuesta.headers.get('cache-control') ?? '';
  const maxAge = Number(cache.match(/max-age=(\d+)/)?.[1] ?? NaN);
  if (!cache) fail(`${etiqueta}: no envía Cache-Control`);
  else if (/immutable/i.test(cache)) fail(`${etiqueta}: Cache-Control ${cache} dejaría el próximo despliegue sin verse hasta caducar`);
  else if (Number.isFinite(maxAge) && maxAge > maximoSegundos) fail(`${etiqueta}: Cache-Control ${cache} caduca en más de ${maximoSegundos}s`);
  else console.log(`caché ${etiqueta}: ${cache}`);
};
