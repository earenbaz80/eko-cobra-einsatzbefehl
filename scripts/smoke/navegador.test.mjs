import { afterEach, describe, expect, it } from 'vitest';
import { arrancarMision, pulsarConAzarSembrado, vigilarPagina } from './navegador.mjs';

const ORIGEN = 'http://127.0.0.1:4000';

/** Página falsa: solo guarda los manejadores que el humo conecta. */
function paginaFalsa() {
  const manejadores = new Map();
  return {
    on(evento, manejador) {
      if (!manejadores.has(evento)) manejadores.set(evento, []);
      manejadores.get(evento).push(manejador);
    },
    emitir(evento, carga) {
      for (const manejador of manejadores.get(evento) ?? []) manejador(carga);
    },
  };
}

const pedido = (url, errorText) => ({ url: () => url, failure: () => ({ errorText }) });
const malo = (url, status) => ({ url: () => url, status: () => status });

function vigilar() {
  const page = paginaFalsa();
  const badRequests = [];
  vigilarPagina(page, { origin: ORIGEN, badRequests, consoleErrors: [] });
  return { page, badRequests };
}

describe('vigilarPagina', () => {
  it('no cuenta el recurso que cancela la navegación siguiente', () => {
    const { page, badRequests } = vigilar();
    page.emitir(
      'requestfailed',
      pedido(`${ORIGEN}/assets/aistudio/Embl_me_du_Einsatzkommando_Cobra.svg`, 'net::ERR_ABORTED')
    );
    expect(badRequests).toEqual([]);
  });

  it('sigue contando una caída de red de verdad', () => {
    const { page, badRequests } = vigilar();
    page.emitir('requestfailed', pedido(`${ORIGEN}/assets/index-abc.js`, 'net::ERR_FAILED'));
    expect(badRequests).toEqual([`FALLO ${ORIGEN}/assets/index-abc.js (net::ERR_FAILED)`]);
  });

  it('sigue contando un 404', () => {
    const { page, badRequests } = vigilar();
    page.emitir('response', malo(`${ORIGEN}/assets/falta.css`, 404));
    expect(badRequests).toEqual([`404 ${ORIGEN}/assets/falta.css`]);
  });

  it('no cuenta nada de fuera del propio origen', () => {
    const { page, badRequests } = vigilar();
    page.emitir('requestfailed', pedido('https://fonts.googleapis.com/css2', 'net::ERR_FAILED'));
    page.emitir('response', malo('https://fonts.googleapis.com/css2', 500));
    expect(badRequests).toEqual([]);
  });
});

/** Globals de navegador mínimos para el callback que corre dentro de la página. */
const SEMILLA = 0xe2e0;
const globalsPrevios = { window: globalThis.window, MouseEvent: globalThis.MouseEvent };

function instalarNavegadorFalso({ azarInstalado = true } = {}) {
  globalThis.window = {
    __ekoSeed: SEMILLA,
    __ekoAzar: azarInstalado ? { reiniciar: () => {} } : undefined,
  };
  globalThis.MouseEvent = class extends Event {
    constructor(tipo, opciones) {
      super(tipo, opciones);
    }
  };
}

afterEach(() => {
  globalThis.window = globalsPrevios.window;
  globalThis.MouseEvent = globalsPrevios.MouseEvent;
});

/**
 * Página con la superficie que usa `arrancarMision`: registra si la misión se
 * pulsó con el azar sembrado (evaluate + dispatchEvent) o con el clic nativo.
 */
function paginaDeArranque({ azarInstalado = true } = {}) {
  instalarNavegadorFalso({ azarInstalado });
  const registro = { semilla: null, clicsNativos: 0, eventos: [] };
  const elemento = {
    dispatchEvent(evento) {
      registro.eventos.push(evento.type);
      return true;
    },
  };
  const boton = {
    waitFor: async () => {},
    click: async () => {
      registro.clicsNativos += 1;
    },
    elementHandle: async () => ({
      evaluate: async (fn) => fn(elemento),
    }),
  };
  return {
    registro,
    goto: async () => {},
    waitForSelector: async () => {},
    getByRole: () => boton,
    getByText: () => ({ first: () => ({ waitFor: async () => {} }) }),
    waitForFunction: async () => {},
    waitForTimeout: async () => {},
  };
}

describe('arrancarMision', () => {
  it('siembra el mundo antes de pulsar la misión por defecto', async () => {
    const page = paginaDeArranque();
    window.__ekoAzar.reiniciar = (valor) => {
      page.registro.semilla = valor;
    };

    await arrancarMision(page, `${ORIGEN}/`, 'Misión 1: Piso Graz - Lend');

    expect(page.registro.semilla).toBe(SEMILLA);
    expect(page.registro.eventos).toEqual(['click']);
    expect(page.registro.clicsNativos).toBe(0);
  });

  it('pulsa sin sembrar cuando se pide explícitamente', async () => {
    const page = paginaDeArranque();

    await arrancarMision(page, `${ORIGEN}/`, 'Misión 1: Piso Graz - Lend', {
      reiniciarAzar: false,
    });

    expect(page.registro.semilla).toBeNull();
    expect(page.registro.eventos).toEqual([]);
    expect(page.registro.clicsNativos).toBe(1);
  });
});

describe('pulsarConAzarSembrado', () => {
  it('falla si la página no instaló el azar reiniciable', async () => {
    const page = paginaDeArranque({ azarInstalado: false });

    await expect(
      pulsarConAzarSembrado(page.getByRole('button', { name: 'Misión 1' }))
    ).rejects.toThrow('el azar reiniciable no está instalado');
  });
});
