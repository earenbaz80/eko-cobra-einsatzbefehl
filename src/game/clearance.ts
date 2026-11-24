/**
 * ESTADO DE DESPEJE POR ESTANCIA — dato derivado para el HUD y el EKO-Pad.
 *
 * No es simulación: no dispara eventos, no puntúa y no toca la IA. Se calcula en
 * cada snapshot a partir de lo que el motor ya sabe (dónde está el binomio, qué
 * contactos conoce el jugador y qué estancias marca el mapa como aseguradas) más
 * una memoria de lo ya despejado, para que una sala no vuelva a «no vista» al
 * salir de ella.
 *
 * Reglas, en orden:
 *   1. Con hostiles conocidos dentro → EN CONTACTO. La sala deja de contar como
 *      despejada: el objetivo vuelve a abrirse hasta que se resuelva.
 *   2. Con el binomio dentro, asegurada por el mapa o ya despejada antes →
 *      DESPEJADA (y queda en la memoria).
 *   3. En cualquier otro caso → NO VISTA, es decir, pendiente.
 *
 * «Hostiles conocidos» es sólo intel del jugador (visión, PiP o radio): un
 * sospechoso oculto no convierte la sala en contacto ni delata que está ahí.
 */

export type EstadoDespeje = 'SIN_VISTA' | 'EN_CONTACTO' | 'DESPEJADA';

/** Etiqueta corta que comparten el HUD y el EKO-Pad. */
export const ETIQUETA_DESPEJE: Record<EstadoDespeje, string> = {
  SIN_VISTA: 'NO VISTA',
  EN_CONTACTO: 'EN CONTACTO',
  DESPEJADA: 'DESPEJADA',
};

/** Entrada mínima de una estancia; la arma el motor desde su snapshot. */
export interface SalaDespejeEntrada {
  readonly id: string;
  readonly nameDe: string;
  readonly nameEs: string;
  /** El mapa la marca como asegurada (punto de inserción ya controlado). */
  readonly asegurada: boolean;
  /** El operador o Kobra-2 están dentro. */
  readonly ocupada: boolean;
  /** Hostiles de los que el jugador tiene intel en esta estancia. */
  readonly hostilesConocidos: number;
}

export interface SalaDespeje {
  readonly id: string;
  readonly nameDe: string;
  readonly nameEs: string;
  readonly estado: EstadoDespeje;
}

export interface DespejeOperacion {
  readonly salas: readonly SalaDespeje[];
  readonly total: number;
  readonly despejadas: number;
  readonly enContacto: number;
  readonly sinVista: number;
  /** 0..100, redondeado, para la barra del objetivo. */
  readonly progresoPct: number;
  /** Primera estancia que no está despejada; null si ya están todas. */
  readonly siguiente: SalaDespeje | null;
  /** Primera estancia con contacto activo; null si no hay ninguno. */
  readonly contacto: SalaDespeje | null;
}

/**
 * Calcula el estado de cada estancia y actualiza `memoria` con las despejadas.
 * La memoria se pasa por referencia a propósito: es del motor y se limpia al
 * cargar un layout nuevo, no de este cálculo.
 */
export function calcularDespeje(
  salas: readonly SalaDespejeEntrada[],
  memoria: Set<string> = new Set<string>()
): DespejeOperacion {
  const resultado: SalaDespeje[] = [];
  let despejadas = 0;
  let enContacto = 0;
  let sinVista = 0;

  for (const sala of salas) {
    let estado: EstadoDespeje;
    if (sala.hostilesConocidos > 0) {
      memoria.delete(sala.id);
      estado = 'EN_CONTACTO';
      enContacto++;
    } else if (sala.asegurada || sala.ocupada || memoria.has(sala.id)) {
      memoria.add(sala.id);
      estado = 'DESPEJADA';
      despejadas++;
    } else {
      estado = 'SIN_VISTA';
      sinVista++;
    }
    resultado.push({
      id: sala.id,
      nameDe: sala.nameDe,
      nameEs: sala.nameEs,
      estado,
    });
  }

  const total = resultado.length;
  const siguiente = resultado.find((sala) => sala.estado !== 'DESPEJADA') ?? null;
  const contacto = resultado.find((sala) => sala.estado === 'EN_CONTACTO') ?? null;

  return {
    salas: resultado,
    total,
    despejadas,
    enContacto,
    sinVista,
    progresoPct: total > 0 ? Math.round((despejadas / total) * 100) : 0,
    siguiente,
    contacto,
  };
}
