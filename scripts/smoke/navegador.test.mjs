import { describe, expect, it } from 'vitest';
import { vigilarPagina } from './navegador.mjs';

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
