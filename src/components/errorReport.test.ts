import { describe, expect, it } from 'vitest';
import { construirResumen, copiarAlPortapapeles, enlaceAlMenu, formatearInforme, leerResumen, publicarResumen, quiereMenu } from './errorReport';
import type { HudSnapshot } from '../game/types';

const hud = {
  missionMode: 'STATION',
  elapsedSeconds: 84.6,
  currentRoom: 'Andén 2',
  squadVitals: { name: 'K1' },
  suspectsTotal: 3,
  suspectsSecured: 1,
  hostagesTotal: 2,
  hostagesSecured: 0,
} as unknown as HudSnapshot;

const entorno = {
  url: 'https://earenbaz80.github.io/eko-cobra-einsatzbefehl/',
  userAgent: 'Mozilla/5.0 (test)',
  marca: 'abc123',
  fecha: '2026-11-14T12:00:00.000Z',
};

describe('construirResumen', () => {
  it('resume misión, tick, tiempo, sala y entidades', () => {
    const resumen = construirResumen({ hud, gameState: 'PLAYING', ticks: 5040.4 });
    expect(resumen).toEqual({
      mision: 'Misión 2: Estación de Trenes (o 2B / Metro U3)',
      estado: 'PLAYING',
      tick: 5040,
      segundos: 85,
      sala: 'Andén 2',
      entidades: { escuadra: 1, sospechosos: 3, rehenes: 2, total: 6 },
    });
  });

  it('sin partida devuelve ceros y "Sin partida (menú)"', () => {
    expect(construirResumen({ hud: null, gameState: 'TITLE', ticks: 0 })).toMatchObject({
      mision: 'Sin partida (menú)',
      tick: 0,
      segundos: 0,
      entidades: { escuadra: 0, sospechosos: 0, rehenes: 0, total: 0 },
    });
  });

  it('en el menú con un HUD viejo no inventa una misión', () => {
    expect(construirResumen({ hud, gameState: 'TITLE', ticks: 7 }).mision).toBe('Sin partida (menú)');
  });

  it('no deja ticks negativos ni decimales', () => {
    expect(construirResumen({ hud, gameState: 'PLAYING', ticks: -3.7 }).tick).toBe(0);
  });
});

describe('formatearInforme', () => {
  const resumen = construirResumen({ hud, gameState: 'PLAYING', ticks: 5040 });

  it('incluye build, url, navegador y el error', () => {
    const texto = formatearInforme({ error: { message: 'boom' }, resumen, entorno });
    expect(texto).toContain('build: abc123');
    expect(texto).toContain(`url: ${entorno.url}`);
    expect(texto).toContain('navegador: Mozilla/5.0 (test)');
    expect(texto).toContain('error: boom');
  });

  it('incluye partida y entidades con el detalle de asegurados', () => {
    const texto = formatearInforme({ error: { message: 'boom' }, resumen, entorno, asegurados: { sospechosos: 1, rehenes: 0 } });
    expect(texto).toContain('partida: Misión 2: Estación de Trenes (o 2B / Metro U3) · PLAYING · tick 5040 · 85 s · sala Andén 2');
    expect(texto).toContain('entidades: 6 (escuadra 1, sospechosos 3 con 1 asegurados, rehenes 2 con 0 asegurados)');
  });

  it('dice que no hay datos si el fallo ocurrió antes de arrancar', () => {
    const texto = formatearInforme({ error: { message: 'boom' }, resumen: null, entorno });
    expect(texto).toContain('sin datos');
    expect(texto).toContain('entidades: sin datos');
  });

  it('añade la pila cuando existe', () => {
    expect(formatearInforme({ error: { message: 'boom', stack: 'Error: boom\n  at x' }, resumen, entorno })).toContain('pila:\nError: boom');
    expect(formatearInforme({ error: { message: 'boom' }, resumen, entorno })).not.toContain('pila:');
  });
});

describe('enlaceAlMenu / quiereMenu', () => {
  it('apunta al menú del mismo sitio', () => {
    expect(enlaceAlMenu('/eko-cobra-einsatzbefehl/')).toBe('/eko-cobra-einsatzbefehl/?menu=1');
    expect(enlaceAlMenu('/')).toBe('/?menu=1');
  });

  it('detecta el parámetro del enlace de recuperación', () => {
    expect(quiereMenu('?menu=1')).toBe(true);
    expect(quiereMenu('?foo=bar&menu=1')).toBe(true);
    expect(quiereMenu('?menu=0')).toBe(false);
    expect(quiereMenu('')).toBe(false);
  });

  it('el enlace que genera se reconoce al volver a entrar', () => {
    expect(quiereMenu(enlaceAlMenu('/eko-cobra-einsatzbefehl/').split('?')[1].replace(/^/, '?'))).toBe(true);
  });
});

describe('publicarResumen / leerResumen', () => {
  it('ida y vuelta por el objeto global', () => {
    const destino: Record<string, unknown> = {};
    const resumen = construirResumen({ hud, gameState: 'PLAYING', ticks: 10 });
    publicarResumen(resumen, destino);
    expect(leerResumen(destino)).toEqual(resumen);
  });

  it('sin nada publicado devuelve null', () => {
    expect(leerResumen({})).toBe(null);
    expect(leerResumen({ __ekoDiag: 'basura' })).toBe(null);
    expect(leerResumen({ __ekoDiag: { mision: 'x', tick: 'no' } })).toBe(null);
    expect(leerResumen({ __ekoDiag: { mision: 'x', tick: 1 } })).toBe(null);
  });

  it('completa los campos que falten sin romperse', () => {
    const leido = leerResumen({ __ekoDiag: { mision: 'x', tick: 3, entidades: { total: 2 } } });
    expect(leido).toEqual({ mision: 'x', estado: 'PLAYING', tick: 3, segundos: 0, sala: '—', entidades: { escuadra: 0, sospechosos: 0, rehenes: 0, total: 2 } });
  });
});

describe('copiarAlPortapapeles', () => {
  it('copia con la API del navegador', async () => {
    const copiado: string[] = [];
    await expect(copiarAlPortapapeles('informe', { writeText: async (valor) => void copiado.push(valor) })).resolves.toBe(true);
    expect(copiado).toEqual(['informe']);
  });

  it('devuelve false si no hay API (contexto no seguro)', async () => {
    await expect(copiarAlPortapapeles('informe', undefined)).resolves.toBe(false);
  });

  it('devuelve false si el navegador rechaza la escritura', async () => {
    await expect(
      copiarAlPortapapeles('informe', {
        writeText: async () => {
          throw new Error('denegado');
        },
      })
    ).resolves.toBe(false);
  });
});
