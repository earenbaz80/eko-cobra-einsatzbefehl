/**
 * Sondeos de las capas que el motor repinta sobre el pase de píxeles desde
 * `renderScreenOverlays`: el retículo sigue al puntero y el minimapa y la
 * bodycam se rotulan en el canvas visible, no en el buffer del arte. Los usan la
 * comprobación de capas y la de daño, para medir lo mismo de una sola forma.
 */

/**
 * Cian del retículo: mueve el ratón, deja que se pinte el cuadro y cuenta el
 * táctico en una caja de 34 px alrededor del puntero. Sin retículo, el arte de
 * fondo no da ese tono.
 */
export async function contarCianEnPuntero(page, x, y) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(220);
  return page.evaluate(
    ([px, py]) => {
      const el = document.querySelector('canvas');
      const ctx = el.getContext('2d');
      const dpr = el.width / el.getBoundingClientRect().width;
      const lado = 34;
      const x0 = Math.max(0, Math.round(px * dpr - lado / 2));
      const y0 = Math.max(0, Math.round(py * dpr - lado / 2));
      const { data } = ctx.getImageData(x0, y0, lado, lado);
      let cian = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (b - r >= 70 && b >= 100 && g >= 60) cian += 1;
      }
      return cian;
    },
    [x, y]
  );
}

/**
 * Rótulos de capa dibujados con `fillText` en el canvas visible: el del minimapa
 * (`minimapCenter` por defecto es (74, 74), así que cae en (52, 141)) y el de la
 * bodycam de Kobra-2.
 */
export function contarRotulosSobreElArte(page) {
  return page.evaluate(() => {
    const textos = (window.__arteTextos ?? []).filter((t) => t.enDom);
    return {
      minimapa: textos.filter(
        (t) => t.texto === 'MINIMAP 2D' && Math.abs(t.x - 52) <= 2 && Math.abs(t.y - 141) <= 2
      ).length,
      piip: textos.filter((t) => t.texto === 'HELMKAMERA · KOBRA-2').length,
    };
  });
}
