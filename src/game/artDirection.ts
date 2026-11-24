/**
 * Lenguaje visual compartido del juego.
 *
 * Cada token es un triplete RGB semántico: aliado, amenaza y advertencia.
 * Se compone con `rgba(...)` para intensidades variables y `rgb(...)` para
 * colores sólidos, sin duplicar hex y rgb por separado.
 *
 * Los tres salen de la paleta cerrada (`pixelArt/palette`), así el canvas y el
 * HUD hablan del mismo cian, rojo y ámbar.
 */

import { ACENTOS } from './pixelArt/palette';

function rgb(hex: string): string {
  const valor = hex.replace('#', '');
  const canal = (inicio: number) => parseInt(valor.slice(inicio, inicio + 2), 16);
  return `${canal(0)}, ${canal(2)}, ${canal(4)}`;
}

export const ART = {
  ally: rgb(ACENTOS.aliado),
  threat: rgb(ACENTOS.amenaza),
  warning: rgb(ACENTOS.advertencia),
} as const;
