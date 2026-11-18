/**
 * Lenguaje visual compartido del juego.
 *
 * Cada token es un triplete RGB semántico: aliado, amenaza y advertencia.
 * Se compone con `rgba(...)` para intensidades variables y `rgb(...)` para
 * colores sólidos, sin duplicar hex y rgb por separado.
 */
export const ART = {
  ally: '56, 189, 248',
  threat: '239, 68, 68',
  warning: '245, 158, 11',
} as const;
