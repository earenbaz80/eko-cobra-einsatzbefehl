import { describe, expect, it } from 'vitest';
import { calcularDespeje, type SalaDespejeEntrada } from './clearance';

const sala = (id: string, extra: Partial<SalaDespejeEntrada> = {}): SalaDespejeEntrada => ({
  id,
  nameDe: id,
  nameEs: id,
  asegurada: false,
  ocupada: false,
  hostilesConocidos: 0,
  ...extra,
});

describe('calcularDespeje', () => {
  it('marca como no vista toda estancia sin presencia ni intel', () => {
    const despeje = calcularDespeje([sala('VORRAUM'), sala('BAD')]);
    expect(despeje.salas.map((s) => s.estado)).toEqual(['SIN_VISTA', 'SIN_VISTA']);
    expect(despeje.despejadas).toBe(0);
    expect(despeje.sinVista).toBe(2);
    expect(despeje.progresoPct).toBe(0);
    expect(despeje.siguiente?.id).toBe('VORRAUM');
    expect(despeje.contacto).toBeNull();
  });

  it('da por despejadas las estancias que el mapa marca aseguradas', () => {
    const despeje = calcularDespeje([sala('STIEGENHAUS', { asegurada: true }), sala('VORRAUM')]);
    expect(despeje.salas[0].estado).toBe('DESPEJADA');
    expect(despeje.despejadas).toBe(1);
    expect(despeje.siguiente?.id).toBe('VORRAUM');
  });

  it('da por despejada la estancia que ocupa el binomio', () => {
    const despeje = calcularDespeje([sala('VORRAUM', { ocupada: true })]);
    expect(despeje.salas[0].estado).toBe('DESPEJADA');
  });

  it('con un hostile conocido la estancia pasa a contacto y sale de la memoria', () => {
    const memoria = new Set(['VORRAUM']);
    const despeje = calcularDespeje([sala('VORRAUM', { hostilesConocidos: 2 })], memoria);
    expect(despeje.salas[0].estado).toBe('EN_CONTACTO');
    expect(despeje.enContacto).toBe(1);
    expect(despeje.despejadas).toBe(0);
    expect(despeje.contacto?.id).toBe('VORRAUM');
    expect(memoria.has('VORRAUM')).toBe(false);
  });

  it('mantiene despejada una sala ya barrida aunque el binomio se vaya', () => {
    const memoria = new Set<string>();
    const primera = calcularDespeje([sala('VORRAUM', { ocupada: true })], memoria);
    expect(primera.salas[0].estado).toBe('DESPEJADA');

    const despues = calcularDespeje([sala('VORRAUM')], memoria);
    expect(despues.salas[0].estado).toBe('DESPEJADA');
    expect(despues.despejadas).toBe(1);
  });

  it('saca de la memoria la sala ya barrida que vuelve a contacto y no la da por despejada al quedar vacía', () => {
    const memoria = new Set<string>();

    // Barrida: el binomio la ocupa y queda en la memoria.
    const primera = calcularDespeje([sala('VORRAUM', { ocupada: true })], memoria);
    expect(primera.salas[0].estado).toBe('DESPEJADA');
    expect(memoria.has('VORRAUM')).toBe(true);

    // Sin nadie dentro, la memoria todavía la sostiene.
    expect(calcularDespeje([sala('VORRAUM')], memoria).salas[0].estado).toBe('DESPEJADA');

    // Un hostil conocido dentro la pasa a contacto y la borra de la memoria.
    const contacto = calcularDespeje([sala('VORRAUM', { hostilesConocidos: 1 })], memoria);
    expect(contacto.salas[0].estado).toBe('EN_CONTACTO');
    expect(memoria.has('VORRAUM')).toBe(false);

    // Resuelto el contacto y con la sala vacía, ya no vuelve a despejada: es pendiente.
    const despues = calcularDespeje([sala('VORRAUM')], memoria);
    expect(despues.salas[0].estado).toBe('SIN_VISTA');
    expect(despues.despejadas).toBe(0);
    expect(despues.siguiente?.id).toBe('VORRAUM');
  });

  it('vuelve a abrir el objetivo si la sala despejada entra en contacto', () => {
    const memoria = new Set(['VORRAUM']);
    const despeje = calcularDespeje([sala('VORRAUM', { hostilesConocidos: 1 })], memoria);
    expect(despeje.siguiente?.id).toBe('VORRAUM');
    expect(despeje.siguiente?.estado).toBe('EN_CONTACTO');
  });

  it('cuenta progreso y deja siguiente en null cuando todo está despejado', () => {
    const despeje = calcularDespeje([
      sala('A', { asegurada: true }),
      sala('B', { ocupada: true, hostilesConocidos: 0 }),
      sala('C', { asegurada: true }),
    ]);
    expect(despeje.despejadas).toBe(3);
    expect(despeje.sinVista).toBe(0);
    expect(despeje.progresoPct).toBe(100);
    expect(despeje.siguiente).toBeNull();
  });

  it('sin estancias no inventa objetivo ni divide por cero', () => {
    const despeje = calcularDespeje([]);
    expect(despeje.total).toBe(0);
    expect(despeje.progresoPct).toBe(0);
    expect(despeje.siguiente).toBeNull();
    expect(despeje.contacto).toBeNull();
  });
});
