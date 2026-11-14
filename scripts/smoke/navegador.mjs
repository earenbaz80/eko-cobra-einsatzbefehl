/**
 * Vigilancia de una pestaña: apunta a las listas compartidas cualquier respuesta
 * del propio sitio que falle o cualquier error de consola.
 */

/**
 * @param {import('playwright').Page} page
 * @param {{ origin: string, badRequests: string[], consoleErrors: string[], prefijo?: string, fallosDeRed?: boolean }} opciones
 *   `prefijo` distingue los avisos del móvil en el informe; `fallosDeRed` añade
 *   `requestfailed` (solo la pestaña de escritorio lo hacía).
 */
export function vigilarPagina(page, { origin, badRequests, consoleErrors, prefijo = '', fallosDeRed = true }) {
  page.on('response', (response) => {
    const target = response.url();
    if (!target.startsWith(origin)) return; // las fuentes de Google no son parte del build
    if (target.endsWith('/favicon.ico')) return;
    if (response.status() >= 400) badRequests.push(`${prefijo}${response.status()} ${target}`);
  });
  if (fallosDeRed) {
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(origin)) badRequests.push(`FALLO ${request.url()} (${request.failure()?.errorText})`);
    });
  }
  page.on('pageerror', (error) => consoleErrors.push(`${prefijo}excepción: ${error.message}`));
  page.on('console', (message) => {
    // El favicon lo pide el navegador por su cuenta y no forma parte del build.
    if (message.type() === 'error' && !/favicon/i.test(message.text())) consoleErrors.push(`${prefijo}${message.text()}`);
  });
}
