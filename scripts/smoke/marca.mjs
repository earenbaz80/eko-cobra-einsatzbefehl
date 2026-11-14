/**
 * Marca de build: el `<meta name="eko-build">` que Vite mete en `index.html` con el
 * SHA del commit. El modo remoto lo compara con el commit que se espera servir para
 * no dar por bueno un HTML cacheado del despliegue anterior.
 */

export const NOMBRE_MARCA = 'eko-build';

// Los dos órdenes posibles de atributos: el build escribe name antes de content,
// pero un HTML reescrito por otra herramienta puede venir al revés.
const PATRONES = [
  new RegExp(`<meta[^>]+name=["']${NOMBRE_MARCA}["'][^>]+content=["']([^"']+)["']`, 'i'),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${NOMBRE_MARCA}["']`, 'i'),
];

/** SHA de la marca, o null si el HTML no la trae. */
export const leerMarca = (html) => {
  for (const patron of PATRONES) {
    const sha = patron.exec(html)?.[1]?.trim().toLowerCase();
    if (sha) return sha;
  }
  return null;
};

/** ¿El HTML servido es del commit esperado? Sin SHA esperado no se puede afirmar nada. */
export const coincideMarca = (html, shaEsperado) => {
  const esperado = (shaEsperado ?? '').trim().toLowerCase();
  return esperado.length > 0 && leerMarca(html) === esperado;
};
