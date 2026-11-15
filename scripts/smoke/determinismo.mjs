/**
 * Aleatoriedad determinista del E2E.
 *
 * Playwright inyecta esto antes de que arranque la app, de modo que el mobiliario
 * procedural, las partículas, la IA y el audio reciben la misma secuencia de
 * `Math.random` en cada contexto. Así una captura o una aserción no cambia por
 * una tirada distinta; la semilla queda en `window.__ekoSeed` para diagnóstico.
 */
export async function instalarAzarDeterminista(contexto, semilla) {
  await contexto.addInitScript((valor) => {
    let estado = valor >>> 0;
    const azar = () => {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let t = estado;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Object.defineProperty(Math, 'random', { value: azar, configurable: true, writable: true });
    Object.defineProperty(window, '__ekoSeed', { value: valor, configurable: true, enumerable: false });
  }, semilla >>> 0);
}
