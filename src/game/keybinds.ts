/** Teclas por defecto del motor y de la pantalla de remapeo. */
export const DEFAULT_KEYBINDS: Readonly<Record<string, string>> = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  policeShout: 'Space',
  interact: 'KeyE',
  breachKick: 'KeyF',
  breachC4: 'KeyC',
  breachRam: 'KeyX',
  inspect: 'KeyQ',
  gadget: 'KeyG',
  toolTaser: 'KeyT',
  flashlight: 'KeyL',
  ifak: 'KeyH',
  aimZone: 'KeyV',
  stance: 'KeyZ',
  thermalPalette: 'KeyK',
  biometric: 'KeyB',
  interrogate: 'KeyI',
  reload: 'KeyR',
  squad1: 'Digit1',
  squad2: 'Digit2',
  squad3: 'Digit3',
  squad4: 'Digit4',
  squad5: 'Digit5',
  squad6: 'Digit6',
  squad7: 'Digit7',
  squad8: 'Digit8',
};

/** Acciones que el motor acepta al remapear. */
export const KEYBIND_ACTIONS: ReadonlySet<string> = new Set(Object.keys(DEFAULT_KEYBINDS));

const CODIGO_VALIDO = /^[A-Za-z0-9]+$/;

/**
 * Normaliza lo que haya en `localStorage`: descarta acciones y valores desconocidos,
 * y rellena con el default cada acción que falte o sea inválida.
 */
export function sanitizeKeybinds(raw: unknown): Record<string, string> {
  let datos: unknown = raw;
  if (typeof raw === 'string') {
    try {
      datos = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_KEYBINDS };
    }
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { ...DEFAULT_KEYBINDS };

  const guardados = datos as Record<string, unknown>;
  const limpios: Record<string, string> = {};
  for (const accion of KEYBIND_ACTIONS) {
    const valor = guardados[accion];
    limpios[accion] = typeof valor === 'string' && CODIGO_VALIDO.test(valor) ? valor : DEFAULT_KEYBINDS[accion];
  }
  return limpios;
}

/** Códigos de tecla asignados a más de una acción, ordenados. */
export function conflictosDeKeybinds(keybinds: Record<string, string>): string[] {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();
  for (const codigo of Object.values(keybinds)) {
    if (vistos.has(codigo)) duplicados.add(codigo);
    else vistos.add(codigo);
  }
  return [...duplicados].sort();
}
