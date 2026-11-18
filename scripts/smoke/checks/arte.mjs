/**
 * `?art=proof`: el pase de arte cenital arranca una misión y pinta escena.
 *
 * Es una superficie que ningún otro check abre: si el render experimental se
 * rompe, el juego normal sigue pintando y el humo pasaría en verde. Aquí se
 * arranca la Misión 1 con el pase activo y se falla si la página lanza
 * excepciones (las recoge `vigilarPagina`), si el canvas queda vacío o si no
 * aparece el marco con el que el pase presenta su buffer 16:9 (640x360).
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

  // El pase dibuja su buffer 16:9 centrado sobre negro. En esta ventana (1280x800)
  // el encaje da 2,00 y sobran 40 px de banda arriba y abajo; en otras proporciones
  // la banda cae a los lados. El render normal pinta de borde a borde y no deja
  // ninguna, así que el marco es la prueba de que `?art=proof` se aplicó.
  const marco = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const ctx = el.getContext('2d');
    const fila = Math.floor(el.height / 2);
    const columna = Math.floor(el.width / 2);
    const pintado = (x, y) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return r + g + b > 0;
    };
    let izquierda = 0;
    while (izquierda < el.width && !pintado(izquierda, fila)) izquierda += 1;
    let derecha = 0;
    while (derecha < el.width && !pintado(el.width - 1 - derecha, fila)) derecha += 1;
    let arriba = 0;
    while (arriba < el.height && !pintado(columna, arriba)) arriba += 1;
    let abajo = 0;
    while (abajo < el.height && !pintado(columna, el.height - 1 - abajo)) abajo += 1;
    return { ancho: el.width, alto: el.height, izquierda, derecha, arriba, abajo };
  });

  const anchoArte = marco.ancho - marco.izquierda - marco.derecha;
  const altoArte = marco.alto - marco.arriba - marco.abajo;
  const banda = Math.max(marco.izquierda, marco.derecha, marco.arriba, marco.abajo);
  if (banda < 8 || anchoArte <= 0 || altoArte <= 0) {
    fail(
      `${ETIQUETA}: sin marco del buffer cenital (${marco.izquierda}/${marco.derecha}/${marco.arriba}/${marco.abajo} px): el pase no llegó al canvas`
    );
    return;
  }
  const centrado =
    Math.abs(marco.izquierda - marco.derecha) <= 2 && Math.abs(marco.arriba - marco.abajo) <= 2;
  const dieciseisNueve = Math.abs(anchoArte / altoArte - 16 / 9) <= 0.02;
  if (!centrado || !dieciseisNueve) {
    fail(
      `${ETIQUETA}: el marco no es 16:9 centrado (${anchoArte}x${altoArte}, márgenes ${marco.izquierda}/${marco.derecha}/${marco.arriba}/${marco.abajo})`
    );
    return;
  }

  console.log(
    `${ETIQUETA} · Misión 1: canvas ${canvas.tonos} tonos, ${(proporcion * 100).toFixed(0)} % de píxeles visibles, marco ${anchoArte}x${altoArte} con banda ${banda} px`
  );
}
