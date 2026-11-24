/**
 * Paleta cerrada del arte de píxeles.
 *
 * Cada familia es una rampa de pasos (sombra → base → luz → brillo), y el
 * volumen de un sprite se resuelve moviéndose dentro de su propia rampa: nunca
 * se mezcla un tono que no esté aquí. Así el operador, el binomio, los suelos,
 * los muros y el mobiliario comparten una misma luz.
 *
 * Reglas del catálogo:
 * 1. `PINCELES_OPERADOR` y `PINCELES_ESCENA` son rampas: se usan por paso.
 * 2. `TINTES` son colores con un único papel (un LED, una tapa, una veta).
 * 3. Ningún color se escribe en `tiles.ts` ni en `scene.ts`: se lee de acá.
 * 4. Las veladuras (`rgba(...)`) son composición y van en el pase, no acá.
 */

export interface Pincel {
  readonly sombra: string;
  readonly base: string;
  readonly luz: string;
}

export interface Rampa extends Pincel {
  /** Paso más alto de la rampa: reflejos, cantos y nieve acumulada. */
  readonly brillo: string;
}

const pincel = (sombra: string, base: string, luz: string): Pincel => ({ sombra, base, luz });
const rampa = (sombra: string, base: string, luz: string, brillo: string): Rampa => ({
  sombra,
  base,
  luz,
  brillo,
});

/** Silueta de un píxel: sin rampa, el borde no se aclara ni se oscurece. */
export const CONTORNO = '#05080D';

/** Acentos semánticos compartidos por canvas, HUD y modales. */
export const ACENTOS = {
  aliado: '#38BDF8',
  amenaza: '#EF4444',
  advertencia: '#F59E0B',
} as const;

export const PINCELES_OPERADOR = {
  contorno: pincel(CONTORNO, CONTORNO, CONTORNO),
  // Sobre suelos de #181E25-#2A3441 el uniforme necesita un paso más de luz:
  // con los tonos anteriores el cuerpo se hundía en la oscuridad del salón.
  uniforme: pincel('#232C3A', '#33404F', '#54657A'),
  chaleco: pincel('#101822', '#1A2431', '#293747'),
  casco: pincel('#242E3C', '#36455A', '#566B85'),
  equipo: pincel('#141C26', '#202B38', '#334255'),
  pantalon: pincel('#1B222C', '#28323F', '#3A4657'),
  bota: pincel('#151C24', '#212B36', '#33404F'),
  guante: pincel('#141B23', '#202A36', '#31404F'),
  arma: pincel('#1B2027', '#2C333C', '#48525F'),
  acero: pincel('#5C6878', '#8794A5', '#C3CEDA'),
  parcheJugador: pincel('#075985', '#0284C7', '#7DD3FC'),
  parcheBinomio: pincel('#155E75', '#0891B2', '#67E8F9'),
  opticaCalma: pincel('#075985', '#38BDF8', '#BAE6FD'),
  opticaLista: pincel('#047857', '#10B981', '#A7F3D0'),
  opticaCombate: pincel('#B45309', '#F59E0B', '#FDE68A'),
  escudo: pincel('#141C26', '#202B38', '#37465A'),
  visor: pincel('#7DD3FC', '#DBEAFE', '#FFFFFF'),
} as const satisfies Record<string, Pincel>;

export type ClavePincel = keyof typeof PINCELES_OPERADOR;

/**
 * Rampas de la escena cenital. El muro tiene dos familias: el cuerpo (ladrillo
 * visto desde arriba) y el canto, que es el caparazón iluminado del borde.
 */
