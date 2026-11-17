/**
 * `?art=proof`: el pase de arte cenital arranca una misión y pinta escena.
 *
 * Es una superficie que ningún otro check abre: si el render experimental se
 * rompe, el juego normal sigue pintando y el humo pasaría en verde. Aquí se
 * arranca la Misión 1 con el pase activo y se falla si la página lanza
 * excepciones (las recoge `vigilarPagina`), si el canvas queda vacío o si no
 * aparece el marco con el que el pase presenta su buffer de 480x270.
 */
import { estadisticasCanvas } from '../canvas.mjs';
import { arrancarMision } from '../navegador.mjs';
import { fail } from '../informe.mjs';

const MISION_1 = 'Misión 1: Piso Graz - Lend';
const ETIQUETA = 'art proof';

export async function comprobarArtProof(page, { url }) {
  try {
    await arrancarMision(page, `${url}?art=proof`, MISION_1, { asentarMs: 800 });
  } catch (error) {
    fail(`${ETIQUETA}: no arranca la Misión 1 (${error.message.split('\n')[0]})`);
    return;
  }

  const canvas = await estadisticasCanvas(page);
  if (!canvas || canvas.error) {
    fail(`${ETIQUETA}: ${canvas ? canvas.error : 'no existe el canvas'}`);
    return;
  }
  const proporcion = canvas.visibles / canvas.muestras;
  if (canvas.tonos < 8 || proporcion < 0.05) {
    fail(`${ETIQUETA}: canvas vacío (${canvas.tonos} tonos, ${(proporcion * 100).toFixed(1)} % visibles)`);
    return;
  }

  // El pase escala 480x270 por enteros y lo centra sobre negro: en esta ventana
  // sobran 160 px de banda a la izquierda. El render normal pinta el canvas de
  // borde a borde, así que la banda es la prueba de que `?art=proof` se aplicó.
  const banda = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const fila = Math.floor(el.height / 2);
    let ancho = 0;
    while (ancho < el.width) {
      const [r, g, b] = ctx.getImageData(ancho, fila, 1, 1).data;
      if (r + g + b > 0) break;
      ancho += 1;
    }
    return ancho;
  });
  if (banda < 8) {
    fail(`${ETIQUETA}: sin banda del buffer cenital (${banda} px): el pase no llegó al canvas`);
    return;
  }

  console.log(
    `${ETIQUETA} · Misión 1: canvas ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(0)} % de píxeles visibles, banda ${banda} px`
  );
}
