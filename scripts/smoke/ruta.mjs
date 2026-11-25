/**
 * Ruta del operador derivada del mundo, no de umbrales escritos a mano.
 *
 * Antes el humo caminaba con `caminarHasta(tecla, umbral)`: sostenía una tecla
 * hasta cruzar una coordenada y el carril se corregía aparte, a mano, en los vanos
 * que dolían. Eso codifica la geometría del mapa en la comprobación: mover una
 * puerta o añadir una pared rompe pasos que no tienen nada que ver, y el carril
 * hay que arreglarlo vano por vano.
 *
 * Aquí la ruta se calcula sobre el snapshot del motor. El escenario se rasteriza en
 * una rejilla de `PASO_REJILLA` px y una celda es transitable si su centro queda a
 * `HOLGURA_CUERPO` (17 px: radio 14 + margen 3 de pared) o más de todo lo que frena
 * al cuerpo —muros, hojas no francas y muebles que bloquean el paso—. Sobre esa
 * rejilla se busca el camino más corto (A* en 8 direcciones, sin cortar esquinas) y
 * se simplifica a los pocos tramos rectos que conservan la holgura. El vano aparece
 * solo: con 17 px de holgura a cada lado, la única banda libre de una puerta es su
 * punto medio, así que el carril no se pide, se deduce. Además cada tramo que cruza
 * una puerta se parte exactamente por su punto medio.
 *
 * La ruta termina en el destino pedido, que es lo que después se afirma: el humo
 * sigue comprobando coordenadas, pero deja de saber por dónde se pasa para llegar.
 */

/** Radio del cuerpo (14) más el margen que el motor deja contra la pared (3). */
export const HOLGURA_CUERPO = 17;
/** Lado de la celda de la rejilla, en px. */
export const PASO_REJILLA = 6;
/** Hasta dónde se busca una celda libre para el arranque (el cuerpo puede estar pegado). */
const BUSQUEDA_ARRANQUE = 42;
/**
 * Hasta dónde se admite corregir el destino. Es deliberadamente corto: si la
 * coordenada pedida no tiene holgura, la ruta no se inventa un final a 20 px y la
 * comprobación lo dice en vez de pasear al operador contra un mueble.
 */
const BUSQUEDA_META = 12;
/** Cada cuánto se muestrea un tramo para comprobar que conserva la holgura. */
const MUESTRA_TRAMO = 3;
/**
 * Coseno del ángulo con el que un tramo ya cruza el vano de frente. Por debajo de
 * 20° el cuerpo entra recto y no hay esquina que rodear; alinearlo solo añadiría
 * paradas de precisión al caminante, que con la máquina cargada se pagan caras.
 */
const CRUCE_DE_FRENTE = Math.cos((20 * Math.PI) / 180);
/**
 * Desvío del cruce respecto del punto medio que ya se considera carril. Con un vano
 * de 70 px y 17 de holgura la banda libre es de ±18 px: dos celdas de rejilla dejan
 * margen de sobra y evitan añadir paradas a un cruce que ya pasa lejos de los jambs.
 */
const CARRIL_YA_ALINEADO = PASO_REJILLA * 2;

const distanciaASegmento = (px, py, segmento) => {
  const dx = segmento.bx - segmento.ax;
  const dy = segmento.by - segmento.ay;
  const largo = dx * dx + dy * dy;
  if (!largo) return Math.hypot(px - segmento.ax, py - segmento.ay);
  const t = Math.max(0, Math.min(1, ((px - segmento.ax) * dx + (py - segmento.ay) * dy) / largo));
  return Math.hypot(px - (segmento.ax + dx * t), py - (segmento.ay + dy * t));
};

const distanciaARectangulo = (px, py, rect) => {
  const cx = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  return Math.hypot(px - cx, py - cy);
};

/**
 * Lo que frena el cuerpo, en la forma que usan el planificador y el `snapshot`:
 * muros y hojas como segmentos, mobiliario como rectángulos.
 */
export function obstaculosDelMundo(mundo) {
  const segmentos = [];
  for (const muro of mundo?.walls ?? []) {
    segmentos.push({ ax: muro.x1, ay: muro.y1, bx: muro.x2, by: muro.y2, id: muro.id });
  }
  for (const puerta of mundo?.doors ?? []) {
    if (puerta.isFullyOpen || puerta.isDestroyed || puerta.isBreached) continue;
    segmentos.push({
      ax: puerta.x1,
      ay: puerta.y1,
      bx: puerta.x2,
      by: puerta.y2,
      id: puerta.id,
      esPuerta: true,
    });
  }
  const muebles = (mundo?.furniture ?? []).filter(
    (mueble) => mueble.blocksMovement && !mueble.isDestroyed
  );
  return { segmentos, muebles };
}

