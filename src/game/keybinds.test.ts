import { describe, expect, it } from 'vitest';
import { conflictosDeKeybinds, DEFAULT_KEYBINDS, KEYBIND_ACTIONS, sanitizeKeybinds } from './keybinds';

describe('sanitizeKeybinds', () => {
  it('devuelve las teclas por defecto con un valor ilegible', () => {
    expect(sanitizeKeybinds('{no json')).toEqual(DEFAULT_KEYBINDS);
    expect(sanitizeKeybinds(null)).toEqual(DEFAULT_KEYBINDS);
    expect(sanitizeKeybinds([])).toEqual(DEFAULT_KEYBINDS);
  });

  it('acepta un mapa válido completo', () => {
    const personalizado = { ...DEFAULT_KEYBINDS, moveForward: 'ArrowUp', reload: 'KeyR' };
    expect(sanitizeKeybinds(JSON.stringify(personalizado))).toEqual(personalizado);
  });

  it('ignora acciones inventadas y valores que no son códigos', () => {
    const limpio = sanitizeKeybinds({
      moveForward: 'ArrowUp',
      teletransporte: 'KeyT',
      reload: 42,
      ifak: '',
      interact: 'Key E',
    });
    expect(limpio.moveForward).toBe('ArrowUp');
    expect(limpio).not.toHaveProperty('teletransporte');
    expect(limpio.reload).toBe(DEFAULT_KEYBINDS.reload);
    expect(limpio.ifak).toBe(DEFAULT_KEYBINDS.ifak);
    expect(limpio.interact).toBe(DEFAULT_KEYBINDS.interact);
  });

  it('rellena las acciones que falten con su tecla por defecto', () => {
    const limpio = sanitizeKeybinds({ moveForward: 'ArrowUp' });
    expect(Object.keys(limpio).sort()).toEqual([...KEYBIND_ACTIONS].sort());
    expect(limpio.policeShout).toBe('Space');
  });
});

describe('conflictosDeKeybinds', () => {
  it('no encuentra conflictos en el mapa por defecto', () => {
    expect(conflictosDeKeybinds(DEFAULT_KEYBINDS)).toEqual([]);
  });

  it('detecta dos acciones con la misma tecla', () => {
    expect(conflictosDeKeybinds({ ...DEFAULT_KEYBINDS, reload: 'KeyE' })).toEqual(['KeyE']);
  });

  it('ordena el resultado', () => {
    expect(
      conflictosDeKeybinds({ a: 'KeyZ', b: 'KeyE', c: 'KeyZ', d: 'KeyE' })
    ).toEqual(['KeyE', 'KeyZ']);
  });
});
