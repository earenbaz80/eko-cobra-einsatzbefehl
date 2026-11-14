/**
 * Informe de fallo de la app: resume el estado de la partida en el momento del crash,
 * lo formatea para pegarlo en un issue y resuelve el enlace de recuperación al menú.
 *
 * Vive fuera del componente a propósito: el ErrorBoundary es la última pantalla que se
 * ve cuando algo se rompe, así que todo lo que decide lo que muestra es lógica pura y
 * se prueba sin navegador.
 */
import type { GameState, HudSnapshot } from '../game/types';

/** Nombre con el que App publica el último estado conocido para el ErrorBoundary. */
export const CLAVE_RESUMEN = '__ekoDiag';

export interface ResumenPartida {
  mision: string;
  estado: GameState;
  tick: number;
  segundos: number;
  sala: string;
  entidades: {
    escuadra: number;
    sospechosos: number;
    rehenes: number;
    total: number;
  };
}

export interface EntornoInforme {
  url: string;
  userAgent: string;
  marca: string;
  fecha: string;
}

const MISIONES: Record<HudSnapshot['missionMode'], string> = {
  APARTMENT: 'Misión 1: Piso Graz - Lend',
  STATION: 'Misión 2: Estación de Trenes (o 2B / Metro U3)',
  LINZ: 'Misión 3: Laboratorio Químico',
  TIROL: 'Misión 4: Chalet Alpino (Tirol)',
  SCHWECHAT: 'Misión 5: Aeropuerto Wien-Schwechat',
  TRAINING: 'Entrenamiento de Tiro CQB',
};

/** Resumen de la partida a partir del último HUD recibido y del contador del motor. */
export function construirResumen({ hud, gameState, ticks }: { hud: HudSnapshot | null; gameState: GameState; ticks: number }): ResumenPartida {
  const escuadra = hud?.squadVitals?.name ? 1 : 0;
  const sospechosos = hud?.suspectsTotal ?? 0;
  const rehenes = hud?.hostagesTotal ?? 0;
  return {
    mision: hud && gameState !== 'TITLE' ? MISIONES[hud.missionMode] : 'Sin partida (menú)',
    estado: gameState,
    tick: Math.max(0, Math.round(ticks)),
    segundos: Math.round(hud?.elapsedSeconds ?? 0),
    sala: hud?.currentRoom ?? '—',
    entidades: { escuadra, sospechosos, rehenes, total: escuadra + sospechosos + rehenes },
  };
}

/** Texto plano del informe, pensado para pegarse en un issue tal cual. */
export function formatearInforme({
  error,
  resumen,
  entorno,
  asegurados = { sospechosos: null, rehenes: null },
}: {
  error: { message: string; stack?: string };
  resumen: ResumenPartida | null;
  entorno: EntornoInforme;
  asegurados?: { sospechosos: number | null; rehenes: number | null };
}): string {
  const lineas = [
    'EKO COBRA · informe de fallo',
    `fecha: ${entorno.fecha}`,
    `build: ${entorno.marca}`,
    `url: ${entorno.url}`,
    `navegador: ${entorno.userAgent}`,
    resumen
      ? `partida: ${resumen.mision} · ${resumen.estado} · tick ${resumen.tick} · ${resumen.segundos} s · sala ${resumen.sala}`
      : 'partida: sin datos (el fallo ocurrió antes de arrancar la simulación)',
    resumen
      ? `entidades: ${resumen.entidades.total} (escuadra ${resumen.entidades.escuadra}, sospechosos ${resumen.entidades.sospechosos}${
          asegurados.sospechosos === null ? '' : ` con ${asegurados.sospechosos} asegurados`
        }, rehenes ${resumen.entidades.rehenes}${asegurados.rehenes === null ? '' : ` con ${asegurados.rehenes} asegurados`})`
      : 'entidades: sin datos',
    `error: ${error.message}`,
  ];
  if (error.stack) lineas.push('pila:', error.stack);
  return lineas.join('\n');
}

/** Enlace absoluto al menú, con la marca que App interpreta para no retomar la partida. */
export const enlaceAlMenu = (pathname: string) => `${pathname}?menu=1`;

/** ¿La URL pide abrir el menú? (`?menu=1`) */
export const quiereMenu = (search: string) => new URLSearchParams(search).get('menu') === '1';

/** Copia al portapapeles sin romper la pantalla de fallo; devuelve si lo consiguió. */
export async function copiarAlPortapapeles(texto: string, portapapeles: { writeText: (valor: string) => Promise<void> } | undefined): Promise<boolean> {
  if (!portapapeles) return false;
  try {
    await portapapeles.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Deja el resumen en el objeto global para que el ErrorBoundary lo lea al caer. */
export const publicarResumen = (resumen: ResumenPartida, destino: Record<string, unknown> = globalThis as unknown as Record<string, unknown>) => {
  destino[CLAVE_RESUMEN] = resumen;
};

/** Lee el resumen publicado, sin fiarse de lo que haya ahí. */
export function leerResumen(origen: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): ResumenPartida | null {
  const resumen = origen[CLAVE_RESUMEN] as Partial<ResumenPartida> | undefined;
  if (!resumen || typeof resumen !== 'object') return null;
  if (typeof resumen.mision !== 'string' || typeof resumen.tick !== 'number') return null;
  const entidades = resumen.entidades;
  if (!entidades || typeof entidades.total !== 'number') return null;
  return {
    mision: resumen.mision,
    estado: resumen.estado ?? 'PLAYING',
    tick: resumen.tick,
    segundos: typeof resumen.segundos === 'number' ? resumen.segundos : 0,
    sala: typeof resumen.sala === 'string' ? resumen.sala : '—',
    entidades: {
      escuadra: entidades.escuadra ?? 0,
      sospechosos: entidades.sospechosos ?? 0,
      rehenes: entidades.rehenes ?? 0,
      total: entidades.total,
    },
  };
}