/** ¿Cabe el cuerpo en `(x, y)` con `holgura` respecto de todo lo que frena? */
export function cabeElCuerpo(x, y, obstaculos, holgura = HOLGURA_CUERPO) {
  for (const segmento of obstaculos.segmentos) {
    if (distanciaASegmento(x, y, segmento) < holgura) return false;
  }
  for (const mueble of obstaculos.muebles) {
    if (distanciaARectangulo(x, y, mueble) < holgura) return false;
  }
  return true;
}

/** Cruce de dos segmentos: devuelve el punto y el parámetro sobre el primero. */
const cruceDeSegmentos = (a, b) => {
  const rx = a.bx - a.ax;
  const ry = a.by - a.ay;
  const sx = b.bx - b.ax;
  const sy = b.by - b.ay;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return null;
  const qx = b.ax - a.ax;
  const qy = b.ay - a.ay;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, x: a.ax + rx * t, y: a.ay + ry * t };
};

const redondear = (valor) => Math.round(valor * 10) / 10;

/**
 * Carril del vano, derivado de la hoja cerrada: su punto medio y la normal a la
 * hoja. La hoja franca deja libre justo ese eje, así que alinearse con él es lo que
 * separa al cuerpo de los dos jambs por igual antes de cruzar.
 */
const carrilDePuerta = (puerta) => {
  const dx = puerta.x2 - puerta.x1;
  const dy = puerta.y2 - puerta.y1;
  const largo = Math.hypot(dx, dy);
  if (!largo) return null;
  return {
    medio: { x: (puerta.x1 + puerta.x2) / 2, y: (puerta.y1 + puerta.y2) / 2 },
    normal: { x: -dy / largo, y: dx / largo },
  };
};

/**
 * Planifica la ruta de `desde` a `hasta`.
 *
 * Devuelve `{ puntos, motivo }`. `puntos` empieza en el primer punto alcanzable y
 * termina en `hasta`, con los cruces de puerta partidos por el punto medio del vano.
 * Si no hay ruta, `puntos` viene vacío y `motivo` dice cuál de las dos cosas falló:
 * el destino no tiene holgura o está encerrado.
 */