export const PINCELES_ESCENA = {
  nieve: rampa('#8FA3B6', '#9FB2C4', '#C2D2E2', '#DBE7F2'),
  madera: rampa('#2B1D13', '#4E3826', '#63492F', '#5A4029'),
  piedra: rampa('#1D2531', '#2A3441', '#33404F', '#3D4B5A'),
  muro: rampa('#1A2029', '#2C3540', '#39434F', '#46525F'),
  muroCanto: rampa('#0E141B', '#4B5865', '#5A6878', '#6E7C8D'),
  cuero: rampa('#3A1410', '#5E241C', '#6E2C22', '#8A3B2C'),
  metal: rampa('#20262E', '#2E3742', '#3E4A57', '#55636F'),
  cama: rampa('#8F95A1', '#AEB4BF', '#C9CDD6', '#E4E8EE'),
  asfalto: rampa('#0E1318', '#181E25', '#1F262E', '#262E37'),
  hormigon: rampa('#262D35', '#2F3741', '#3A434E', '#454F5B'),
  baldosa: rampa('#2A323C', '#3C4652', '#48535F', '#555F6C'),
  fuego: rampa('#7C2D12', '#B45309', '#F59E0B', '#FDE68A'),
  puerta: rampa('#2A1810', '#3B2418', '#5A3A24', '#8B5A34'),
  alfombra: rampa('#3B0E19', '#52182A', '#6A1F2E', '#7A2436'),
  horno: rampa('#0A0806', '#1A1512', '#2A2320', '#4B5865'),
  tanque: rampa('#2A1208', '#8A3B1F', '#B46046', '#FFB478'),
  planta: rampa('#1E2A1A', '#2F3A2A', '#3E5140', '#54704A'),
  c4: rampa('#7F1D1D', '#D9A21B', '#F2C14E', '#FCA5A5'),
  papel: rampa('#CBD5E1', '#E2E8F0', '#F1F5F9', '#FFFFFF'),
  cristal: rampa('#0A1018', '#8194A8', '#7DD3FC', '#E2F0FF'),
} as const satisfies Record<string, Rampa>;

export type ClaveEscena = keyof typeof PINCELES_ESCENA;

/** Tintes con un solo papel; no forman rampa con nadie. */
export const TINTES = {
  sueloNieve: '#A9B8C8', // base opaca del piso de nieve
  sueloVacio: '#1B2430', // relleno fuera de cualquier sala
  maderaVeta: '#3E2B1C', // nudo entre tablas
  cueroRespaldo: '#4A1A14', // sombra del respaldo del sofá
  ascuas: '#DC2626', // brasa dentro del fuego
  puertaBrecha: '#4A2E1C', // hoja astillada
  puertaAstilla: '#7A522E', // astilla iluminada
  c4Cuerpo: '#0B1220', // estuche y hollín profundo
  pizarra: '#1E293B', // contenedor, placa y barra
  pizarraAlta: '#334155', // canto de la pizarra
  gris: '#64748B', // piezas neutras
  acero: '#94A3B8', // acero de HUD y herrajes
  aceroClaro: '#C7D2DE', // tapa del tanque
  metalContorno: '#0F151B', // canto del metal
  brasa: '#92400E', // brasa apagada del suelo
  camaMarco: '#2A1B11', // marco de madera de la cama
  cajaA: '#5B4A38', // bulto sobre estante
  cajaB: '#37505E', // bulto metálico
  electrodomestico: '#14181D', // tambor de lavadora
  ledVerde: '#4ADE80', // piloto encendido
  maceta: '#6B4A2E', // maceta de la planta
} as const;

const COLORS = Object.values(PINCELES_OPERADOR).flatMap((paso) => [paso.sombra, paso.base, paso.luz]);
const COLORS_ESCENA = Object.values(PINCELES_ESCENA).flatMap((paso) => [
  paso.sombra,
  paso.base,
  paso.luz,
  paso.brillo,
]);

/** Todos los colores permitidos, sin repetir: lo que las pruebas vigilan. */
export const COLORES_PALETA: ReadonlySet<string> = new Set([
  ...COLORS,
  ...COLORS_ESCENA,
  ...Object.values(TINTES),
  ACENTOS.aliado,
  ACENTOS.amenaza,
  ACENTOS.advertencia,
  CONTORNO,
]);
