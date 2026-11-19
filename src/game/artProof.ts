/**
 * PASE DE ARTE EN PÍXELES — el render por defecto del juego.
 *
 * Objetivo: mostrar el mismo juego con arte de píxeles real (tileset + sprites
 * dibujados a mano), sombras proyectadas y un pase de luz suave, renderizado a
 * una resolución interna de 640x360 presentada a la escala de la ventana.
 *
 * No toca la simulación: sólo lee el estado que ya existe en el motor.
 * `?art=classic` devuelve el render anterior para comparar. Opcionales:
 * `&focus=salon` para encuadrar el salón y `&scale=int` para forzar escala
 * entera (el entero más cercano, recortando el desborde a los lados si hace falta).
 *
 * La pintura de la escena vive en `pixelArt/scene` (con su catálogo de baldosas
 * en `pixelArt/tiles`); aquí queda la entrada, el encuadre de la prueba y la
 * presentación del buffer a pantalla.
 */

import { createCanvas } from './pixelArt/bitmap';
import { BUFFER_H, BUFFER_W, present } from './pixelArt/present';
import { renderScene, type PixelScene } from './pixelArt/scene';

/**
 * La prueba dibuja en su propio buffer; el canvas de pantalla y su
 * `devicePixelRatio` llegan aparte para poder devolver el encuadre en píxeles CSS.
 */
type ArtProofScene = PixelScene & { ctx: CanvasRenderingContext2D; renderScale: number };

/** Centro de la cámara en pantalla (px CSS) y píxeles por unidad de mundo. */
export interface EncuadrePresentado {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

let bufferCtx: CanvasRenderingContext2D | null = null;
let encuadre: EncuadrePresentado | null = null;

/**
 * Encuadre de la última presentación. El motor lo usa como `framing` para que
 * `screenToWorld`/`worldToScreen` y sus overlays caigan donde se ve el arte: el
 * canal presenta otro buffer (otra escala, con letterbox), no el encuadre clásico.
 * Null mientras el pase no haya pintado ningún cuadro.
 */
export function geometriaPresentada(): EncuadrePresentado | null {
  return encuadre;
}

let cachedParams: URLSearchParams | null = null;

function readParams(): URLSearchParams {
  if (cachedParams) return cachedParams;
  if (typeof window === 'undefined') {
    cachedParams = new URLSearchParams();
    return cachedParams;
  }
  cachedParams = new URLSearchParams(window.location.search);
  return cachedParams;
}

/** `&scale=int`: escala entera y letterbox, para capturas sin remuestreo. */
export function isIntegerScaleRequested(): boolean {
  return readParams().get('scale') === 'int';
}

/**
 * FNV-1a de 32 bits sobre los píxeles del buffer, para la regresión visual del
 * humo. Hashea el arte y no la presentación: así el rótulo, la viñeta y el grano
 * de pantalla no dependen de la tipografía instalada. Devuelve null mientras el
 * pase no haya pintado ningún cuadro.
 */
export function artProofBufferHash(): string | null {
  if (!bufferCtx) return null;
  const { data } = bufferCtx.getImageData(0, 0, BUFFER_W, BUFFER_H);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Tamaño del buffer interno. El humo lo lee de acá en vez de repetir 640x360:
 * si el buffer cambia, el guardián de texto del sistema sigue mirando el canvas
 * correcto en lugar de quedar ciego y pasar en verde.
 */
export function artBufferSize(): { width: number; height: number } {
  return { width: BUFFER_W, height: BUFFER_H };
}

function resolveCamera(scene: ArtProofScene): { x: number; y: number } {
  const params = readParams();
  if (params.get('focus') === 'salon') {
    const salon = scene.rooms.find((room) => room.id === 'ALPEN_SALON');
    if (salon) return { x: salon.x + 200, y: salon.y + 155 };
  }
  return { x: scene.camX, y: scene.camY };
}

export function renderArtProof(scene: ArtProofScene): void {
  const { ctx } = scene;
  if (!bufferCtx) bufferCtx = createCanvas(BUFFER_W, BUFFER_H).getContext('2d');
  if (!bufferCtx) return;

  const bctx = bufferCtx;
  const time = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  const cam = resolveCamera(scene);

  renderScene(bctx, scene, cam, time);

  // Escala fraccionaria: ocupa el ancho disponible respetando el 16:9. Sin blur
  // (nearest-neighbor), pero el píxel de arte ya no mide un entero de pantalla.
  // Con `&scale=int` se usa el entero más cercano: hacia arriba desborda y el
  // arte se recorta por igual a los lados, en vez de quedar chico con bandas
  // enormes (con floor, un panel de 1,98 caía a ×1).
  const integerScale = isIntegerScaleRequested();
  const fit = Math.min(ctx.canvas.width / BUFFER_W, ctx.canvas.height / BUFFER_H);
  const scale = Math.max(1, integerScale ? Math.round(fit) : fit);
  const factor = integerScale ? `${Math.round(scale)}` : scale.toFixed(2);
  const presentado = present(
    ctx,
    bctx.canvas,
    scale,
    `ART PROOF · ${BUFFER_W}×${BUFFER_H} ×${factor} · ${scene.missionMode}`,
    time
  );

  // El buffer mapea 1 unidad de mundo = 1 px, y `present` centra el arte en el
  // canvas: el centro de la cámara queda en el centro del panel. Se devuelve en
  // px CSS dividiendo por el `devicePixelRatio` con el que se pintó.
  const renderScale = scene.renderScale > 0 ? scene.renderScale : 1;
  encuadre = {
    x: presentado.cx / renderScale,
    y: presentado.cy / renderScale,
    zoom: presentado.scale / renderScale,
  };
}