export function planificarRuta(mundo, desde, hasta, opciones = {}) {
  const holgura = opciones.holgura ?? HOLGURA_CUERPO;
  const paso = opciones.paso ?? PASO_REJILLA;
  const obstaculos = obstaculosDelMundo(mundo);
  const libre = (x, y) => cabeElCuerpo(x, y, obstaculos, holgura);

  // Caja de la rejilla: todo el escenario más margen, para que el borde no corte rutas.
  const xs = [];
  const ys = [];
  for (const segmento of obstaculos.segmentos) {
    xs.push(segmento.ax, segmento.bx);
    ys.push(segmento.ay, segmento.by);
  }
  for (const mueble of obstaculos.muebles) {
    xs.push(mueble.x, mueble.x + mueble.w);
    ys.push(mueble.y, mueble.y + mueble.h);
  }
  if (!xs.length) return { puntos: [], motivo: 'el mundo no tiene geometría' };
  const x0 = Math.min(...xs) - 20;
  const y0 = Math.min(...ys) - 20;
  const columnas = Math.ceil((Math.max(...xs) + 20 - x0) / paso);
  const filas = Math.ceil((Math.max(...ys) + 20 - y0) / paso);
  const centro = (ix, iy) => ({ x: x0 + (ix + 0.5) * paso, y: y0 + (iy + 0.5) * paso });
  const indice = (ix, iy) => iy * columnas + ix;
  const dentro = (ix, iy) => ix >= 0 && iy >= 0 && ix < columnas && iy < filas;

  const cache = new Map();
  const celdaLibre = (ix, iy) => {
    if (!dentro(ix, iy)) return false;
    const clave = indice(ix, iy);
    if (cache.has(clave)) return cache.get(clave);
    const { x, y } = centro(ix, iy);
    const resultado = libre(x, y);
    cache.set(clave, resultado);
    return resultado;
  };

  /** Celda libre más cercana a un punto, buscando en anillos. */
  const celdaCercana = (punto, busqueda) => {
    const ix = Math.floor((punto.x - x0) / paso);
    const iy = Math.floor((punto.y - y0) / paso);
    if (celdaLibre(ix, iy)) return { ix, iy };
    const anillos = Math.ceil(busqueda / paso);
    for (let anillo = 1; anillo <= anillos; anillo += 1) {
      let mejor = null;
      let mejorDistancia = Infinity;
      for (let dx = -anillo; dx <= anillo; dx += 1) {
        for (let dy = -anillo; dy <= anillo; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== anillo) continue;
          if (!celdaLibre(ix + dx, iy + dy)) continue;
          const { x, y } = centro(ix + dx, iy + dy);
          const distancia = Math.hypot(x - punto.x, y - punto.y);
          if (distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejor = { ix: ix + dx, iy: iy + dy };
          }
        }
      }
      if (mejor) return mejor;
    }
    return null;
  };

  const arranque = celdaCercana(desde, BUSQUEDA_ARRANQUE);
  if (!arranque) {
    return { puntos: [], motivo: `el arranque (${redondear(desde.x)}, ${redondear(desde.y)}) está encerrado` };
  }
  const meta = celdaCercana(hasta, BUSQUEDA_META);
  if (!meta) {
    return {
      puntos: [],
      motivo:
        `el destino (${redondear(hasta.x)}, ${redondear(hasta.y)}) no tiene ` +
        `${holgura} px de holgura`,
    };
  }

  // A* en 8 direcciones sobre la rejilla, sin cortar esquinas.
  const inicioIndice = indice(arranque.ix, arranque.iy);
  const metaIndice = indice(meta.ix, meta.iy);
  const abiertos = [{ indice: inicioIndice, coste: 0, estimado: 0 }];
  const costeConocido = new Map([[inicioIndice, 0]]);
  const anterior = new Map();
  const visitados = new Set();
  const heuristica = (ix, iy) => Math.hypot(ix - meta.ix, iy - meta.iy) * paso;
  const direcciones = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  let encontrado = false;
  while (abiertos.length) {
    let mejor = 0;
    for (let indiceAbierto = 1; indiceAbierto < abiertos.length; indiceAbierto += 1) {
      if (abiertos[indiceAbierto].estimado < abiertos[mejor].estimado) mejor = indiceAbierto;
    }
    const actual = abiertos.splice(mejor, 1)[0];
    if (actual.indice === metaIndice) {
      encontrado = true;
      break;
    }
    if (visitados.has(actual.indice)) continue;
    visitados.add(actual.indice);
    const ix = actual.indice % columnas;
    const iy = Math.floor(actual.indice / columnas);
    for (const [dx, dy, coste] of direcciones) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (!celdaLibre(nx, ny)) continue;
      // En diagonal no se corta la esquina: los dos lados tienen que estar libres.
      if (dx !== 0 && dy !== 0 && (!celdaLibre(ix + dx, iy) || !celdaLibre(ix, iy + dy))) continue;
      const siguiente = indice(nx, ny);
      const nuevoCoste = actual.coste + coste * paso;
      if (nuevoCoste >= (costeConocido.get(siguiente) ?? Infinity)) continue;
      costeConocido.set(siguiente, nuevoCoste);
      anterior.set(siguiente, actual.indice);
      abiertos.push({
        indice: siguiente,
        coste: nuevoCoste,
        estimado: nuevoCoste + heuristica(nx, ny),
      });
    }
  }
  if (!encontrado) {
    return {
      puntos: [],
      motivo:
        `no hay paso con ${holgura} px de holgura entre ` +
        `(${redondear(desde.x)}, ${redondear(desde.y)}) y ` +
        `(${redondear(hasta.x)}, ${redondear(hasta.y)})`,
    };
  }

  const celdas = [];
  for (let indiceActual = metaIndice; indiceActual !== undefined; indiceActual = anterior.get(indiceActual)) {
    const ix = indiceActual % columnas;
    const iy = Math.floor(indiceActual / columnas);
    celdas.push(centro(ix, iy));
    if (indiceActual === inicioIndice) break;
  }
  celdas.reverse();

  // Tramos rectos: se salta a la celda más lejana que conserva la holgura.
  const tramoLibre = (a, b) => {
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    const muestras = Math.max(1, Math.ceil(largo / MUESTRA_TRAMO));
    for (let muestra = 1; muestra <= muestras; muestra += 1) {
      const t = muestra / muestras;
      if (!libre(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  };
  const tramos = [];
  let cursor = 0;
  tramos.push(celdas[0]);
  while (cursor < celdas.length - 1) {
    let salto = celdas.length - 1;
    while (salto > cursor + 1 && !tramoLibre(celdas[cursor], celdas[salto])) salto -= 1;
    tramos.push(celdas[salto]);
    cursor = salto;
  }

  // Cada cruce de vano se camina por el carril de la hoja cerrada: de frente, con
  // un punto a cada lado de la hoja. El punto medio solo no basta: el cuerpo puede
  // llegar pegado a un jamb y la rejilla, que ve un agujero entre dos muros, lo deja
  // cruzar en diagonal rozando la esquina. Con la alineación primero se centra en el
  // carril del lado por el que viene y después cruza recto, que es lo único que la
  // hoja abierta deja libre.
  const conVanos = [tramos[0]];
  for (let indiceTramo = 1; indiceTramo < tramos.length; indiceTramo += 1) {
    const a = tramos[indiceTramo - 1];
    const b = tramos[indiceTramo];
    const largoTramo2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const parametro = (punto) =>
      largoTramo2
        ? ((punto.x - a.x) * (b.x - a.x) + (punto.y - a.y) * (b.y - a.y)) / largoTramo2
        : 0;
    const cruces = [];
    for (const puerta of mundo?.doors ?? []) {
      const cruce = cruceDeSegmentos(
        { ax: a.x, ay: a.y, bx: b.x, by: b.y },
        { ax: puerta.x1, ay: puerta.y1, bx: puerta.x2, by: puerta.y2 }
      );
      if (!cruce) continue;
      const carril = carrilDePuerta(puerta);
      if (!carril) continue;
      // Un cruce que ya es perpendicular y cae en el punto medio del vano no necesita
      // alineación: la hoja franca lo deja libre de jamb a jamb. Solo se alinea el
      // cruce oblicuo o descentrado, que es el que puede engancharse en una esquina.
      const rumboX = b.x - a.x;
      const rumboY = b.y - a.y;
      const largoRumbo = Math.hypot(rumboX, rumboY) || 1;
      const deFrente =
        Math.abs((rumboX * carril.normal.x + rumboY * carril.normal.y) / largoRumbo) >=
        CRUCE_DE_FRENTE;
      const desvioDelCruce = Math.hypot(cruce.x - carril.medio.x, cruce.y - carril.medio.y);
      if (deFrente && desvioDelCruce <= CARRIL_YA_ALINEADO) {
        cruces.push({ t: cruce.t, punto: carril.medio });
        continue;
      }
      // El tramo llega por un lado de la hoja: la alineación se hace en ese lado
      // para que el cuerpo entre de frente y no por la esquina de un jamb.
      const lado =
        Math.sign(
          (a.x - carril.medio.x) * carril.normal.x + (a.y - carril.medio.y) * carril.normal.y
        ) || 1;
      const puntos = [
        {
          x: carril.medio.x + carril.normal.x * lado * HOLGURA_CUERPO,
          y: carril.medio.y + carril.normal.y * lado * HOLGURA_CUERPO,
        },
        carril.medio,
        {
          x: carril.medio.x - carril.normal.x * lado * HOLGURA_CUERPO,
          y: carril.medio.y - carril.normal.y * lado * HOLGURA_CUERPO,
        },
      ];
      for (const punto of puntos) {
        // Un punto de carril sin holgura (un mueble arrimado al vano) no se inventa:
        // el punto medio sigue estando y el caminante corrige el último tramo.
        if (!libre(punto.x, punto.y)) continue;
        cruces.push({ t: parametro(punto), punto });
      }
    }
    cruces.sort((uno, otro) => uno.t - otro.t);
    for (const cruce of cruces) {
      const punto = { x: redondear(cruce.punto.x), y: redondear(cruce.punto.y) };
      const ultimo = conVanos[conVanos.length - 1];
      if (Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < 1) continue;
      conVanos.push(punto);
    }
    conVanos.push(b);
  }

  // El último punto es la coordenada pedida: el empuje final lo resuelve el caminante
  // y la aserción se hace sobre ella, no sobre la celda de la rejilla.
  conVanos[conVanos.length - 1] = { x: redondear(hasta.x), y: redondear(hasta.y) };
  return { puntos: conVanos, motivo: null };
}
